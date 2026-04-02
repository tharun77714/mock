# MockMate — Startup Guide

## Every Time You Want to Run the App

### Terminal 1 — Python AI Server (Port 8000)
```powershell
cd C:\Users\Kotha\Desktop\dl\api
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2 — Next.js Frontend (Port 3000)
```powershell
cd C:\Users\Kotha\Desktop\dl\web
npm run dev
```

Then open: http://localhost:3000

---

## Check Server is Running

Open http://localhost:8000 — you should see:
```json
{
  "status": "MockMate AI API is running",
  "voice_model_loaded": true,
  "emotion_model_loaded": true
}
```

---

## Common Errors

| Error | Fix |
|-------|-----|
| `venv\Scripts\Activate` not found | Use `.\venv\Scripts\Activate.ps1` (not `cd`) |
| `No module named 'torch'` | Run: `.\venv\Scripts\pip install torch torchvision torchaudio` |
| Voice model not loaded | Make sure `best_model.pth` is inside `dl/api/` |
| Port 8000 in use | `netstat -ano \| findstr 8000` then `taskkill /PID <id> /F` |
| MongoDB error | Whitelist your IP in MongoDB Atlas → Network Access |
| Gemini error | Check your API key in `.env.local` (do not commit it) |
| Video not visible on another PC | Add **`SUPABASE_SERVICE_ROLE_KEY`** to `web/.env.local` and create Storage bucket **`interviews`** (see `ARCHITECTURE.md`) |

---

## Supabase (interview video + audio in the cloud)

1. In [Supabase](https://supabase.com) → **Storage** → create bucket **`interviews`** (or set `SUPABASE_INTERVIEWS_BUCKET`).
2. For simple playback in the app, set the bucket to **public** (or use signed URLs later).
3. In **Project Settings → API**, copy **`service_role`** (secret) into **`web/.env.local`** as:
   - `SUPABASE_SERVICE_ROLE_KEY=...`  
   **Never** put this key in `NEXT_PUBLIC_*` or client code.
4. Restart Next.js and FastAPI after editing env. Python reads the same `web/.env.local` via `python-dotenv`.

See **`ARCHITECTURE.md`** for the full pipeline (Next → Storage → MongoDB → FastAPI).

---

## First Time Setup (One-time only)

```powershell
# Setup Python venv
cd C:\Users\Kotha\Desktop\dl\api
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install torch torchvision torchaudio

# Setup Next.js
cd C:\Users\Kotha\Desktop\dl\web
npm install
```

---

## Project Structure

```
dl/
├── .env.local           ← API keys (do not share!)
├── best_model.pth       ← Trained voice model (backup)
├── api/
│   ├── main.py          ← FastAPI server (EfficientNet + CNN+BiLSTM + Gemini)
│   ├── best_model.pth   ← CNN+BiLSTM voice model (active)
│   ├── mockmate_efficientnet_b0.pt  ← Face emotion model
│   └── venv/            ← Python environment
├── web/                 ← Next.js app
└── audio_confidence_model/
    └── Full_Voice_Confidence_Model.ipynb  ← Training notebook (run in Colab)
```

---

## AI Pipeline

```
Interview ends
    → video + transcript sent to Next.js
    → Next.js calls FastAPI /process
    → FastAPI runs:
        1. EfficientNet-B0    → face emotion analysis
        2. ffmpeg             → extracts audio from video
        3. CNN+BiLSTM         → voice confidence/pitch/fluency/energy
        4. Gemini 1.5 Flash   → 3 personalized coaching suggestions
    → Results saved to MongoDB
    → User sees results page
```
