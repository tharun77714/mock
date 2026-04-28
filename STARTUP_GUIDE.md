# MockMate Startup Guide

Welcome to the **MockMate** project! MockMate uses a bifurcated stack: a frontend built in **Next.js** and a highly-efficient machine learning backend in **FastAPI** (Python). 

Follow the instructions below to get both up and running so you can start developing locally.

---

## 1. Prerequisites

Before starting, ensure you have the following installed on your machine:
- **Node.js** (v18 or higher recommended)
- **Python** (v3.9 or higher)
- **Git**
- A code editor like **VS Code**

---

## 2. Environment Configuration

The application requires various environment variables for the frontend and backend to communicate with external APIs (like MongoDB, Supabase, Groq, Google, Vapi, etc.). 

### Backend Environment (`api/.env`)
Navigate to the `api` directory, copy the example `.env` file, and fill in your keys:
```bash
cd api
# Copy the example file
cp .env.example .env
```
Fill in the necessary keys in `api/.env`:
- `MONGODB_URI`
- `GROQ_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Frontend Environment (`web/.env.local`)
Navigate to the `web` directory, copy the example `.env.local` file, and fill in your keys:
```bash
cd web
# Copy the example file
cp .env.example .env.local
```
Make sure to fill in the `web/.env.local` variables identically where they overlap with the backend (e.g. `MONGODB_URI`, `GROQ_API_KEY`, Supabase keys) and populate NextAuth/JWT secrets. Ensure `PYTHON_API_URL` is set to `http://localhost:8000`.

---

## 3. Starting the Backend (FastAPI / Machine Learning)

The backend handles the AI models (emotion, voice, and Groq integration).

1. **Navigate to the `api` directory:**
   ```bash
   cd api
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   # Create a virtual environment named 'venv'
   python -m venv venv
   
   # Activate it (Windows)
   venv\Scripts\activate
   # Activate it (macOS/Linux)
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the FastAPI server:**
   ```bash
   python -m uvicorn main:app --reload --port 8000

   ```
   *The backend should now be running at `http://localhost:8000`.*
   *You can also visit `http://localhost:8000/docs` to see the interactive Swagger UI.*

---

## 4. Starting the Frontend (Next.js)

The frontend provides the interactive UI, webcam capture, and Smart Resume Analyzer functionalities.

1. **Open a new terminal window / tab** (leave the backend running).

2. **Navigate to the `web` directory:**
   ```bash
   cd web
   ```

3. **Install Node dependencies:**
   ```bash
   npm install
   ```

4. **Run the Next.js development server:**
   ```bash
   npm run dev
   ```
   *The frontend should now be running at `http://localhost:3000`.*

---

## 5. Using the Application

With both servers running, open your web browser and navigate to:
**[http://localhost:3000](http://localhost:3000)**

**Troubleshooting:**
- If you encounter network errors when the frontend tries to call the backend, verify that `PYTHON_API_URL=http://localhost:8000` is set in your `web/.env.local` and that the FastAPI server is running on port 8000.
- If AI actions are failing, ensure that `GROQ_API_KEY` and `MONGODB_URI` are properly configured in both `.env` files.



