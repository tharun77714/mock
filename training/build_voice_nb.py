"""Generate Voice_Confidence_Wav2Vec2_Colab.ipynb (heavy DL version)."""
import json

cells = []

def md(text):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": [line + "\n" for line in text.strip().split("\n")]})

def code(text):
    cells.append({"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": [line + "\n" for line in text.strip().split("\n")]})

md(r"""
# Voice Confidence — **Heavy** Deep Learning Pipeline (Colab)

This is a **serious** fine-tuning setup (not a toy script):

| Component | What you get |
|-----------|----------------|
| **Backbone** | `facebook/wav2vec2-large` (~**317M** params) — self-supervised speech representations, SOTA-class for many audio tasks |
| **Data** | **RAVDESS** (~1.4k speech clips) + optional **TESS** (~2.8k) from Kaggle → **~4k+ clips** merged |
| **Augmentation** | Gaussian noise + random gain + time shift on **training** audio (reduces overfitting) |
| **Imbalance** | **Class-weighted** cross-entropy (weighted loss) |
| **Schedule** | **Two-phase training**: frozen encoder warmup → **unfreeze CNN front-end** + lower LR |
| **Metrics** | Accuracy, macro-F1, **plots**: train/val curves, confusion (counts + %), per-class P/R/F1 |

## Honest scope (write this in your report)
- Labels are a **proxy**: emotion in speech → mapped to **low / medium / high “vocal confidence”**. True “interview confidence” needs your own labeled interview audio.
- Even with more data, this is still **research-grade fine-tuning** of a **large pretrained transformer** — that **is** real deep learning.

## Prerequisites
1. **GPU:** Runtime → Change runtime type → **T4 / L4 / A100** (Large model needs VRAM; T4 works with small batches).
2. **Time:** ~**1.5–3 hours** depending on GPU and optional TESS.
3. **Optional TESS:** For ~2× data, run the **Kaggle upload** cell and download `tess` (free Kaggle account + API token).

## Output
- Saves `voice_confidence_wav2vec2_large.pt` and **auto-downloads** at the end.
""")

md(r"""
## 1) Install dependencies
- **transformers / datasets / accelerate:** Hugging Face stack + Trainer
- **torchaudio / librosa:** load + resample to 16 kHz (Wav2Vec2 standard)
- **evaluate:** metrics
- **seaborn:** plots
""")

code(r"""!pip install -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
!pip install -q "transformers>=4.40.0" "datasets>=2.19.0" accelerate evaluate scikit-learn
!pip install -q librosa soundfile matplotlib seaborn tqdm kaggle""")

md(r"""
## 2) Imports, device, seed
""")

code(r"""import os
import random
import numpy as np
import torch
import torch.nn.functional as F
import librosa
import matplotlib.pyplot as plt
import seaborn as sns
from glob import glob

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
    accuracy_score,
    f1_score,
), accuracy_score, f1_score
from sklearn.utils.class_weight import compute_class_weight

from datasets import Dataset, Audio
from transformers import (
    Wav2Vec2FeatureExtractor,
    Wav2Vec2ForSequenceClassification,
    TrainingArguments,
    Trainer,
)

SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
torch.cuda.manual_seed_all(SEED)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Device:", device)
if device.type == "cuda":
    print("GPU:", torch.cuda.get_device_name(0), "| VRAM GB:", round(torch.cuda.get_device_properties(0).total_memory / 1e9, 2))
else:
    print("CPU only — expect very slow training.")""")

md(r"""
## 3) Download **RAVDESS** (Zenodo, public)
Speech-only actors 01–24. Filename encodes emotion in the **3rd** `-` separated field (`01`…`08`).
""")

