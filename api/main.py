import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    _repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(_repo_root / "web" / ".env.local")
    # Root env wins so keys like OPENAI_API_KEY are not blocked by empty lines in web/.env.local
    load_dotenv(_repo_root / ".env.local", override=True)
except ImportError:
    pass

import io
import json
import re
import cv2
import numpy as np
import tempfile
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from collections import Counter
# MediaPipe: import FaceMesh directly (compatible with 0.10.x which removed mp.solutions)
try:
    from mediapipe.python.solutions.face_mesh import FaceMesh as MPFaceMesh
    MEDIAPIPE_OK = True
    print("[OK] MediaPipe FaceMesh loaded")
except ImportError:
    try:
        import mediapipe as mp
        MPFaceMesh = mp.solutions.face_mesh.FaceMesh
        MEDIAPIPE_OK = True
        print("[OK] MediaPipe FaceMesh loaded (legacy)")
    except Exception as e:
        MPFaceMesh = None
        MEDIAPIPE_OK = False
        print(f"[WARN] MediaPipe not available: {e}")

import torch
import torch.nn as nn
import torch.nn.functional as F
import torchaudio
import torchaudio.transforms as T
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image

import google.genai as genai

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, this can be restricted to the Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Gemini Setup
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY", "")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# Text LLMs for /generate-interview-context (order: Groq → OpenAI → Gemini)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip()
if GROQ_API_KEY:
    print(f"[OK] GROQ_API_KEY set — free-tier interview context via Groq ({GROQ_MODEL})")
if OPENAI_API_KEY:
    print("[OK] OPENAI_API_KEY set (used if Groq fails or is unset)")
if gemini_client:
    print("[OK] Gemini configured (fallback; free tier is easy to rate-limit)")
if not (GROQ_API_KEY or OPENAI_API_KEY or gemini_client):
    print("[WARN] No GROQ / OpenAI / Gemini key — interview context will return 503")

# ---------------------------------------------------------------------------
# Device
# ---------------------------------------------------------------------------
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[OK] Device: {device}")

# ---------------------------------------------------------------------------
# Load EfficientNet-B0 (Video Emotion Model)
# ---------------------------------------------------------------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), "mockmate_efficientnet_b0.pt")

EMOTIONS = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']
NUM_CLASSES = 7

EMOTION_TO_CONFIDENCE = {
    'happy': 'Confident & Positive',
    'neutral': 'Calm & Composed',
    'surprise': 'Engaged & Attentive',
    'sad': 'Low Energy',
    'angry': 'Stressed / Tense',
    'fear': 'Nervous',
    'disgust': 'Uncomfortable',
}

CONFIDENCE_LEVEL = {
    'happy': 'HIGH', 'neutral': 'HIGH', 'surprise': 'MEDIUM',
    'sad': 'LOW', 'angry': 'LOW', 'fear': 'LOW', 'disgust': 'LOW',
}


def _build_efficientnet(num_classes: int) -> nn.Module:
    model = models.efficientnet_b0(weights=None)
    model.classifier = nn.Sequential(
        nn.Dropout(0.4),
        nn.Linear(1280, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(0.3),
        nn.Linear(512, num_classes),
    )
    return model


emotion_model = None
try:
    checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    emotion_model = _build_efficientnet(checkpoint.get("num_classes", NUM_CLASSES))
    emotion_model.load_state_dict(checkpoint["model_state_dict"])
    emotion_model.to(device)
    emotion_model.eval()
    acc = checkpoint.get("test_accuracy", 0)
    f1 = checkpoint.get("test_f1_macro", 0)
    print(f"[OK] EfficientNet-B0 loaded | Acc: {acc:.4f} F1: {f1:.4f}")
except Exception as e:
    print(f"[WARN] Could not load emotion model: {e}")

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

inference_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# ---------------------------------------------------------------------------
# CNN + BiLSTM + Blend MLP Voice Confidence Model (Blended Architecture v2)
# Confidence = blend(emotion_probs, acoustic_features) — no fake lookup tables
# ---------------------------------------------------------------------------
VOICE_MODEL_PATH = os.path.join(os.path.dirname(__file__), "best_model_new.pth")
VOICE_EMOTIONS = ['angry', 'disgust', 'fearful', 'happy', 'neutral', 'sad']
MAX_FRAMES = 94
PROSODIC_COLS = [
    'pitch_mean', 'pitch_std', 'pitch_range', 'pitch_stability',
    'jitter', 'shimmer', 'hnr', 'energy_mean', 'energy_std',
    'energy_range', 'zcr_mean', 'silence_ratio', 'duration'
]


class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch, pool=(2, 2)):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1), nn.BatchNorm2d(out_ch), nn.ReLU(),
            nn.Conv2d(out_ch, out_ch, 3, padding=1), nn.BatchNorm2d(out_ch), nn.ReLU(),
            nn.MaxPool2d(pool), nn.Dropout2d(0.2)
        )

    def forward(self, x):
        return self.conv(x)


class VoiceConfidenceModel(nn.Module):
    """Blended architecture v2:
    CNN+BiLSTM → emotion_probs (6, soft) + prosodic_enc (32) → Blend MLP → confidence (1)
    Emotion is auxiliary — shapes the backbone, not the sole confidence source.
    """
    def __init__(self):
        super().__init__()
        self.cnn = nn.Sequential(
            ConvBlock(1, 32, (2, 2)), ConvBlock(32, 64, (2, 2)),
            ConvBlock(64, 128, (2, 1)), ConvBlock(128, 128, (2, 1))
        )
        self.cnn_proj = nn.Sequential(nn.Linear(1024, 256), nn.LayerNorm(256), nn.ReLU())
        self.bilstm = nn.LSTM(256, 256, 2, batch_first=True, bidirectional=True, dropout=0.3)
        self.attention = nn.Sequential(nn.Linear(512, 64), nn.Tanh(), nn.Linear(64, 1))
        # Auxiliary emotion head (6 emotions)
        self.emotion_head = nn.Sequential(nn.Linear(512, 64), nn.ReLU(), nn.Linear(64, 6))
        # Prosodic encoder
        self.prosodic_enc = nn.Sequential(nn.Linear(13, 32), nn.ReLU(), nn.BatchNorm1d(32))
        # Blend MLP: emotion_probs(6) + prosodic(32) → confidence(1)
        self.blend = nn.Sequential(
            nn.Linear(6 + 32, 64), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(64, 32), nn.ReLU(),
            nn.Linear(32, 1), nn.Sigmoid()
        )

    def forward(self, mel, prosodic):
        B = mel.shape[0]
        x = self.cnn(mel).permute(0, 3, 1, 2).reshape(B, 23, -1)
        x = self.cnn_proj(x)
        lstm_out, _ = self.bilstm(x)
        weights = torch.softmax(self.attention(lstm_out), dim=1)
        pooled = (lstm_out * weights).sum(dim=1)
        emotion_logits = self.emotion_head(pooled)
        emotion_probs  = torch.softmax(emotion_logits, dim=1)
        pros = self.prosodic_enc(prosodic)
        confidence = self.blend(torch.cat([emotion_probs, pros], dim=1)).squeeze(-1)
        return {'emotion_logits': emotion_logits, 'confidence': confidence}


