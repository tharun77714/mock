# 🎤 Audio Confidence Analyzer — Full Colab Guide

## Architecture
```
Raw .wav
  ↓
Mel Spectrogram (128 × 94 frames)
  ↓
CNN Block 1 → CNN Block 2 → CNN Block 3 → CNN Block 4
(Conv2D + BN + ReLU + Pool with residual connections)
  ↓
Reshape → (B, T=23, 1024)
  ↓
Linear Projection → (B, T=23, 256)
  ↓
BiLSTM × 2 layers (hidden=256, bidirectional → 512)
  ↓
Attention Pooling → (B, 512)    +    Prosodic Features (13D)
                                          ↓
                                    MLP Encoder → (B, 64)
  ↓─────────────────────────────────────────────┘
Fusion → (B, 576) → Dense(256) → Dense(128)
  ↓
┌─────────────┬─────────────┬────────────┬────────────┬────────────┐
│  Emotion    │ Confidence  │  Pitch     │  Fluency   │  Energy    │
│  (6 class)  │  Score 0-1  │  Stab 0-1  │  Score 0-1 │  Score 0-1 │
└─────────────┴─────────────┴────────────┴────────────┴────────────┘
```

---

## 📁 Files in This Folder
| File | What it does |
|------|-------------|
| `colab_part1_setup.py` | Install libs, download RAVDESS + CREMA-D, extract features |
| `colab_part2_model.py` | Dataset class + CNN+BiLSTM model architecture + loss |
| `colab_part3_training.py` | Training loop + evaluation + confusion matrix |
| `colab_part4_inference_gemini.py` | Inference on new audio + Whisper + Gemini coach |

---

## 🚀 Step-by-Step Colab Instructions

