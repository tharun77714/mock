# SYSTEM ARCHITECTURE & TECHNICAL DOCUMENTATION
**Project:** MockMate Full-Stack AI Interview Platform
**Document Type:** End-to-End System Architecture and Pipeline Trace
**Target Audience:** Senior System Architects & ML Engineers

---

## 🧠 1. SYSTEM OVERVIEW

**Project Goal:** 
To provide a high-fidelity, comprehensive mock interview and behavioral assessment platform that utilizes multi-modal AI (Video, Audio, and Text) to evaluate candidates and provide actionable, structured coaching.

**Core Features:**
*   **Real-time AI Conversational Interviews:** Dynamic, role-specific job interviews.
*   **Multi-Modal Analysis:** Evaluates facial expressions, eye contact, head stability, voice prosody, speech fluency, and textual content.
*   **4-Dimensional Behavioral Coaching:** LLM-driven feedback scoring Delivery, Non-Verbal Presence, Communication Clarity, and Content Quality.
*   **Smart Resume Analyzer:** AI-based resume parsing, skill matching, and gamified career scoring.

**Type of System:** 
Hybrid Full-Stack AI Web Application (Next.js Frontend + Python/FastAPI Deep Learning Backend).

**High-Level Architecture:**
The frontend (Next.js) handles UI, webcam/audio recording, and real-time interaction using conversational AI logic (e.g., Vapi). Once an interview concludes, the media and transcript are dispatched to the backend (FastAPI). The backend runs heavy synchronous ML workloads: OpenCV for visual heuristics, PyTorch for deep learning embeddings (EfficientNet, CNN+BiLSTM), and Praat for acoustic feature extraction. Extracted signals are passed to an LLM chain (Groq → OpenAI → Gemini) to generate structured coaching. Results are saved in MongoDB and displayed on a rich interactive dashboard.

---

## 🧱 2. COMPLETE ARCHITECTURE DIAGRAM (TEXT FORMAT)

```text
[ USER ] 
   │ (Webcam, Mic, Browser)
   ▼
[ NEXT.JS FRONTEND (React / App Router) ] 
   │  ├─ State Management & UI (Tailwind, Framer Motion)
   │  ├─ Media Capture (Records video/audio locally or via cloud)
   │  └─ Conversational Client (Vapi/WebSockets for real-time chat)
   │
   ▼ (HTTP POST /process via JSON: video_path, transcript, interview_id)
   │
[ FASTAPI BACKEND (Python ML Server) ]
   │
   ├─► 1. Video Module (OpenCV & PyTorch)
   │      ├─ Haarcascade: Face & Eye ROI detection, HoughCircles for Iris tracking.
   │      └─ EfficientNet-B0: Classifies 7 facial emotions per frame.
   │
   ├─► 2. Audio Extraction & Acoustic Module
   │      ├─ FFmpeg: Extracts 16kHz mono WAV.
   │      └─ Praat & Librosa: Extracts 13 prosodic features (pitch, jitter, shimmer, HNR, energy, ZCR).
   │
   ├─► 3. Deep Learning Voice Module (PyTorch)
   │      └─ CNN + BiLSTM + MLP Blend: Fuses Mel-Spectrogram and 13 prosodic features to predict Voice Confidence (0-1) and Emotion.
   │
   ├─► 4. Cloud Storage (Supabase)
   │      └─ Uploads WAV file for playback to `interviews` bucket.
   │
   └─► 5. LLM Coaching & NLP (Groq / OpenAI / Gemini)
          ├─ Filler Word & WPM heuristics.
          ├─ Behavioral LLM: Maps raw signals to 4D scores (Delivery, Non-Verbal, Clarity, Content).
          └─ Transcript LLM: Grades English grammar and provides vocabulary upgrades.
   │
   ▼ (Returns Comprehensive JSON Analysis Result)
   │
[ NEXT.JS API ROUTES ]
   │
   ▼ (Saves JSON to Database)
   │
[ MONGODB (Database) ]  <───> [ NEXT.JS DASHBOARD UI (Retrieves and Renders Visuals) ]
```