code(r"""import subprocess

DATA_ROOT = "/content/ravdess"
os.makedirs(DATA_ROOT, exist_ok=True)

ZIP_URL = "https://zenodo.org/records/1188976/files/Audio_Speech_Actors_01-24.zip?download=1"
ZIP_PATH = os.path.join(DATA_ROOT, "Audio_Speech_Actors_01-24.zip")

if not glob(os.path.join(DATA_ROOT, "**", "*.wav"), recursive=True):
    print("Downloading RAVDESS …")
    subprocess.run(["wget", "-q", "-O", ZIP_PATH, ZIP_URL], check=True)
    subprocess.run(["unzip", "-q", "-o", ZIP_PATH, "-d", DATA_ROOT], check=True)
else:
    print("RAVDESS already present.")

def ravdess_emotion_code(path: str) -> int:
    base = os.path.basename(path).replace(".wav", "")
    return int(base.split("-")[2])

def emotion_to_conf_3class(emotion_code: int) -> int:
    # 0=low 1=medium 2=high  (proxy)
    if emotion_code in (1, 2, 3):
        return 2
    if emotion_code == 8:
        return 1
    if emotion_code in (4, 5, 6, 7):
        return 0
    raise ValueError(emotion_code)

paths, labels = [], []
for p in sorted(glob(os.path.join(DATA_ROOT, "**", "*.wav"), recursive=True)):
    try:
        paths.append(p)
        labels.append(emotion_to_conf_3class(ravdess_emotion_code(p)))
    except Exception:
        pass

print("RAVDESS clips:", len(paths), "| class counts:", {i: labels.count(i) for i in (0, 1, 2)})""")

md(r"""
## 4) **Optional: TESS** — roughly doubles dataset

**Why Kaggle sometimes fails:** Wrong dataset name, or you must **open the dataset once in the browser** and click **Download / Accept** so your account is allowed to use it via API.

**This notebook gives you 3 paths:**

| Mode | What you do |
|------|-------------|
| **`TESS_MODE = "hf"`** | **Recommended.** Loads TESS from **Hugging Face Parquet** (`Bill13579/TESS-mirror`) — **no script / no `trust_remote_code`**, no Kaggle. |
| **`TESS_MODE = "kaggle"`** | Upload `kaggle.json` when prompted; downloads **`ejlok1/toronto-emotional-speech-set-tess`** (correct slug on Kaggle). |
| **`TESS_MODE = "none"`** | RAVDESS only. |

If **Kaggle** is used and fails, the code **automatically falls back** to the Hugging Face TESS loader.

3-class mapping (same proxy as RAVDESS): neutral + happiness → high; pleasant surprise → medium; anger, disgust, fear, sadness → low.
""")