### STEP 0 — Before anything
1. Go to [colab.research.google.com](https://colab.research.google.com)
2. `Runtime` → `Change Runtime Type` → Select **T4 GPU**
3. Click **Connect**

---

### STEP 1 — Install Dependencies (Cell 1)
```python
!pip install -q torch torchaudio librosa soundfile
!pip install -q parselmouth-praat scikit-learn
!pip install -q matplotlib seaborn tqdm pandas numpy
!pip install -q google-generativeai openai-whisper
```
⏱️ Takes ~2 min

---

### STEP 2 — Download RAVDESS (Cell 3)
```python
!mkdir -p /content/data/ravdess
!wget -q --show-progress \
  "https://zenodo.org/record/1188976/files/Audio_Speech_Actors_01-24.zip" \
  -O /content/data/ravdess/ravdess.zip
!cd /content/data/ravdess && unzip -q ravdess.zip -d . && rm ravdess.zip
```
⏱️ ~3-4 min | Size: ~200MB

---

### STEP 3 — Download CREMA-D (Cell 4)
```python
!git clone --depth=1 https://github.com/CheyneyComputerScience/CREMA-D.git \
  /content/data/cremad/repo
```
⏱️ ~3 min | Size: ~600MB

---

### STEP 4 — Run Part 1 (Cells 2-9)
- Parses both datasets
- Derives confidence/pitch/fluency/energy labels
- Extracts 13 prosodic features per file
- **This takes ~10-15 min** (librosa + parselmouth on 8800 files)
- Saves checkpoint: `/content/dataset_with_features.csv`

---

### STEP 5 — Run Part 2 (Cells 10-14)
- Defines `AudioDataset` class (Mel spectrogram loading)
- Builds the full CNN + BiLSTM + Attention model
- Does a sanity shape check (should print ✅ Forward pass OK!)
- Creates train/val dataloaders

---

### STEP 6 — Run Training (Cells 15-16) ← THE BIG ONE
```
~20 epochs × ~200 batches = ~1–1.5 hours on T4
```
What's happening:
- Mixed precision training (AMP) for speed
- OneCycleLR scheduler (warmup → peak → cosine decay)
- Gradient clipping (max_norm=1.0)
- Uncertainty-weighted multi-task loss
- Saves best model to `/content/best_model.pth`

Live output per epoch:
```
── Epoch [3/20] ────────────────────────────────
   Train  → Loss: 1.2341 | Acc: 0.6230
   Val    → Loss: 1.1892 | Acc: 0.6450
   MAE    → Conf: 0.082 | Pitch: 0.071 | Fluency: 0.065 | Energy: 0.079
   💾 Best model saved!
```

---

### STEP 7 — Evaluate (Cells 17-18)
- Plots training curves (loss, accuracy, 4 MAE scores)
- Confusion matrix (counts + normalized)
- Full classification report

Expected final results on T4:
| Metric | Expected |
|--------|---------|
| Emotion Accuracy | 65–75% |
| Confidence MAE | < 0.08 |
| Pitch MAE | < 0.07 |
| Fluency MAE | < 0.07 |
| Energy MAE | < 0.08 |

---

### STEP 8 — Inference + Gemini (Cells 19-23)
1. Get a Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Replace `YOUR_GEMINI_API_KEY_HERE` in Cell 23
3. Upload your audio file (Cell 24 has upload helper)
4. Get full analysis:

```
═══════════════════════════════════════════════════════
   🎤 AUDIO CONFIDENCE ANALYSIS REPORT
═══════════════════════════════════════════════════════

🧠 Detected Emotion  : NEUTRAL

📊 SCORE BREAKDOWN:
   Confidence       : [█████████████░░░░░░░] 65.4/100
   Pitch Stability  : [████████████████░░░░] 80.2/100
   Fluency          : [███████████░░░░░░░░░] 57.3/100
   Energy/Clarity   : [████████████░░░░░░░░] 62.1/100

🤖 GEMINI AI COMMUNICATION COACH
⭐ Overall Rating: 6/10
📝 Summary: ...
✅ Strengths: ...
🔧 Areas to Improve: ...
🎭 Tone: Too soft — needs more assertiveness in interviews
📖 English Quality: 7/10 | Filler Words: ["um", "like", "you know"]
✨ Improved Answer: "In my previous role, I led a team of 5 engineers..."
```

---

## 🧠 Why CNN + BiLSTM (vs HuBERT / plain CNN / plain RNN)

| | Plain CNN | Plain RNN | **CNN+BiLSTM** | HuBERT |
|---|---|---|---|---|
| Catches spectral patterns | ✅ | ❌ | ✅ | ✅ |
| Catches temporal dynamics | ❌ | ✅ | ✅ | ✅ |
| Params | ~2M | ~5M | **~4.5M** | 170M |
| T4 train time | 20 min | 45 min | **~90 min** | 3+ hrs |
| Accuracy on 8K clips | 60% | 62% | **~70%** | ~73% |
| Interpretable | ✅ | ✅ | ✅ | ❌ |

---

## 📊 Dataset Info

| Dataset | Clips | Actors | Emotions | Label |
|---------|-------|--------|----------|-------|
| RAVDESS | 1,440 | 24 | 8 (calm merged into neutral) | emotion + intensity |
| CREMA-D | 7,442 | 91 | 6 emotions | emotion only |
| **Total** | **~8,882** | **115** | **6 shared emotions** | |

Emotions used: `angry, disgust, fearful, happy, neutral, sad`

---

## 🛠️ Troubleshooting

**OOM Error (Out of Memory)**
→ Reduce `BATCH_SIZE = 32` to `16` in Cell 10

**Parselmouth not working**
```python
!pip install -q praat-parselmouth
import parselmouth
```

**CREMA-D download slow**
→ Alternative: Download from Kaggle dataset "CREMA-D Audio Emotions"

**Whisper too slow**
→ Use `whisper.load_model("tiny")` instead of `"base"`

**Gemini API rate limit**
→ Add `time.sleep(2)` between Gemini calls
