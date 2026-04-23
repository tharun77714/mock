import torch
import torch.nn as nn
import torch.nn.functional as F
import torchaudio.transforms as T
import numpy as np
import os
import librosa
import parselmouth
from parselmouth.praat import call

# Voice Emotions
VOICE_EMOTIONS = ['angry', 'disgust', 'fearful', 'happy', 'neutral', 'sad']
MAX_FRAMES = 94

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
    def __init__(self):
        super().__init__()
        self.cnn = nn.Sequential(
            ConvBlock(1, 32, (2, 2)), ConvBlock(32, 64, (2, 2)),
            ConvBlock(64, 128, (2, 1)), ConvBlock(128, 128, (2, 1))
        )
        self.cnn_proj = nn.Sequential(nn.Linear(1024, 256), nn.LayerNorm(256), nn.ReLU())
        self.bilstm = nn.LSTM(256, 256, 2, batch_first=True, bidirectional=True, dropout=0.3)
        self.attention = nn.Sequential(nn.Linear(512, 64), nn.Tanh(), nn.Linear(64, 1))
        self.emotion_head = nn.Sequential(nn.Linear(512, 64), nn.ReLU(), nn.Linear(64, 6))
        self.prosodic_enc = nn.Sequential(nn.Linear(13, 32), nn.ReLU(), nn.BatchNorm1d(32))
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

class VoiceInference:
    def __init__(self, model_data_path=None, device=None):
        self.device = device if device else torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        if model_data_path is None:
            model_data_path = os.path.join(os.path.dirname(__file__), "voice_confidence.pth")
            
        checkpoint = torch.load(model_data_path, map_location=self.device, weights_only=False)
        self.classes = checkpoint.get('label_encoder', VOICE_EMOTIONS)
        self.scaler_mean = np.array(checkpoint['scaler_mean'])
        self.scaler_std = np.array(checkpoint['scaler_std'])
        self.prosodic_cols = checkpoint.get('prosodic_cols', [])
        
        self.model = VoiceConfidenceModel()
        self.model.load_state_dict(checkpoint['model'])
        self.model.to(self.device)
        self.model.eval()
        
        self.mel_t = T.MelSpectrogram(sample_rate=16000, n_fft=1024, hop_length=512, n_mels=128).to(self.device)
        self.db_t = T.AmplitudeToDB().to(self.device)

    def extract_prosodic(self, filepath, sr=16000):
        y, _ = librosa.load(filepath, sr=sr, mono=True)
        if len(y) < sr: y = np.pad(y, (0, sr - len(y)))
        feats = []
        snd = parselmouth.Sound(y, sampling_frequency=sr)
        pitch = call(snd, 'To Pitch', 0.0, 75, 600)
        pv = pitch.selected_array['frequency']
        pv = pv[pv > 0]
        if len(pv) > 0:
            feats.append(np.mean(pv)); feats.append(np.std(pv)); feats.append(np.ptp(pv))
            feats.append(np.clip(1.0 - (np.std(pv)/np.mean(pv)), 0, 1))
        else: feats.extend([0,0,0,0.5])
        
        pp = call(snd, 'To PointProcess (periodic, cc)', 75, 600)
        try:
            feats.append(call(pp, 'Get jitter (local)', 0,0,0.0001,0.02,1.3))
            feats.append(call([snd,pp], 'Get shimmer (local)', 0,0,0.0001,0.02,1.3,1.6))
        except: feats.extend([0.05, 0.10])
        
        try:
            hn = call(snd, 'To Harmonicity (cc)', 0.01, 75, 0.1, 1.0)
            feats.append(call(hn, 'Get mean', 0, 0))
        except: feats.append(5.0)
        
        rms = librosa.feature.rms(y=y)[0]
        feats.append(np.mean(rms)); feats.append(np.std(rms)); feats.append(np.ptp(rms))
        feats.append(np.mean(librosa.feature.zero_crossing_rate(y)[0]))
        feats.append(np.mean(np.abs(y) < (np.max(np.abs(y)) * 0.02)))
        feats.append(len(y) / sr)
        
        return (np.array(feats) - self.scaler_mean) / (self.scaler_std + 1e-9)

        wav = wav.to(self.device)
        mel = self.db_t(self.mel_t(wav))
        mel = (mel - mel.mean()) / (mel.std() + 1e-9)
        if mel.shape[2] > 94: mel = mel[:, :, :94]
        else: mel = F.pad(mel, (0, 94 - mel.shape[2]))
        
        prosodic = torch.tensor(self.extract_prosodic(filepath), dtype=torch.float32).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            preds = self.model(mel.unsqueeze(0), prosodic)
            emotion = self.classes[preds['emotion_logits'].argmax(1).item()]
            confidence = preds['confidence'].item()
            
        return {'emotion': emotion, 'confidence': confidence}

    def _load_audio(self, filepath):
        import librosa
        y, sr = librosa.load(filepath, sr=16000, mono=True)
        return torch.from_numpy(y).unsqueeze(0), 1600

if __name__ == "__main__":
    MODEL_PATH = 'best_model.pth'
    if os.path.exists(MODEL_PATH):
        inference = VoiceInference(MODEL_PATH)
        print("Model loaded.")