code(r"""import subprocess
from google.colab import files
from datasets import load_dataset

# "none" | "hf" | "kaggle"
TESS_MODE = "hf"

FOLDER_TO_LAB = {
    "happy": 2,
    "happiness": 2,
    "neutral": 2,
    "pleasant_surprise": 1,
    "surprised": 1,
    "ps": 1,
    "fear": 0,
    "fearful": 0,
    "sad": 0,
    "sadness": 0,
    "angry": 0,
    "anger": 0,
    "disgust": 0,
}

CORRECT_KAGGLE_SLUG = "ejlok1/toronto-emotional-speech-set-tess"


def tess_emotion_name_to_label(name: str) -> int:
    # Works for plain emotion names and Bill13579 labels like OAF_happy, YAF_pleasant_surprised
    t = name.lower()
    if "happy" in t or "neutral" in t:
        return 2
    if "pleasant" in t or "surprise" in t:
        return 1
    return 0


def merge_tess_from_kaggle_zip():
    os.makedirs("/content/tess_zip", exist_ok=True)
    subprocess.run(
        ["kaggle", "datasets", "download", "-d", CORRECT_KAGGLE_SLUG, "-p", "/content/tess_zip"],
        check=True,
    )
    os.makedirs("/content/tess_data", exist_ok=True)
    z = glob("/content/tess_zip/*.zip")
    if not z:
        raise FileNotFoundError("No zip after kaggle download")
    subprocess.run(["unzip", "-q", "-o", z[0], "-d", "/content/tess_data"], check=True)
    n0 = len(paths)
    for wav in glob("/content/tess_data/**/*.wav", recursive=True):
        key = os.path.basename(os.path.dirname(wav)).lower().replace(" ", "_")
        if key not in FOLDER_TO_LAB:
            continue
        paths.append(wav)
        labels.append(FOLDER_TO_LAB[key])
    print("TESS (Kaggle zip): added", len(paths) - n0, "files. Total clips:", len(paths))


def merge_tess_from_huggingface():
    import soundfile as sf

    # Parquet mirror — no custom tess.py (myleslinder/tess is deprecated in datasets>=3.x)
    print("Loading TESS: Hugging Face Bill13579/TESS-mirror (Parquet, no trust_remote_code) …")
    ds = load_dataset("Bill13579/TESS-mirror", split="train")
    print("Columns:", ds.column_names)

    lab_col = None
    for c in ("label", "labels", "emotion", "Label"):
        if c in ds.column_names:
            lab_col = c
            break
    if lab_col is None:
        raise ValueError("No label column in dataset: " + str(ds.column_names))

    audio_col = "audio" if "audio" in ds.column_names else None
    if audio_col is None:
        raise ValueError("No audio column in dataset: " + str(ds.column_names))

    lab_feature = ds.features[lab_col]

    cache = "/content/tess_hf_cache"
    os.makedirs(cache, exist_ok=True)
    n0 = len(paths)

    for i in range(len(ds)):
        ex = ds[i]
        raw = ex[lab_col]
        if isinstance(raw, str):
            s = raw
        else:
            s = lab_feature.int2str(int(raw))
        lab = tess_emotion_name_to_label(s)

        aud = ex[audio_col]
        pth = None
        arr = None
        sr = 16_000
        if isinstance(aud, dict):
            pth = aud.get("path")
            arr = aud.get("array")
            sr = int(aud.get("sampling_rate", 16_000))
        else:
            arr = aud

        if pth and os.path.isfile(pth):
            paths.append(pth)
            labels.append(lab)
        elif arr is not None:
            pth = os.path.join(cache, f"{i:05d}.wav")
            if isinstance(arr, np.ndarray):
                wav = arr.astype(np.float32).flatten()
            else:
                wav = np.concatenate([np.atleast_1d(np.asarray(a, dtype=np.float32)) for a in arr])
            sf.write(pth, wav, sr)
            paths.append(pth)
            labels.append(lab)

    print("TESS (Hugging Face Parquet): added", len(paths) - n0, "files. Total clips:", len(paths))


if TESS_MODE == "none":
    print("TESS_MODE=none — RAVDESS only. Total clips:", len(paths))
elif TESS_MODE == "hf":
    try:
        merge_tess_from_huggingface()
        print("Class counts:", {i: labels.count(i) for i in (0, 1, 2)})
    except Exception as ex:
        print("HF TESS failed:", repr(ex), "— continuing RAVDESS only.")
elif TESS_MODE == "kaggle":
    print("=" * 60)
    print("Upload kaggle.json (Kaggle → Settings → API). Open dataset page once & accept rules if asked:")
    print("https://www.kaggle.com/datasets/ejlok1/toronto-emotional-speech-set-tess")
    print("Or Cancel to skip TESS.")
    print("=" * 60)
    uploaded = files.upload()
    if not uploaded:
        print("No upload — trying Hugging Face TESS fallback …")
        try:
            merge_tess_from_huggingface()
        except Exception as ex:
            print("HF fallback failed:", repr(ex))
    else:
        kdir = os.path.expanduser("~/.kaggle")
        os.makedirs(kdir, exist_ok=True)
        dest = os.path.join(kdir, "kaggle.json")
        for name, data in uploaded.items():
            with open(dest, "wb") as f:
                f.write(data)
        os.chmod(dest, 0o600)
        try:
            merge_tess_from_kaggle_zip()
        except Exception as ex:
            print("Kaggle TESS failed:", repr(ex))
            print("Trying Hugging Face TESS …")
            try:
                merge_tess_from_huggingface()
            except Exception as ex2:
                print("HF also failed:", repr(ex2), "— RAVDESS only.")
    print("Class counts:", {i: labels.count(i) for i in (0, 1, 2)})
else:
    print("Unknown TESS_MODE — use none | hf | kaggle")""")

md(r"""
## 5) Stratified train / val split
""")

code(r"""assert len(paths) > 100, "Too few samples — check downloads."

id2label = {0: "low_confidence", 1: "medium_confidence", 2: "high_confidence"}
label2id = {v: k for k, v in id2label.items()}

train_paths, val_paths, train_labels, val_labels = train_test_split(
    paths, labels, test_size=0.15, random_state=SEED, stratify=labels
)

train_ds = Dataset.from_dict({"audio": train_paths, "labels": train_labels})
val_ds = Dataset.from_dict({"audio": val_paths, "labels": val_labels})
train_ds = train_ds.cast_column("audio", Audio(sampling_rate=16_000))
val_ds = val_ds.cast_column("audio", Audio(sampling_rate=16_000))

print("Train:", len(train_ds), "Val:", len(val_ds))""")