---

## ⚙️ 3. DETAILED PIPELINE (STEP-BY-STEP FLOW)

This is EXACTLY what happens from User Input to Final Output:

**Step 1: Context Generation (Pre-Interview)**
*   **Action:** User inputs Job Role, Company, and uploads Resume.
*   **Logic:** Frontend calls `POST /generate-interview-context`. Backend constructs a prompt and hits the LLM fallback chain (Groq → OpenAI → Gemini).
*   **Output:** A structured JSON playbook defining interviewer persona, technical questions, and evaluation criteria, fed into the real-time voice agent.

**Step 2: The Interview (Real-Time)**
*   **Action:** User talks to the AI. Frontend captures the webcam feed and maintains a running transcript of the STT (Speech-to-Text).

**Step 3: Submission & Resolution (Post-Interview)**
*   **Action:** Frontend uploads the video blob (to temporary storage or passes a URL) and calls `POST /process`.
*   **Logic:** Backend `resolve_local_video_path` downloads the file via `requests` to a temporary `.webm` or `.mp4` if a URL is provided.

**Step 4: Visual & Non-Verbal Analysis**
*   **Logic:** `analyze_video_with_model()` reads the video via OpenCV. Samples frames based on FPS (typically 1 fps). 
*   **Algorithms:** 
    *   Face bounds via Haarcascade → Head stability via bounding box movement vectors.
    *   Eye bounds via Haarcascade → Iris center via `cv2.HoughCircles` → Calculates Iris ratio (deviation from 0.5 center) for Eye Contact Score.
    *   Face crop is passed through `inference_transform` (normalize/resize) into `EfficientNet-B0` to predict the dominant emotion.

**Step 5: Audio Extraction & Prosody Analysis**
*   **Logic:** `extract_audio_from_video` spawns a subprocess running `ffmpeg` to strip audio into a temporary `16kHz WAV`.
*   **Praat Analysis (`extract_real_prosodic`):** Uses `parselmouth` to create a `Sound` object. Calculates exactly 13 features: `pitch_mean`, `pitch_std`, `pitch_range`, `pitch_stability`, `jitter`, `shimmer`, `hnr`, `energy_mean`, `energy_std`, `energy_range`, `zcr_mean`, `silence_ratio`, `duration`.

**Step 6: Neural Voice Inference**
*   **Logic:** The WAV is converted to a Mel-Spectrogram (Librosa/Torchaudio). Both the Spectrogram and the 13 Prosodic Features are passed into the `VoiceConfidenceModel`.
*   **Output:** A scalar `confidence_score` and a 6-class `voice_emotion`.

**Step 7: NLP & Text Metrics**
*   **Logic:** Transcript is parsed. Regex checks for known filler words (um, uh, like). WPM is calculated based on word count and audio duration.

**Step 8: LLM Behavioral Synthesis**
*   **Logic:** `get_behavioral_coaching()` compiles the OpenCV scores, PyTorch scores, and NLP metrics into a mega-prompt. 
*   **Generation:** Groq/Gemini generates a strict JSON object mapping these raw numbers into a 4-dimensional framework (Delivery, Non-Verbal, Clarity, Content) with actionable tips.

**Step 9: Data Persistence & UI Render**
*   **Logic:** Extracted audio is pushed to Supabase Storage via `supabase-py`. The final giant JSON object is returned to the frontend.
*   **Render:** Next.js `/api/interviews` saves the result to MongoDB. The user is redirected to `/interview/[id]`, which renders `ScoreRing` and `MetricCard` components.

---

## 🧬 4. AI / ML MODEL DETAILS

### Model 1: Facial Emotion Classifier
*   **Type:** CNN (EfficientNet-B0)
*   **Why:** Excellent trade-off between inference speed and accuracy on edge/CPU environments compared to ResNet50 or VGG16.
*   **Input Format:** 224x224 RGB image tensors, normalized (ImageNet stats).
*   **Output Format:** Logits over 7 classes (angry, disgust, fear, happy, neutral, sad, surprise).
*   **Training Pipeline:** Trained externally (Jupyter Notebooks). Preprocessing includes standard augmentations. Loss function: CrossEntropyLoss. 