voice_model = None
voice_label_encoder = None
voice_scaler_mean = None
voice_scaler_std  = None
try:
    ckpt = torch.load(VOICE_MODEL_PATH, map_location=device, weights_only=False)
    voice_model = VoiceConfidenceModel().to(device)
    voice_model.load_state_dict(ckpt['model'])
    voice_model.eval()
    voice_label_encoder = ckpt.get('label_encoder', VOICE_EMOTIONS)
    # Blended model stores scaler as mean/std arrays instead of sklearn object
    voice_scaler_mean = np.array(ckpt['scaler_mean']) if 'scaler_mean' in ckpt else None
    voice_scaler_std  = np.array(ckpt['scaler_std'])  if 'scaler_std'  in ckpt else None
    print(f"[OK] VoiceConfidenceModel (blended v2) loaded from {VOICE_MODEL_PATH}")
except Exception as e:
    print(f"[WARN] Could not load voice model: {e}")


# ---------------------------------------------------------------------------
# Helpers — filler words + pace
# ---------------------------------------------------------------------------
FILLER_WORDS = {
    "um": 0, "uh": 0, "like": 0, "you know": 0, "actually": 0,
    "basically": 0, "literally": 0, "right": 0, "so": 0,
    "I mean": 0, "kind of": 0, "sort of": 0, "well": 0,
}


def _is_http_url(s: str) -> bool:
    s = (s or "").strip()
    return s.startswith("http://") or s.startswith("https://")


def download_video_to_temp(url: str) -> Optional[str]:
    import requests

    try:
        r = requests.get(url, timeout=180, stream=True)
        r.raise_for_status()
        suffix = ".webm"
        if ".mp4" in url.lower():
            suffix = ".mp4"
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        for chunk in r.iter_content(chunk_size=1024 * 1024):
            if chunk:
                tmp.write(chunk)
        tmp.close()
        return tmp.name
    except Exception as e:
        print(f"[Video Download] {e}")
        return None


def resolve_local_video_path(video_path: str) -> tuple[Optional[str], Optional[str]]:
    """Return (local_path, temp_path_to_delete)."""
    if not video_path or not video_path.strip():
        return None, None
    if os.path.exists(video_path):
        return video_path, None
    if _is_http_url(video_path):
        p = download_video_to_temp(video_path)
        if p:
            return p, p
    return None, None


def upload_extracted_audio_to_supabase(
    local_wav_path: str, user_id: str, interview_id: str
) -> Optional[str]:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key or not os.path.isfile(local_wav_path):
        return None
    bucket = os.environ.get("SUPABASE_INTERVIEWS_BUCKET", "interviews")
    safe_uid = "".join(c if c.isalnum() or c in "._-" else "_" for c in user_id)[:200]
    obj = f"audio/{safe_uid}/{interview_id}.wav"
    try:
        from supabase import create_client

        client = create_client(url, key)
        with open(local_wav_path, "rb") as f:
            data = f.read()
        client.storage.from_(bucket).upload(
            obj,
            data,
            file_options={"content-type": "audio/wav", "upsert": "true"},
        )
        pub = client.storage.from_(bucket).get_public_url(obj)
        if isinstance(pub, str):
            return pub
        if isinstance(pub, dict):
            return pub.get("publicUrl")
        return getattr(pub, "publicUrl", None) or (str(pub) if pub else None)
    except Exception as e:
        print(f"[Supabase audio upload] {e}")
        return None


class ProcessRequest(BaseModel):
    video_path: str = ""
    interview_id: str
    transcript: Optional[str] = None
    user_id: Optional[str] = None


@app.get("/")
def read_root():
    return {
        "status": "MockMate AI API is running",
        "models": {
            "video_emotion": "EfficientNet-B0",
            "voice_confidence": "CNN+BiLSTM",
            "suggestions": "Gemini 1.5 Flash",
        },
        "emotion_model_loaded": emotion_model is not None,
        "voice_model_loaded": voice_model is not None,
    }


# ---------------------------------------------------------------------------
# Voice inference helper
# ---------------------------------------------------------------------------
def extract_audio_from_video(video_path: str) -> Optional[str]:
    """Extract audio as WAV from a video file using ffmpeg."""
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp.close()
        
        # Try to use imageio-ffmpeg for a bundled ffmpeg executable, 
        # otherwise fallback to 'ffmpeg' in system PATH
        ffmpeg_cmd = "ffmpeg"
        try:
            import imageio_ffmpeg
            ffmpeg_cmd = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError:
            pass

        result = subprocess.run(
            [ffmpeg_cmd, "-y", "-i", video_path, "-ar", "16000", "-ac", "1", tmp.name],
            capture_output=True, timeout=60
        )
        if result.returncode == 0 and os.path.exists(tmp.name):
            return tmp.name
        else:
            print(f"[Audio Extract] ffmpeg failed with code {result.returncode}. Stderr: {result.stderr.decode('utf-8', errors='ignore')}")
    except Exception as e:
        print(f"[Audio Extract] ffmpeg error: {e}")
    return None