md(r"""
## 6) **Wav2Vec2-Large** + preprocessing

- **Model:** `facebook/wav2vec2-large` — much larger than `base`.
- **Max clip:** 6 s @ 16 kHz (truncate longer clips).
- **Train-only augmentation** in `preprocess_train` (noise / gain / shift).
""")

code(r"""MODEL_ID = "facebook/wav2vec2-large"

feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(MODEL_ID)

model = Wav2Vec2ForSequenceClassification.from_pretrained(
    MODEL_ID,
    num_labels=3,
    label2id=label2id,
    id2label=id2label,
    ignore_mismatched_sizes=True,
)

model.freeze_feature_encoder()

MAX_SECONDS = 6.0
MAX_LEN = int(16_000 * MAX_SECONDS)

rng = np.random.default_rng(SEED)


def augment_waveform(x: np.ndarray) -> np.ndarray:
    # Lightweight waveform augmentations for training only
    x = x.copy()
    if rng.random() < 0.4:
        x = x * float(rng.uniform(0.85, 1.15))
    if rng.random() < 0.4:
        shift = int(rng.integers(-1600, 1600))
        x = np.roll(x, shift)
    if rng.random() < 0.5:
        noise = rng.normal(0, 0.015, size=x.shape).astype(np.float32)
        x = np.clip(x + noise, -1.0, 1.0)
    return x.astype(np.float32)


def preprocess_batch(batch, augment: bool):
    audios = []
    for item in batch["audio"]:
        arr = np.asarray(item["array"], dtype=np.float32)
        sr = item["sampling_rate"]
        if sr != 16_000:
            arr = librosa.resample(arr, orig_sr=sr, target_sr=16_000)
        if len(arr) > MAX_LEN:
            arr = arr[:MAX_LEN]
        if augment:
            arr = augment_waveform(arr)
        audios.append(arr)
    inputs = feature_extractor(
        audios,
        sampling_rate=16_000,
        padding="longest",
        return_tensors="np",
    )
    batch["input_values"] = inputs.input_values
    batch["attention_mask"] = inputs.attention_mask
    return batch


def preprocess_train(batch):
    return preprocess_batch(batch, augment=True)


def preprocess_eval(batch):
    return preprocess_batch(batch, augment=False)


train_ds = train_ds.map(preprocess_train, batched=True, batch_size=16, remove_columns=["audio"])
val_ds = val_ds.map(preprocess_eval, batched=True, batch_size=16, remove_columns=["audio"])

# Class weights (inverse frequency, normalized)
y_train = np.array(train_labels)
classes = np.array([0, 1, 2])
weights = compute_class_weight(class_weight="balanced", classes=classes, y=y_train)
class_weights_tensor = torch.tensor(weights, dtype=torch.float32)
print("Class weights:", dict(zip([0, 1, 2], weights.tolist())))""")

md(r"""
## 7) Weighted loss + metrics + **two-phase** Trainer

Phase A: encoder **frozen** (faster, stable head).  
Phase B: encoder **unfrozen**, smaller LR (full fine-tune).
""")

code(r"""import evaluate as hf_evaluate

accuracy_metric = hf_evaluate.load("accuracy")
f1_metric = hf_evaluate.load("f1")


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    return {
        "accuracy": accuracy_metric.compute(predictions=preds, references=labels)["accuracy"],
        "f1_macro": f1_metric.compute(predictions=preds, references=labels, average="macro")["f1"],
    }


class WeightedTrainer(Trainer):
    def __init__(self, class_weights, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.class_weights = class_weights

    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits
        w = self.class_weights.to(logits.device)
        loss = F.cross_entropy(logits, labels, weight=w)
        return (loss, outputs) if return_outputs else loss


common_args = dict(
    output_dir="/content/wav2vec2_conf_large",
    eval_strategy="epoch",
    save_strategy="epoch",
    per_device_train_batch_size=2,
    per_device_eval_batch_size=2,
    gradient_accumulation_steps=8,
    warmup_ratio=0.08,
    logging_steps=20,
    load_best_model_at_end=True,
    metric_for_best_model="f1_macro",
    greater_is_better=True,
    fp16=torch.cuda.is_available(),
    report_to="none",
    save_total_limit=2,
    dataloader_num_workers=0,
)

# -------- Phase A: frozen encoder --------
args_a = TrainingArguments(
    learning_rate=8e-5,
    num_train_epochs=8,
    **common_args,
)

trainer_a = WeightedTrainer(
    class_weights=class_weights_tensor,
    model=model,
    args=args_a,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    compute_metrics=compute_metrics,
    tokenizer=None,
)

print("=== PHASE A: frozen feature encoder ===")
trainer_a.train()

# -------- Phase B: unfreeze encoder --------
model.unfreeze_feature_encoder()

args_b = TrainingArguments(
    learning_rate=4e-6,
    num_train_epochs=6,
    **common_args,
)

trainer_b = WeightedTrainer(
    class_weights=class_weights_tensor,
    model=model,
    args=args_b,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    compute_metrics=compute_metrics,
    tokenizer=None,
)

print("=== PHASE B: full model fine-tune ===")
trainer_b.train()

trainer = trainer_b""")

