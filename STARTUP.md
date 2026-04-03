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

## Google sign-in for teammates (authorization / “blocked” errors)

Your app **does** allow new users (first Google login creates a MongoDB user). If a friend sees **Google authorization** or **Access blocked**, it is usually **Google Cloud OAuth**, not missing signup:

1. **OAuth consent screen is in “Testing”** — Only emails listed under **Test users** can sign in. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **OAuth consent screen** → add each collaborator’s Google email under **Test users**, or **Publish** the app (may require verification for sensitive scopes).
2. **Redirect URI** — Under **Credentials** → your OAuth 2.0 Client → **Authorized redirect URIs** must include exactly:
   - `http://localhost:3000/api/auth/callback/google` (and your production URL if deployed).
   If someone uses `http://127.0.0.1:3000`, add that variant too or always use `localhost`.
3. **MongoDB Atlas** — **Network Access** must allow the friend’s IP (or `0.0.0.0/0` for dev). If MongoDB fails during sign-in, login can fail after Google succeeds.

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
| Gemini quota / rate limits | Add free **`GROQ_API_KEY`** from [Groq](https://console.groq.com/keys) to `web/.env.local` — interview context tries **Groq → OpenAI → Gemini**. `pip install openai` in the API venv. |
| Gemini error | Check `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local` (do not commit it) |
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