### Model 2: Voice Confidence Predictor (Blended Architecture v2)
*   **Type:** Dual-branch CNN + BiLSTM + MLP Fusion
*   **Why:** Traditional CNNs on spectrograms capture phonetic features well, but miss macro-level acoustic metadata (like exact Jitter/Shimmer ratios). Fusing a deep representation with explicit acoustic data yields highly stable confidence metrics.
*   **Input Format:** 
    *   Branch 1: Mel-Spectrogram Tensor `(1, 1, 128, 94)`
    *   Branch 2: Scaled Prosodic Vector `(1, 13)`
*   **Output Format:** Confidence Float (0.0 to 1.0) via Sigmoid, and Emotion Logits (6 classes).
*   **Architecture Flow:** CNN extracts spatial audio features → Proj → BiLSTM captures temporal sequence → Attention pooling → Emotion Head. Concurrently, Prosodic vector → Dense layer. Blend MLP concatenates Emotion Probs + Prosodic Embeddings → Final Confidence.

---

## 🗄️ 5. DATABASE DESIGN

**Database Type:** NoSQL (MongoDB), accessed via Mongoose ORM.

**Collection 1: `users`**
*   `name` (String): Full name.
*   `email` (String, Unique): Login credential.
*   `role` (Enum): 'user', 'admin', 'guest'.
*   `resumeUrl`, `githubLink`, `linkedinLink`: Profile metadata.

**Collection 2: `interviews`**
*   `userId` (String): Relational link to User.
*   `transcript` (String): Stringified JSON of the conversation text.
*   `videoUrl`, `audioUrl` (String): Supabase/S3 object URLs.
*   `analysis` (Embedded Document): The massive JSON payload from the ML backend. 
    *   `overallScore` (Number)
    *   `behavioralSignals` (Mixed Object): The 4D LLM feedback.
    *   `voiceAnalysis` (Object): confidence_score, pitch, fluency, energy.
    *   `eyeContact`, `posture`, `headStability` (Objects with `score` and `label`).
    *   `fillerWords`, `speakingPace` (Text analytics).
*   `status` (Enum): 'pending', 'completed', 'failed'.

---

## 🔌 6. API DESIGN

### FastAPI Backend (`/api/main.py`)
1.  **`GET /`** 
    *   *Purpose:* Health check. Returns model load statuses.
2.  **`POST /process`**
    *   *Request:* `{"video_path": "url_or_path", "interview_id": "123", "transcript": "...", "user_id": "abc"}`
    *   *Response:* Complete Analysis JSON payload.
    *   *Auth:* Open (relies on Frontend API route shielding in production).
3.  **`POST /generate-interview-context`**
    *   *Request:* `{"jobRole": "SWE", "companyName": "Google", "resumeText": "..."}`
    *   *Response:* JSON Playbook for the Voice Agent.
4.  **`POST /api/analyze-resume`**
    *   *Request:* `multipart/form-data` containing PDF/Docx.
    *   *Response:* Parsed skills, job matches, gamification badges, and missing skills quests.

---

## 🧑💻 7. FRONTEND FLOW

*   **Framework:** Next.js (App Router).
*   **Pages:**
    *   `/dashboard`: Fetches user's `interviews` from MongoDB. Shows history.
    *   `/interview/new`: Form to select Job/Company, triggers `/generate-interview-context`.
    *   `/interview/[id]`: The actual interview taking place (Webcam UI, Vapi hooks).
    *   `/interview/[id]/page.tsx` (Summary Page): Fetches MongoDB data. Renders `ScoreRing` (SVG circular progress), `MetricCard` (Grid-based tailwind boxes), and maps through `analysis.behavioralSignals` to display the 4-dimension strengths/weaknesses.
*   **State Management:** Standard React Hooks (`useState`, `useEffect`). No Redux required.
*   **Communication:** Client components call Next.js API Routes (`/api/interviews`), which securely query MongoDB.