md(r"""
## 7b) Training & validation curves (from Trainer logs)

Uses `trainer_a.state.log_history + trainer_b.state.log_history` to plot:
- Training loss (per logging step)
- Validation loss, accuracy, macro-F1 (per epoch)
""")

code(r"""full_log = trainer_a.state.log_history + trainer_b.state.log_history

train_losses, train_steps = [], []
eval_epochs, eval_losses, eval_acc, eval_f1 = [], [], [], []

for i, entry in enumerate(full_log):
    if "loss" in entry and "eval_loss" not in entry:
        train_losses.append(entry["loss"])
        train_steps.append(entry.get("step", i))
    if "eval_loss" in entry:
        eval_epochs.append(entry.get("epoch", len(eval_epochs)))
        eval_losses.append(entry["eval_loss"])
        eval_acc.append(entry.get("eval_accuracy", 0))
        eval_f1.append(entry.get("eval_f1_macro", 0))

fig1, axes = plt.subplots(2, 1, figsize=(10, 8))
if train_steps and train_losses:
    axes[0].plot(train_steps, train_losses, color="#2563eb", linewidth=1.2, label="train loss")
    axes[0].set_xlabel("Global step")
    axes[0].set_ylabel("Loss")
    axes[0].set_title("Training loss (both phases)")
    axes[0].grid(True, alpha=0.3)
    axes[0].legend()

if eval_epochs:
    ax2 = axes[1]
    ax2.plot(eval_epochs, eval_losses, "o-", color="#dc2626", label="val loss")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Eval loss")
    ax2b = ax2.twinx()
    ax2b.plot(eval_epochs, eval_acc, "s-", color="#059669", label="val accuracy")
    ax2b.plot(eval_epochs, eval_f1, "^-", color="#d97706", label="val macro F1")
    ax2.set_title("Validation metrics per epoch")
    ax2.grid(True, alpha=0.3)
    lines = ax2.get_lines() + ax2b.get_lines()
    ax2.legend(lines, [l.get_label() for l in lines], loc="lower right", fontsize=8)

plt.tight_layout()
plt.savefig("/content/training_validation_curves.png", dpi=150)
plt.show()
print("Saved figure: /content/training_validation_curves.png")""")

md(r"""
## 8) Evaluation — metrics tables + graphs (validation set)

- Classification report (text)
- Confusion matrix (counts + **normalized %**)
- Per-class **precision / recall / F1** bar chart
""")

