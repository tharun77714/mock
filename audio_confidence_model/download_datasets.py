"""
download_datasets.py
Downloads RAVDESS and CREMA-D into ./datasets/
Run once before training.
"""

import os
import sys
import zipfile
import subprocess
import urllib.request
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE       = Path(__file__).parent
DATASETS   = BASE / "datasets"
RAVDESS_DIR = DATASETS / "ravdess"
CREMAD_DIR  = DATASETS / "cremad"

RAVDESS_URL = "https://zenodo.org/record/1188976/files/Audio_Speech_Actors_01-24.zip"
CREMAD_REPO = "https://github.com/CheyneyComputerScience/CREMA-D.git"

# ── Progress bar helper ────────────────────────────────────────────────────────
def _progress(block_num, block_size, total_size):
    downloaded = block_num * block_size
    pct = min(downloaded * 100 / total_size, 100) if total_size > 0 else 0
    bar = int(pct / 2)
    print(f"\r  [{'█' * bar}{'░' * (50 - bar)}] {pct:5.1f}%", end="", flush=True)

# ── RAVDESS ────────────────────────────────────────────────────────────────────
def download_ravdess():
    wav_files = list(RAVDESS_DIR.glob("**/*.wav"))
    if len(wav_files) >= 100:
        print(f"✅ RAVDESS already present  ({len(wav_files)} .wav files)  — skipping.")
        return

    RAVDESS_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = RAVDESS_DIR / "ravdess.zip"

    print("📥  Downloading RAVDESS  (~500 MB) ...")
    urllib.request.urlretrieve(RAVDESS_URL, zip_path, reporthook=_progress)
    print()  # newline after progress bar

    print("📦  Extracting RAVDESS ...")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(RAVDESS_DIR)
    zip_path.unlink()

    found = list(RAVDESS_DIR.glob("**/*.wav"))
    print(f"✅  RAVDESS ready  ({len(found)} files)")

# ── CREMA-D ────────────────────────────────────────────────────────────────────
def download_cremad():
    repo_path  = CREMAD_DIR / "repo"
    audio_path = repo_path / "AudioWAV"
    wav_files  = list(audio_path.glob("*.wav")) if audio_path.exists() else []

    if len(wav_files) >= 100:
        print(f"✅ CREMA-D already present  ({len(wav_files)} .wav files)  — skipping.")
        return

    CREMAD_DIR.mkdir(parents=True, exist_ok=True)
    print("📥  Cloning CREMA-D  (~1–1.5 GB, ~3–5 min) ...")
    result = subprocess.run(
        ["git", "clone", "--depth=1", CREMAD_REPO, str(repo_path)],
        capture_output=False
    )
    if result.returncode != 0:
        print("❌  git clone failed. Make sure Git is installed and in your PATH.")
        print("    Download Git from: https://git-scm.com/download/win")
        sys.exit(1)

    found = list(audio_path.glob("*.wav"))
    print(f"✅  CREMA-D ready  ({len(found)} files)")

# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  Dataset Downloader")
    print(f"  Target folder: {DATASETS.resolve()}")
    print("=" * 60)

    DATASETS.mkdir(parents=True, exist_ok=True)

    download_ravdess()
    print()
    download_cremad()

    print()
    print("=" * 60)
    # Final count
    ravdess_count = len(list(RAVDESS_DIR.glob("**/*.wav")))
    cremad_count  = len(list((CREMAD_DIR / "repo" / "AudioWAV").glob("*.wav")))
    print(f"  RAVDESS : {ravdess_count:,} files")
    print(f"  CREMA-D : {cremad_count:,} files")
    print(f"  Total   : {ravdess_count + cremad_count:,} files")
    print("=" * 60)
    print("🎉  All done! Run the notebook next.")