---

## 🧩 8. INTEGRATIONS

1.  **MongoDB:** Primary data store (URI via `.env.local`).
2.  **Supabase Storage:** Backend extracts audio via `ffmpeg` and uses `supabase-py` to `PUT` the `.wav` file into the `interviews` bucket. Returns a public URL stored in MongoDB.
3.  **Groq / OpenAI / Gemini:** AI LLM engines. Groq (Llama 3) is prioritized for free, ultra-fast JSON inference. Fallbacks to OpenAI/Gemini ensure 99.9% uptime for the coaching logic.
4.  **Vapi (Implicit):** Handles real-time Voice STT/TTS and latency management during the actual interview phase.

---

## 🚀 9. DEPLOYMENT ARCHITECTURE

*   **Frontend Hosting:** Vercel (Optimized for Next.js App Router, edge caching).
*   **Backend Hosting:** Render, AWS ECS, or DigitalOcean App Platform. (Requires Python environment with system dependencies: `ffmpeg`, `libsndfile1` for librosa, OpenCV dependencies like `libgl1`).
*   **Scaling Strategy:** The ML backend is highly synchronous and CPU-intensive. Scaling requires horizontal scaling of the backend behind a Load Balancer (e.g., Gunicorn workers with Uvicorn class).
*   **Environment Variables:** 
    *   `MONGODB_URI`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`
    *   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
    *   `NEXT_PUBLIC_API_URL` (Points to deployed FastAPI).

---

## 🛠️ 10. TECH STACK (EXPLICIT)

*   **Languages:** TypeScript, Python 3.9+
*   **Frontend Framework:** Next.js 14, React 18
*   **UI/Styling:** Tailwind CSS, Framer Motion, Lucide React
*   **Backend Framework:** FastAPI, Uvicorn, Pydantic
*   **Database & ORM:** MongoDB, Mongoose
*   **Machine Learning / Deep Learning:**
    *   PyTorch, Torchvision, Torchaudio (Neural Networks)
    *   OpenCV (`cv2`) (Computer Vision & Cascade Classifiers)
    *   Praat (`parselmouth`), Librosa (Audio Acoustic processing)
    *   Scikit-Learn (Implicit in scalers)
*   **Generative AI:** Google Generative AI SDK, OpenAI SDK (used for Groq routing too).
*   **System Tools:** FFmpeg (Subprocess media manipulation).

---

## 🧪 11. EDGE CASES & FAILURE HANDLING

1.  **FFmpeg Fails / No Audio:** Handled by returning `None`. Pipeline degrades gracefully and outputs default/neutral voice scores (0.5).
2.  **OpenCV Detects No Face:** Variables `frames_with_face` drops. Code checks `len(faces) == 0`, continues loop, and gracefully lowers `face_detection_rate`.
3.  **Praat Analysis Crashes:** Wrapped in `try/except`. If it fails, returns a fallback array: `[150.0, 20.0, 80.0, 0.5, 0.05, 0.05, 5.0, 0.01...]`.
4.  **LLM JSON Malformed:** `_parse_json_object_from_text` extracts JSON explicitly using `{` and `}` indexes. If Groq fails, fallback array hits OpenAI, then Gemini. If all fail, returns rule-based hardcoded heuristics (e.g., `delivery_score = int((pitch_pct + flu_pct + eng_pct) / 3)`).

---

## 🔐 12. SECURITY DESIGN

*   **Authentication:** Handled by Next.js (likely NextAuth/Auth.js). 
*   **Authorization:** The FastAPI backend does not currently authenticate incoming POST requests directly (relies on obscurity and Vercel IP whitelisting in prod), but user association is maintained via `user_id` passing.
*   **Data Protection:** Audio is pushed to Supabase with obscured/safe file paths: `audio/{safe_uid}/{interview_id}.wav`.

---

## 📦 13. FILE STRUCTURE

```text
/MockMate_Root
├── /api
│   ├── main.py                 # Core FastAPI App & ML Inference Pipeline
│   ├── requirements.txt        # Python dependencies
│   └── /routers
│       └── resume.py           # Resume Analyzer endpoints
├── /emotion_model
│   ├── inference.py            
│   └── emotion_efficientnet_b0.pt # PyTorch weights
├── /voice_model
│   ├── inference.py            
│   └── voice_confidence.pth    # PyTorch weights & scaler
├── /resume_analyzer            # Resume NLP / OCR models
│   └── /models
├── /web                        # Next.js Application
│   ├── .env.local              
│   ├── package.json
│   └── /src
│       ├── /app
│       │   ├── /dashboard      # Dashboard UI
│       │   ├── /interview      # Interview UI (/new, /[id])
│       │   └── /resume         # Resume builders
│       ├── /components         # Navbar, MetricCards, ScoreRings
│       ├── /lib                # Utility functions, DB connection
│       └── /models             # Mongoose Schemas (User.ts, Interview.ts)
└── STARTUP_GUIDE.md            # Startup instructions
```

---

## 🔄 14. COMPLETE DATA FLOW TRACE

**Trace Example: User finishes speaking.**
1.  **Browser:** Captures 60 seconds of webcam video. Next.js saves it as `blob:http://localhost:3000/...` and uploads it to temporary hosting, generating URL `https://temp.io/vid123.webm`.
2.  **Next.js API:** Sends `{video_path: "https://...", transcript: "Um, I think...", interview_id: "XYZ"}` to FastAPI `http://localhost:8000/process`.
3.  **FastAPI (`download_video_to_temp`):** Downloads `vid123.webm` to local OS temp dir.
4.  **OpenCV (`analyze_video_with_model`):** Opens file. At frame 30, it finds a face. Finds eyes. Iris is 0.45 (centered). Eye contact frames increment. Emotion crops face → EfficientNet predicts `neutral: 0.8`.
5.  **FFmpeg (`extract_audio_from_video`):** Strips `vid123.wav`.
6.  **Praat (`extract_real_prosodic`):** Reads `.wav`. Finds 10 filler words ("Um"). Jitter is 0.03. Pitch is 120Hz.
7.  **Voice Model (`run_voice_model`):** Mel-Spectrogram + 13 Praat features → PyTorch → Confidence: `0.45`.
8.  **LLM Coaching (`get_behavioral_coaching`):** Sends `0.45` confidence, 10 fillers, and transcript to Groq. Groq replies with JSON giving Delivery a `40/100` and tip *"Practice pausing instead of saying um"*.
9.  **Supabase:** `.wav` uploaded to bucket. URL generated.
10. **FastAPI Response:** Returns massive JSON dict to Next.js.
11. **Next.js API:** Uses `Interview.findByIdAndUpdate("XYZ")` to attach the JSON. 
12. **Frontend:** Redirects to `/interview/XYZ`. Reads MongoDB, parses `analysis.behavioralSignals.delivery.score` (40), and renders a red `ScoreRing`.

---

## 🧾 15. BOTTLENECKS, SCALING, & IMPROVEMENTS

*   **Bottleneck (Synchronous ML):** The `/process` endpoint blocks until OpenCV, Praat, PyTorch, and 2 LLM network calls finish. This can take 10-30 seconds. In production, 10 concurrent users will crash/timeout the server.
*   **Improvement (Asynchronous Workers):** Move `/process` logic to a Background Task Queue (e.g., **Celery** + **Redis**). FastAPI should immediately return `{ "status": "processing" }` and Next.js should poll or use Server-Sent Events (SSE) / WebSockets to show a loading bar.
*   **Scaling Issue (Dependency Bloat):** The Python environment contains PyTorch, Librosa, OpenCV, and Praat. The Docker image will be massive (>2GB). Deploying this on standard Serverless (AWS Lambda, Vercel Functions) is impossible. It requires dedicated VM containers (AWS ECS / EKS / Render Background Workers) with substantial memory allocations (4GB+).
*   **Algorithmic Improvement:** Move from post-processing video files to streaming real-time frames via WebRTC directly to the backend. This allows continuous emotion updates rather than waiting until the end of the interview.