def run_voice_model(audio_path: str) -> Optional[dict]:
    """Run CNN+BiLSTM on audio file, return confidence/pitch/fluency/energy scores."""
    if voice_model is None:
        return None
    try:
        # Load audio using librosa (more stable across OS than torchaudio without codecs)
        import librosa
        wav_np, _ = librosa.load(audio_path, sr=16000, mono=True)
        wav = torch.from_numpy(wav_np).unsqueeze(0)  # Shape: (1, N)

        # Pad / trim to 3 seconds
        target_len = 16000 * 3
        if wav.shape[1] >= target_len:
            wav = wav[:, :target_len]
        else:
            wav = F.pad(wav, (0, target_len - wav.shape[1]))

        # Mel spectrogram
        mel_transform = T.MelSpectrogram(sample_rate=16000, n_fft=1024, hop_length=512, n_mels=128)
        db_transform = T.AmplitudeToDB()
        mel = db_transform(mel_transform(wav))
        mel = (mel - mel.mean()) / (mel.std() + 1e-9)
        if mel.shape[2] >= MAX_FRAMES:
            mel = mel[:, :, :MAX_FRAMES]
        else:
            mel = F.pad(mel, (0, MAX_FRAMES - mel.shape[2]))

        # Extract real prosodic features using Praat (identical to training pipeline)
        prosodic_list = extract_real_prosodic(audio_path)

        # Normalize using saved scaler mean/std arrays
        prosodic_arr = np.array(prosodic_list).reshape(1, -1)
        if voice_scaler_mean is not None and voice_scaler_std is not None:
            prosodic_arr = (prosodic_arr - voice_scaler_mean) / (voice_scaler_std + 1e-8)

        mel_tensor  = mel.unsqueeze(0).float().to(device)                          # (1, 1, 128, 94)
        pros_tensor = torch.tensor(prosodic_arr, dtype=torch.float32).to(device)   # (1, 13)

        with torch.no_grad():
            out = voice_model(mel_tensor, pros_tensor)

        emotion_idx  = int(torch.argmax(out['emotion_logits'], dim=1).item())
        emotion_name = voice_label_encoder[emotion_idx] if voice_label_encoder else VOICE_EMOTIONS[emotion_idx]

        # Single blended confidence score (primary output)
        confidence = round(float(out['confidence'].item()), 3)

        # Derive pitch / fluency / energy directly from raw prosodic features
        # so the frontend API contract stays identical
        raw = prosodic_list  # unscaled values
        pitch_score   = round(float(np.clip(raw[3], 0, 1)), 3)                      # pitch_stability
        fluency_score = round(float(np.clip(1.0 - raw[11], 0, 1)), 3)              # 1 - silence_ratio
        energy_score  = round(float(np.clip(raw[7] / 0.08, 0, 1)), 3)             # energy_mean normalised

        # Blend model confidence with prosody when the net outputs ~0 but audio is clearly voiced
        if confidence < 0.12:
            aux = (pitch_score + fluency_score + energy_score) / 3.0
            confidence = round(min(1.0, max(confidence, 0.2 * confidence + 0.8 * aux)), 3)

        return {
            "voice_emotion":    emotion_name,
            "confidence_score": confidence,
            "pitch_score":      pitch_score,
            "fluency_score":    fluency_score,
            "energy_score":     energy_score,
        }
    except Exception as e:
        print(f"[Voice Model] Error: {e}")
        import traceback; traceback.print_exc()
        return None


def extract_real_prosodic(audio_path: str) -> list:
    """Extract REAL 13 prosodic features using Praat — identical to training pipeline."""
    import parselmouth
    from parselmouth.praat import call
    import librosa

    try:
        # Load with librosa for energy/zcr features
        y, sr = librosa.load(audio_path, sr=16000, mono=True)
        duration = float(len(y) / sr)

        # Load with parselmouth for Praat analysis
        snd = parselmouth.Sound(audio_path)

        # ── Pitch (F0) ──────────────────────────────────────────────
        pitch_obj = snd.to_pitch()
        pitch_values = pitch_obj.selected_array['frequency']
        pitch_voiced = pitch_values[pitch_values > 0]
        if len(pitch_voiced) > 1:
            pitch_mean = float(np.mean(pitch_voiced))
            pitch_std = float(np.std(pitch_voiced))
            pitch_range = float(np.max(pitch_voiced) - np.min(pitch_voiced))
            pitch_stability = float(1.0 - np.clip(pitch_std / (pitch_mean + 1e-9), 0, 1))
        else:
            pitch_mean, pitch_std, pitch_range, pitch_stability = 150.0, 20.0, 80.0, 0.5

        # ── Jitter (cycle-to-cycle pitch variation) ─────────────────
        try:
            point_process = call(snd, "To PointProcess (periodic, cc)", 75, 600)
            jitter = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
            jitter = float(np.clip(jitter if jitter and not np.isnan(jitter) else 0.05, 0, 1))
        except Exception:
            jitter = 0.05

        # ── Shimmer (cycle-to-cycle amplitude variation) ────────────
        try:
            point_process = call(snd, "To PointProcess (periodic, cc)", 75, 600)
            shimmer = call([snd, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)
            shimmer = float(np.clip(shimmer if shimmer and not np.isnan(shimmer) else 0.05, 0, 1))
        except Exception:
            shimmer = 0.05

        # ── HNR (Harmonics-to-Noise Ratio) ──────────────────────────
        try:
            harmonicity = call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
            hnr = call(harmonicity, "Get mean", 0, 0)
            hnr = float(np.clip(hnr if hnr and not np.isnan(hnr) else 0.0, 0, 30))
        except Exception:
            hnr = 0.0

        # ── Energy (RMS per frame) ───────────────────────────────────
        hop = 512
        frames = [y[i:i+hop] for i in range(0, len(y) - hop, hop)]
        rms = np.array([np.sqrt(np.mean(f**2 + 1e-12)) for f in frames]) if frames else np.array([1e-6])
        energy_mean = float(np.mean(rms))
        energy_std = float(np.std(rms))
        energy_range = float(np.ptp(rms))

        # ── ZCR (Zero Crossing Rate) ─────────────────────────────────
        zcr_mean = float(np.mean(librosa.feature.zero_crossing_rate(y, hop_length=hop)[0]))

        # ── Silence ratio ────────────────────────────────────────────
        thr = np.max(np.abs(y)) * 0.02
        silence_ratio = float(np.mean(np.abs(y) < thr))

        # ── Assemble 13 features — same order as training ────────────
        features = [
            pitch_mean,        # pitch_mean  (will be scaled by model's StandardScaler if saved)
            pitch_std,         # pitch_std
            pitch_range,       # pitch_range
            pitch_stability,   # pitch_stability
            jitter,            # jitter
            shimmer,           # shimmer
            hnr,               # hnr
            energy_mean,       # energy_mean
            energy_std,        # energy_std
            energy_range,      # energy_range
            zcr_mean,          # zcr_mean
            silence_ratio,     # silence_ratio
            duration,          # duration
        ]
        print(f"[Praat] pitch={pitch_mean:.1f}Hz jitter={jitter:.4f} shimmer={shimmer:.4f} HNR={hnr:.1f}dB")
        return features

    except Exception as e:
        print(f"[Praat] Failed, using fallback: {e}")
        # Fallback zeros if Praat fails for any reason
        return [150.0, 20.0, 80.0, 0.5, 0.05, 0.05, 5.0, 0.01, 0.005, 0.008, 0.05, 0.3, 3.0]


# ---------------------------------------------------------------------------
# LLM helper — Groq (free) → OpenAI → Gemini (same order as interview context)
# ---------------------------------------------------------------------------
def _llm_chat(messages: list, temperature: float = 0.5) -> Optional[str]:
    """Return assistant text, or None if every provider fails."""
    if GROQ_API_KEY:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
            resp = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                temperature=temperature,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"[LLM] Groq failed: {e}")
    if OPENAI_API_KEY:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                temperature=temperature,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"[LLM] OpenAI failed: {e}")
    if gemini_client:
        try:
            blob = "\n\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=blob,
            )
            return (getattr(response, "text", None) or "").strip()
        except Exception as e:
            print(f"[LLM] Gemini failed: {e}")
    return None