code(r"""preds_output = trainer.predict(val_ds)
y_pred = np.argmax(preds_output.predictions, axis=-1)
y_true = preds_output.label_ids
target_names = [id2label[i] for i in range(3)]

print(classification_report(y_true, y_pred, target_names=target_names))

precision, recall, f1_vec, support = precision_recall_fscore_support(
    y_true, y_pred, labels=[0, 1, 2], zero_division=0
)

fig2, axes2 = plt.subplots(1, 3, figsize=(14, 4))

cm = confusion_matrix(y_true, y_pred, labels=[0, 1, 2])
sns.heatmap(
    cm,
    annot=True,
    fmt="d",
    cmap="Blues",
    xticklabels=target_names,
    yticklabels=target_names,
    ax=axes2[0],
)
axes2[0].set_xlabel("Predicted")
axes2[0].set_ylabel("True")
axes2[0].set_title("Confusion matrix (counts)")

cm_norm = cm.astype(np.float64) / np.maximum(cm.sum(axis=1, keepdims=True), 1e-9)
sns.heatmap(
    cm_norm * 100,
    annot=True,
    fmt=".1f",
    cmap="Greens",
    xticklabels=target_names,
    yticklabels=target_names,
    ax=axes2[1],
)
axes2[1].set_xlabel("Predicted")
axes2[1].set_ylabel("True")
axes2[1].set_title("Confusion matrix (row-normalized %)")

x = np.arange(len(target_names))
w = 0.25
axes2[2].bar(x - w, precision, w, label="Precision", color="#6366f1")
axes2[2].bar(x, recall, w, label="Recall", color="#14b8a6")
axes2[2].bar(x + w, f1_vec, w, label="F1", color="#f59e0b")
axes2[2].set_xticks(x)
axes2[2].set_xticklabels(target_names, rotation=15, ha="right")
axes2[2].set_ylim(0, 1.05)
axes2[2].set_title("Per-class validation scores")
axes2[2].legend(fontsize=8)
axes2[2].grid(True, axis="y", alpha=0.3)

plt.tight_layout()
plt.savefig("/content/validation_metrics_plots.png", dpi=150)
plt.show()
print("Saved figure: /content/validation_metrics_plots.png")

summary_tbl = {
    "precision_per_class": precision.tolist(),
    "recall_per_class": recall.tolist(),
    "f1_per_class": f1_vec.tolist(),
    "support_per_class": support.tolist(),
    "val_accuracy": float(accuracy_score(y_true, y_pred)),
    "val_macro_f1": float(f1_score(y_true, y_pred, average="macro")),
}
print("Summary:", summary_tbl)""")

md(r"""
## 9) Save + **download** checkpoint

File name reflects **large** model.
""")

code(r"""SAVE_PATH = "/content/voice_confidence_wav2vec2_large.pt"

payload = {
    "model_state_dict": trainer.model.state_dict(),
    "model_id": MODEL_ID,
    "num_labels": 3,
    "id2label": id2label,
    "label2id": label2id,
    "sample_rate": 16000,
    "max_seconds": MAX_SECONDS,
    "training": "two_phase_frozen_then_unfreeze_weighted_ce_augment",
    "datasets": "ravdess_plus_optional_tess",
    "notes": "3-class proxy from emotion labels; not ground-truth interview confidence",
}

torch.save(payload, SAVE_PATH)
print("Saved:", SAVE_PATH, "| MB:", round(os.path.getsize(SAVE_PATH) / 1e6, 2))

from google.colab import files
files.download(SAVE_PATH)
for fig_path in ("/content/training_validation_curves.png", "/content/validation_metrics_plots.png"):
    try:
        if os.path.isfile(fig_path):
            files.download(fig_path)
    except Exception as ex:
        print("Optional figure download skipped:", ex)
print("Browser download triggered (model + metric figures if present).")""")

md(r"""
## 10) One-shot inference demo (same as production)

Your FastAPI will: extract mono 16 kHz → truncate to `max_seconds` → `feature_extractor` → softmax.
""")

code(r"""trainer.model.eval()
sample_path = val_paths[0]
wave, sr = librosa.load(sample_path, sr=16_000, mono=True)
if len(wave) > MAX_LEN:
    wave = wave[:MAX_LEN]
inputs = feature_extractor(wave, sampling_rate=16_000, return_tensors="pt", padding=True)
inputs = {k: v.to(device) for k, v in inputs.items()}
with torch.no_grad():
    logits = trainer.model(**inputs).logits
probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]
print("Sample:", os.path.basename(sample_path))
for i, name in id2label.items():
    print(f"  {name}: {probs[i]*100:.1f}%")""")

nb = {
    "nbformat": 4,
    "nbformat_minor": 0,
    "metadata": {
        "accelerator": "GPU",
        "colab": {"gpuType": "T4", "provenance": []},
        "kernelspec": {"display_name": "Python 3", "name": "python3"},
        "language_info": {"name": "python"},
    },
    "cells": cells,
}

out = r"c:\Users\Kotha\Desktop\dl\training\Voice_Confidence_Wav2Vec2_Colab.ipynb"
with open(out, "w", encoding="utf-8") as f:
    json.dump(nb, f, ensure_ascii=False, indent=1)

print("Wrote:", out, "cells:", len(cells))