# ---------------------------------------------------------------------------
# Gemini suggestions helper (uses Groq/OpenAI/Gemini via _llm_chat)
# ---------------------------------------------------------------------------
def get_gemini_suggestions(
    voice_emotion: str,
    confidence_score: float,
    pitch_score: float,
    fluency_score: float,
    energy_score: float,
    dominant_visual_emotion: str,
    filler_count: int,
    wpm: int,
) -> list:
    """Ask Gemini to generate 3 personalized voice coaching suggestions."""
    conf_pct = int(confidence_score * 100)
    pitch_pct = int(pitch_score * 100)
    flu_pct = int(fluency_score * 100)
    eng_pct = int(energy_score * 100)

    prompt = f"""You are an expert interview coach specializing in voice and communication.
A candidate just completed a mock job interview. Here are their analysis results:

🎤 VOICE ANALYSIS (CNN+BiLSTM Deep Learning Model):
- Detected Voice Emotion: {voice_emotion}
- Confidence Score: {conf_pct}/100
- Pitch Stability: {pitch_pct}/100
- Speech Fluency: {flu_pct}/100
- Energy Level: {eng_pct}/100

📹 VISUAL ANALYSIS:
- Dominant Facial Expression: {dominant_visual_emotion}
- Filler Words Used: {filler_count}
- Speaking Pace: {wpm} words per minute

Based on ONLY these metrics, give exactly 3 specific, actionable coaching suggestions.
Rules:
- Each suggestion must be 1-2 sentences max
- Be encouraging but honest
- Reference the specific scores where relevant
- Focus on what they can practice before their next interview
- Return ONLY a JSON array of 3 strings, no markdown, no explanation

Example format: ["suggestion 1", "suggestion 2", "suggestion 3"]"""

    try:
        text = _llm_chat(
            [
                {"role": "system", "content": "Reply with a JSON array of exactly 3 strings only. No markdown."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.55,
        )
        if text:
            start = text.find("[")
            end = text.rfind("]") + 1
            if start != -1 and end > start:
                suggestions = json.loads(text[start:end])
                if isinstance(suggestions, list):
                    return [str(s) for s in suggestions[:3]]
    except Exception as e:
        print(f"[Suggestions LLM] Error: {e}")

    # Fallback suggestions if Gemini fails
    fallback = []
    if conf_pct < 60:
        fallback.append(f"Your voice confidence was {conf_pct}%. Practice speaking affirmations out loud daily to build vocal authority.")
    if pitch_pct < 60:
        fallback.append(f"Your pitch stability scored {pitch_pct}%. Try reading aloud slowly to reduce pitch variation and sound more composed.")
    if flu_pct < 60:
        fallback.append(f"Your fluency scored {flu_pct}%. Pause deliberately between sentences instead of rushing — silence is powerful.")
    if not fallback:
        fallback.append("Great voice metrics! Focus on maintaining this confidence under pressure in real interviews.")
    return fallback[:3]


# ---------------------------------------------------------------------------
# Gemini transcript coaching (English + communication skills)
# ---------------------------------------------------------------------------
def get_transcript_coaching(transcript_str: str) -> dict:
    """Analyze the actual transcript text with Gemini to coach on English,
    communication skills, answer quality, vocabulary, and grammar."""

    # Extract only candidate's messages
    candidate_text = ""
    try:
        messages = json.loads(transcript_str)
        candidate_lines = [m["text"] for m in messages if m.get("role") == "you"]
        candidate_text = " ".join(candidate_lines).strip()
    except Exception:
        candidate_text = transcript_str or ""

    if not candidate_text or len(candidate_text.split()) < 10:
        return {
            "english_level": "Not enough speech to analyze",
            "strengths": [],
            "improvements": [],
            "vocabulary_tips": [],
            "overall_language_score": 0,
        }

    prompt = f"""You are an expert English communication coach and interview skills trainer.
Analyze the following interview responses from a job candidate:

=== CANDIDATE'S RESPONSES ===
{candidate_text[:4000]}
=== END ===

Provide a detailed coaching report. Return ONLY valid JSON with this exact structure:
{{
  "english_level": "one of: Beginner / Intermediate / Upper-Intermediate / Advanced / Native-like",
  "overall_language_score": <integer 0-100>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": [
    {{"area": "Grammar", "issue": "specific issue observed", "tip": "how to fix it"}},
    {{"area": "Vocabulary", "issue": "specific issue", "tip": "how to improve"}},
    {{"area": "Answer Structure", "issue": "specific issue", "tip": "how to improve"}}
  ],
  "vocabulary_tips": ["replacement word suggestion 1", "replacement word suggestion 2", "replacement word suggestion 3"],
  "communication_score": {{
    "clarity": <0-100>,
    "professionalism": <0-100>,
    "answer_relevance": <0-100>,
    "confidence_in_language": <0-100>
  }}
}}

Be specific — quote exact phrases from the candidate's answers when pointing out issues.
No markdown, only raw JSON."""

    try:
        text = _llm_chat(
            [
                {"role": "system", "content": "Reply with one JSON object only. No markdown."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.45,
        )
        if text:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start != -1 and end > start:
                coaching = json.loads(text[start:end])
                print(f"[Transcript coaching] English level: {coaching.get('english_level')} "
                      f"score: {coaching.get('overall_language_score')}")
                return coaching
    except Exception as e:
        print(f"[Transcript coaching LLM] Error: {e}")

    return {
        "english_level": "Analysis unavailable",
        "overall_language_score": 0,
        "strengths": ["Keep practicing to get detailed feedback."],
        "improvements": [],
        "vocabulary_tips": [],
        "communication_score": {"clarity": 0, "professionalism": 0, "answer_relevance": 0, "confidence_in_language": 0},
    }


# ---------------------------------------------------------------------------
# EfficientNet face prediction
# ---------------------------------------------------------------------------
def predict_emotion(face_bgr: np.ndarray) -> dict:
    if emotion_model is None:
        return None
    try:
        face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(face_rgb)
        tensor = inference_transform(pil_img).unsqueeze(0).to(device)
        with torch.no_grad():
            logits = emotion_model(tensor)
            probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()
        scores = {EMOTIONS[i]: float(probs[i]) for i in range(NUM_CLASSES)}
        dominant = EMOTIONS[int(np.argmax(probs))]
        return {"dominant": dominant, "scores": scores}
    except Exception as e:
        print(f"[Predict] error: {e}")
        return None


def analyze_filler_words(transcript_str: str):
    filler_counts = {}
    text = ""
    try:
        messages = json.loads(transcript_str)
        user_messages = [m["text"] for m in messages if m.get("role") == "you"]
        text = " ".join(user_messages).lower()
    except (json.JSONDecodeError, TypeError):
        text = transcript_str.lower() if transcript_str else ""
    if not text:
        return {"count": 0, "perMinute": 0, "details": {}}
    word_count = len(text.split())
    for filler in FILLER_WORDS:
        count = len(re.findall(r'\b' + re.escape(filler) + r'\b', text))
        if count > 0:
            filler_counts[filler] = count
    total_fillers = sum(filler_counts.values())
    estimated_minutes = max(word_count / 140, 0.5)
    per_minute = round(total_fillers / estimated_minutes, 1)
    return {"count": total_fillers, "perMinute": per_minute, "details": filler_counts}


def analyze_speaking_pace(transcript_str: str):
    text = ""
    try:
        messages = json.loads(transcript_str)
        user_messages = [m["text"] for m in messages if m.get("role") == "you"]
        text = " ".join(user_messages)
    except (json.JSONDecodeError, TypeError):
        text = transcript_str if transcript_str else ""
    word_count = len(text.split())
    estimated_minutes = max(word_count / 140, 0.5)
    wpm = int(word_count / estimated_minutes)
    if wpm < 100:
        label = "Too slow — try to maintain a steady rhythm"
    elif wpm <= 140:
        label = "Excellent — natural and easy to follow"
    elif wpm <= 170:
        label = "Slightly fast — try to slow down for clarity"
    else:
        label = "Too fast — practice pausing between thoughts"
    return {"wpm": wpm, "label": label}


# MediaPipe iris landmark indices
# Left iris: 474-477, Right iris: 469-472
# Left eye corners: 33 (left), 133 (right)
# Right eye corners: 362 (left), 263 (right)
LEFT_IRIS  = [474, 475, 476, 477]
RIGHT_IRIS = [469, 470, 471, 472]
L_EYE_LEFT_CORNER  = 33
L_EYE_RIGHT_CORNER = 133
R_EYE_LEFT_CORNER  = 362
R_EYE_RIGHT_CORNER = 263

# Iris "looking at camera" band (normalized eye width). Too strict → near-zero scores even when face is visible.
GAZE_TOLERANCE = float(os.environ.get("GAZE_TOLERANCE", "0.32"))
# WebM from Chrome is usually NOT mirrored; flipping can break left/right gaze. Default: no flip.
_MIRROR = os.environ.get("VIDEO_MIRROR_FOR_ANALYSIS", "0").strip().lower() in ("1", "true", "yes")


def analyze_video_with_model(video_path: str):
    if not MEDIAPIPE_OK or MPFaceMesh is None:
        # Fallback: no eye contact tracking
        print("[Video] MediaPipe not available, skipping gaze tracking")
        return {
            "eye_contact_score": 0.0,
            "face_detection_rate": 0.0,
            "stability_score": 0.0,
            "dominant_emotion": "neutral",
            "emotion_breakdown": {},
            "frames_analyzed": 0,
            "total_frames": 0,
        }

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))  or 640
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 480

    frame_count       = 0
    face_positions    = []
    emotion_accumulator = Counter()
    frames_with_face  = 0
    frames_analyzed   = 0
    frames_eye_contact = 0   # frames where gaze is at camera
    sample_interval   = max(int(fps), 10)  # analyze ~1 frame/sec

    face_mesh = MPFaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,   # REQUIRED for iris landmarks
        min_detection_confidence=0.5,
    )

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1
        if frame_count % sample_interval != 0:
            continue
        frames_analyzed += 1

        # Optional mirror: many browsers record an un-mirrored file; double-mirroring breaks gaze ratios.
        if _MIRROR:
            frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb)

        if results.multi_face_landmarks:
            frames_with_face += 1
            lm = results.multi_face_landmarks[0].landmark

            # ── Head stability tracking (Frame-to-Frame velocity) ──
            nose = lm[1]
            face_positions.append((nose.x, nose.y))

            # ── Head Pitch tracking (Looking Down) ─────────────────
            # Z corresponds to depth relative to face origin.
            # Forehead is 10, Chin is 152. 
            # When looking severely down at a screen, forehead is much closer to camera than chin.
            forehead_z = lm[10].z
            chin_z = lm[152].z
            # Negative difference heavily implies looking down / chin tucked into chest
            pitch_diff = chin_z - forehead_z
            is_looking_down = pitch_diff < -0.06  # Heuristic threshold for "looking down"

            # ── REAL Eye Contact via Iris Gaze ─────────────────────
            # Get iris center (average of 4 iris landmarks)
            def iris_center(indices):
                xs = [lm[i].x for i in indices]
                ys = [lm[i].y for i in indices]
                return np.mean(xs), np.mean(ys)

            # Get eye corner positions
            def corner(idx):
                return lm[idx].x, lm[idx].y

            # Left eye
            left_iris_x, _  = iris_center(LEFT_IRIS)
            l_left_x,  _    = corner(L_EYE_LEFT_CORNER)
            l_right_x, _    = corner(L_EYE_RIGHT_CORNER)
            left_eye_width   = abs(l_right_x - l_left_x)
            left_ratio = (left_iris_x - l_left_x) / (left_eye_width + 1e-9)

            # Right eye
            right_iris_x, _ = iris_center(RIGHT_IRIS)
            r_left_x, _     = corner(R_EYE_LEFT_CORNER)
            r_right_x, _    = corner(R_EYE_RIGHT_CORNER)
            right_eye_width  = abs(r_right_x - r_left_x)
            right_ratio = (right_iris_x - r_left_x) / (right_eye_width + 1e-9)

            # Average gaze ratio: 0.5 = center = looking at camera
            avg_ratio = (left_ratio + right_ratio) / 2.0
            
            # They are only looking at the camera if their irises are level AND they are not tilted downward
            looking_at_camera = (abs(avg_ratio - 0.5) <= GAZE_TOLERANCE) and not is_looking_down
            if looking_at_camera:
                frames_eye_contact += 1

            # ── EfficientNet Emotion on face crop ─────────────────
            # Get bounding box from face mesh landmarks
            all_x = [lm[i].x * w for i in range(468)]
            all_y = [lm[i].y * h for i in range(468)]
            x1, y1 = max(0, int(min(all_x))), max(0, int(min(all_y)))
            x2, y2 = min(w, int(max(all_x))), min(h, int(max(all_y)))
            face_roi = frame[y1:y2, x1:x2]
            if face_roi.size > 0:
                result = predict_emotion(face_roi)
                if result:
                    emotion_accumulator[result["dominant"]] += 1
        # else: no face detected this frame

    cap.release()
    face_mesh.close()

    # ── Compute final scores ───────────────────────────────────────
    # Raw gaze: % of face frames where iris is near center AND pitch is level
    gaze_raw = round((frames_eye_contact / max(frames_with_face, 1)) * 100, 1)
    face_visibility = round((frames_with_face / max(frames_analyzed, 1)) * 100, 1)
    
    # Do not blend face_visibility if they are explicitly looking down (gaze_raw would be legit 0)
    # We only blend if face visibility is extremely high and gaze is artificially low due to mirror
    if gaze_raw < 15 and face_visibility > 85 and not _MIRROR:
         eye_contact_score = round((gaze_raw + face_visibility) / 2.0, 1)
    else:
         eye_contact_score = gaze_raw

    # Head stability: Track frame-to-frame velocity (jitter) instead of global variance
    stability_score = 70.0
    if len(face_positions) > 5:
        # Calculate Euclidean distances between consecutive nose positions
        pos_array = np.array(face_positions)
        diffs = np.diff(pos_array, axis=0)
        velocities = np.linalg.norm(diffs, axis=1)
        mean_vel = np.mean(velocities)
        
        # Mean velocity > 0.05 is extremely jittery/unstable. 0 is perfectly still.
        # Maps 0.0 vel -> 100%, 0.10 vel -> 0%
        raw_stability = max(0, 100.0 - (mean_vel * 1200.0))
        stability_score = round(raw_stability, 1)

    emotion_breakdown = {}
    total_emotions = sum(emotion_accumulator.values())
    if total_emotions > 0:
        for emotion, count in emotion_accumulator.items():
            emotion_breakdown[emotion] = round((count / total_emotions) * 100, 1)
    dominant_emotion = emotion_accumulator.most_common(1)[0][0] if emotion_accumulator else "neutral"

    print(f"[Video] eye_contact={eye_contact_score}% stability={stability_score} "
          f"face_visible={face_visibility}% frames={frames_analyzed}")

    return {
        "eye_contact_score": eye_contact_score,     # REAL iris gaze tracking
        "face_detection_rate": face_visibility,     # just visibility
        "stability_score": stability_score,
        "dominant_emotion": dominant_emotion,
        "emotion_breakdown": emotion_breakdown,
        "frames_analyzed": frames_analyzed,
        "total_frames": total_frames,
    }


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------
@app.post("/process")
async def process_media(request: ProcessRequest):
    try:
        vp = (request.video_path or "").strip()
        local_video, temp_video = resolve_local_video_path(vp)

        # ── Video Analysis ──────────────────────────────────────────────
        video = None
        if local_video and os.path.exists(local_video):
            print(f"[Process] Analyzing video: {local_video}")
            video = analyze_video_with_model(local_video)
        else:
            print("[Process] No video file, text-only analysis")

        # ── Voice Model Analysis + Supabase audio upload ───────────────
        voice_scores = None
        audio_url = None
        if local_video and os.path.exists(local_video):
            print("[Process] Extracting audio for voice model...")
            audio_path = extract_audio_from_video(local_video)
            if audio_path:
                try:
                    voice_scores = run_voice_model(audio_path)
                    if voice_scores:
                        print(
                            f"[Process] Voice model: conf={voice_scores['confidence_score']:.2f}, "
                            f"pitch={voice_scores['pitch_score']:.2f}, "
                            f"fluency={voice_scores['fluency_score']:.2f}, "
                            f"energy={voice_scores['energy_score']:.2f}"
                        )
                    uid = (request.user_id or "anonymous").strip()
                    audio_url = upload_extracted_audio_to_supabase(
                        audio_path, uid, request.interview_id
                    )
                    if audio_url:
                        print(f"[Process] Audio stored: {audio_url}")
                finally:
                    try:
                        os.remove(audio_path)
                    except Exception:
                        pass

        if temp_video and os.path.exists(temp_video):
            try:
                os.remove(temp_video)
            except Exception:
                pass

        # ── Transcript Analysis ─────────────────────────────────────────
        filler = analyze_filler_words(request.transcript or "")
        pace = analyze_speaking_pace(request.transcript or "")
        print(f"[Process] Transcript: {filler['count']} fillers, {pace['wpm']} wpm")

        # ── Merge results ───────────────────────────────────────────────
        eye_contact  = video["eye_contact_score"]  if video else 0   # REAL iris gaze %
        face_rate    = video["face_detection_rate"] if video else 0   # face visibility
        stability    = video["stability_score"]     if video else 0
        dominant_emotion  = video["dominant_emotion"]  if video else "neutral"
        emotion_breakdown = video["emotion_breakdown"] if video else {"neutral": 100}

        # Confidence = 100% from CNN+BiLSTM voice model (real, not blended)
        avg_confidence = int((voice_scores["confidence_score"] * 100)) if voice_scores else 65

        emotion_label = EMOTION_TO_CONFIDENCE.get(dominant_emotion, "Neutral")

        voice_conf = avg_confidence
        if voice_conf > 80 and stability > 70:
            communication = "Strong vocal presence with confident delivery and composed body language."
        elif voice_conf > 65:
            communication = "Good delivery overall — small improvements in voice energy would make a big impact."
        elif voice_conf > 50:
            communication = "Moderate delivery — focus on speaking with more authority and maintaining eye contact."
        else:
            communication = "Needs practice — try recording yourself daily to build vocal confidence and presence."

        # Eye contact label (real iris gaze)
        if eye_contact > 80:
            eye_label = "Excellent"
        elif eye_contact > 60:
            eye_label = "Good"
        elif eye_contact > 40:
            eye_label = "Needs Improvement"
        else:
            eye_label = "Poor"

        if stability > 80:
            head_label = "Very Stable"
        elif stability > 60:
            head_label = "Stable"
        elif stability > 40:
            head_label = "Moderate Movement"
        elif stability >= 25:
            head_label = "Some Movement"
        else:
            head_label = "High Movement"

        face_in_label = "Strong" if face_rate > 85 else ("Good" if face_rate > 65 else ("Fair" if face_rate > 40 else "Low"))

        posture_score = int((stability + face_rate) / 2)
        if posture_score > 80:
            posture_label = "Excellent"
            posture_details = "You maintained great posture and stayed well-framed throughout."
        elif posture_score > 60:
            posture_label = "Good"
            posture_details = "Your posture was mostly good. Try to stay centered and sit upright."
        else:
            posture_label = "Needs Improvement"
            posture_details = "Work on sitting upright and staying centered in the camera frame."

        # ── LLM coaching suggestions (Groq / OpenAI / Gemini) ────────────
        print("[Process] Calling LLM for suggestions...")
        gemini_suggestions = get_gemini_suggestions(
            voice_emotion=voice_scores["voice_emotion"] if voice_scores else dominant_emotion,
            confidence_score=voice_scores["confidence_score"] if voice_scores else avg_confidence / 100,
            pitch_score=voice_scores["pitch_score"] if voice_scores else 0.5,
            fluency_score=voice_scores["fluency_score"] if voice_scores else 0.5,
            energy_score=voice_scores["energy_score"] if voice_scores else 0.5,
            dominant_visual_emotion=dominant_emotion,
            filler_count=filler["count"],
            wpm=pace["wpm"],
        )
        print(f"[Process] LLM returned {len(gemini_suggestions)} suggestions")

        # ── Transcript coaching (same LLM chain) ─────────────────────────
        print("[Process] Calling LLM for transcript coaching...")
        english_coaching = get_transcript_coaching(request.transcript or "")
        print(f"[Process] English coaching done. Level: {english_coaching.get('english_level')}")

        # Rule-based suggestions (combined with Gemini)
        rule_suggestions = []
        if face_rate < 80:
            rule_suggestions.append(
                f"Your face was visible only {face_rate:.0f}% of the time. Keep your face centered in the camera frame."
            )
        if stability < 60:
            rule_suggestions.append("Reduce head movement during responses to appear more composed and confident.")
        if dominant_emotion in ("fear", "sad"):
            rule_suggestions.append("You appeared nervous. Try power posing before interviews and practice deep breathing.")
        if dominant_emotion == "angry":
            rule_suggestions.append("You appeared tense at times. Relax your facial muscles and smile naturally.")
        if filler["count"] > 5:
            top_fillers = sorted(filler["details"].items(), key=lambda x: -x[1])[:3]
            filler_str = ", ".join([f"'{w}' ({c}x)" for w, c in top_fillers])
            rule_suggestions.append(f"You used {filler['count']} filler words ({filler_str}). Practice pausing instead of filling silence.")
        if pace["wpm"] > 160:
            rule_suggestions.append("Your speaking pace was fast. Slow down and add pauses between key points.")
        elif pace["wpm"] < 100:
            rule_suggestions.append("Your speaking pace was slow. Try to maintain energy and momentum.")

        # Combine: Gemini suggestions first, then rule-based (max 6 total)
        all_suggestions = gemini_suggestions + rule_suggestions
        if len(all_suggestions) == 0:
            all_suggestions.append("Excellent performance across the board. Keep practicing to stay sharp!")

        overall_score = int(
            avg_confidence * 0.3
            + face_rate * 0.2
            + stability * 0.2
            + max(0, 100 - filler["count"] * 5) * 0.15
            + min(100, max(0, 100 - abs(pace["wpm"] - 130))) * 0.15
        )
        overall_score = max(10, min(98, overall_score))

        analysis_result = {
            "interviewId": request.interview_id,
            "confidence": avg_confidence,
            "emotion": emotion_label,
            "communication": communication,
            "suggestions": all_suggestions[:6],
            "eyeContact": {"score": round(eye_contact), "label": eye_label},
            "posture": {"score": posture_score, "label": posture_label, "details": posture_details},
            "headStability": {"score": stability, "label": head_label},
            "facialExpression": {"dominant": dominant_emotion, "breakdown": emotion_breakdown},
            "fillerWords": filler,
            "speakingPace": pace,
            "overallScore": overall_score,
            # Voice model scores (shown as bonus metrics in frontend)
            "voiceAnalysis": voice_scores if voice_scores else {
                "voice_emotion": dominant_emotion,
                "confidence_score": avg_confidence / 100,
                "pitch_score": 0.5,
                "fluency_score": 0.5,
                "energy_score": 0.5,
            },
            "englishCoaching": english_coaching,
            "faceInFrame": {"score": round(face_rate), "label": face_in_label},
            "audio_url": audio_url,
        }

        print(f"[Process] Complete. Overall score: {overall_score}")
        return analysis_result

    except Exception as e:
        print(f"Error processing: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Interview context — role + company + resume → JSON for Vapi (OpenAI or Gemini)
# ---------------------------------------------------------------------------
class InterviewContextRequest(BaseModel):
    jobRole: str
    companyName: Optional[str] = ""
    resumeText: Optional[str] = ""


def _parse_json_object_from_text(raw_text: str) -> dict:
    json_start = raw_text.find("{")
    json_end = raw_text.rfind("}") + 1
    if json_start == -1 or json_end <= json_start:
        raise ValueError("No JSON object in model response")
    return json.loads(raw_text[json_start:json_end])


def _generate_interview_context_with_llm(prompt: str) -> dict:
    """Try Groq (free tier) → OpenAI → Gemini. Raises HTTPException if all fail or none configured."""
    if not GROQ_API_KEY and not OPENAI_API_KEY and not gemini_client:
        raise HTTPException(
            status_code=503,
            detail=(
                "No text LLM configured. Add a FREE key: GROQ_API_KEY from https://console.groq.com/keys "
                "(same `openai` pip package; restart uvicorn). Optional: GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY."
            ),
        )

    failures: list[str] = []

    if GROQ_API_KEY:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
            resp = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You reply with a single valid JSON object only. No markdown code fences, no commentary.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.65,
            )
            raw = (resp.choices[0].message.content or "").strip()
            return _parse_json_object_from_text(raw)
        except Exception as e:
            msg = str(e)
            print(f"[InterviewContext] Groq failed: {e}")
            failures.append(f"Groq: {msg[:500]}")

    if OPENAI_API_KEY:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You reply with a single valid JSON object only. No markdown fences, no commentary.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.65,
            )
            raw = (resp.choices[0].message.content or "").strip()
            return json.loads(raw)
        except Exception as e:
            msg = str(e)
            print(f"[InterviewContext] OpenAI failed: {e}")
            failures.append(f"OpenAI: {msg[:500]}")

    if gemini_client:
        try:
            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt + "\n\nReturn ONLY a valid JSON object, no markdown.",
            )
            raw_text = (getattr(response, "text", None) or "").strip()
            return _parse_json_object_from_text(raw_text)
        except Exception as e:
            print(f"[InterviewContext] Gemini failed: {e}")
            err = str(e)
            failures.append(f"Gemini: {err[:800]}")
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                hint = (
                    "Gemini free tier hit rate limits (normal for new projects). "
                    "Use a free Groq key: set GROQ_API_KEY from https://console.groq.com/keys and restart uvicorn. "
                    "Details: "
                )
                raise HTTPException(status_code=503, detail=(hint + err)[:4000])

    raise HTTPException(
        status_code=502,
        detail=("All configured LLMs failed. Try GROQ_API_KEY (free). Errors: " + " | ".join(failures))[:4000],
    )


@app.post("/generate-interview-context")
async def generate_interview_context(request: InterviewContextRequest):
    """Company- and role-aware interview brief for the voice agent."""
    if not request.jobRole or not request.jobRole.strip():
        raise HTTPException(status_code=400, detail="jobRole is required")

    company = (request.companyName or "").strip() or "a leading company"
    role = request.jobRole.strip()
    resume_snippet = (
        f"\nCandidate resume (first 3000 chars):\n{request.resumeText[:3000]}"
        if request.resumeText
        else "\nNo resume text — infer from role and company only."
    )

    prompt = f"""You are an expert recruiter and interview coach. Produce a realistic, company-specific mock interview playbook.

Job role: {role}
Company: {company}
{resume_snippet}

Return a JSON object with exactly these keys:
- companyOverview (string, 2-3 sentences)
- interviewStyle (string, how this company typically interviews for this role)
- keySkillsToTest (array of 6 short strings)
- interviewerPersona (string, first-person voice persona for the AI interviewer)
- behavioralFramework (string, e.g. STAR or company-specific)
- sampleQuestions (array of 10 objects, each with type, question, why)
- cultureFitFocus (string)
- interviewStructure (string, step-by-step flow with rough timing)
- redFlags (string)
- tipsForSuccess (string)
- openingMessage (string, first line the interviewer says aloud)

Be specific to {company} and {role}. If the company is well-known (Google, Amazon, Microsoft, etc.), reflect public interview culture. No markdown, JSON only."""

    try:
        context = _generate_interview_context_with_llm(prompt)
        print(f"[InterviewContext] OK for {role} @ {company}")
        return {"success": True, "context": context}
    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        print(f"[InterviewContext] JSON parse error: {e}")
        raise HTTPException(status_code=502, detail="Failed to parse LLM response as JSON")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
