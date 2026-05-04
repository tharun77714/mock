import pandas as pd
import torch
import torch.nn as nn
import os
import json
import numpy as np
import re
import joblib
import scipy.sparse

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics.pairwise import cosine_similarity


# -------------------------
# OCR  (imported lazily so Streamlit can start immediately)
# -------------------------
def get_ocr_reader():
    import easyocr
    return easyocr.Reader(['en'])


def extract_text(file_path, reader):
    if file_path.lower().endswith('.pdf'):
        try:
            import fitz
            doc = fitz.open(file_path)
            text = " ".join([page.get_text() for page in doc])
            text = text.lower().replace("\n", " ").replace(",", " ").replace(".", " ")
            if len(text.strip()) > 50:
                return text
        except Exception as e:
            print(f"PyMuPDF error: {e}")
            pass # fallback to OCR if possible, though OCR on pdf directly might still fail
    
    # Fallback to OCR for images
    result = reader.readtext(file_path, detail=0)
    text = " ".join(result).lower()
    text = text.replace("\n", " ").replace(",", " ").replace(".", " ")
    return text


# -------------------------
# NORMALIZATION
# -------------------------
def normalize_text(text):
    import re
    replacements = {
        r"\bmachine learning algorithms\b": "machine learning",
        r"\bpython for data science\b": "python",
        r"\bdeep neural networks\b": "deep learning",
        r"\brest apis\b": "rest api",
        r"\bnodejs\b": "node.js",
        r"\bimplementin\b": "implementing",
    }
    for pattern, replacement in replacements.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text

# -------------------------
# EXPERIENCE EXTRACTION
# -------------------------
def extract_experience(text):
    matches = re.findall(r'(\d+)\s*\+?\s*(years|yrs)', text)
    if matches:
        nums = [int(m[0]) for m in matches]
        return max(nums)

    years = re.findall(r'(20\d{2})', text)
    if len(years) >= 2:
        years = list(map(int, years))
        return max(years) - min(years)

    return 3


# -------------------------
# SKILL MODEL
# -------------------------
class SkillModel(nn.Module):
    def __init__(self, input_size, output_size):
        super().__init__()
        self.fc1 = nn.Linear(input_size, 512)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(512, output_size)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        return self.sigmoid(self.fc2(self.relu(self.fc1(x))))


# ──────────────────────────────────────────────────────────────
# MAIN CACHED LOADER — called once by Streamlit via @st.cache_resource
# Everything expensive lives here so it never re-runs on rerun().
# ──────────────────────────────────────────────────────────────
def load_pipeline():
    print("🔧 Building pipeline (runs only once)…")

    # --- Dataset ---
    with open("data/resumes.json", "r") as f:
        data = json.load(f)

    texts        = [d["text"].lower() for d in data]
    skills_raw   = [d["skills"]       for d in data]
    roles        = [d["role"]         for d in data]
    cleaned_skills = [[s.lower() for s in sk] for sk in skills_raw]

    # --- Resume Vectorizer ---
    vectorizer = TfidfVectorizer(max_features=5000)
    X = vectorizer.fit_transform(texts)

    # --- Skill vocab & labels ---
    skill_vocab = sorted(set(s for sub in cleaned_skills for s in sub))

    Y_skills = []
    for skill_list in cleaned_skills:
        vec = [0] * len(skill_vocab)
        for s in skill_list:
            vec[skill_vocab.index(s)] = 1
        Y_skills.append(vec)

    X_tensor = torch.tensor(X.toarray(), dtype=torch.float32)
    Y_tensor = torch.tensor(Y_skills,    dtype=torch.float32)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    skill_model = SkillModel(X.shape[1], len(skill_vocab)).to(device)
    optimizer   = torch.optim.Adam(skill_model.parameters(), lr=0.001)
    criterion   = nn.BCELoss()

    X_tensor = X_tensor.to(device)
    Y_tensor = Y_tensor.to(device)

    print("🔥 Training Skill Model…")
    for epoch in range(15):
        optimizer.zero_grad()
        out  = skill_model(X_tensor)
        loss = criterion(out, Y_tensor)
        loss.backward()
        optimizer.step()
        print(f"  Epoch {epoch+1}/15: {loss.item():.4f}")

    # --- Role Model ---
    role_model = LogisticRegression(max_iter=1000)
    role_model.fit(X, roles)

    # --- Job Data ---
    jobs = pd.read_csv("data/postings.csv").fillna("").astype(str)
    job_vectorizer = TfidfVectorizer(max_features=5000)
    job_vectors    = job_vectorizer.fit_transform(jobs['description'])

    print("✅ Pipeline ready.")

    return {
        "vectorizer":     vectorizer,
        "skill_model":    skill_model,
        "skill_vocab":    skill_vocab,
        "role_model":     role_model,
        "jobs":           jobs,
        "job_vectorizer": job_vectorizer,
        "job_vectors":    job_vectors,
        "device":         device,
    }


# ──────────────────────────────────────────────────────────────
# SAVE / LOAD TRAINED PIPELINE
# ──────────────────────────────────────────────────────────────
def save_pipeline(pipeline, model_dir="models"):
    os.makedirs(model_dir, exist_ok=True)

    joblib.dump(pipeline["vectorizer"],     os.path.join(model_dir, "vectorizer.joblib"))
    joblib.dump(pipeline["role_model"],     os.path.join(model_dir, "role_model.joblib"))
    joblib.dump(pipeline["job_vectorizer"], os.path.join(model_dir, "job_vectorizer.joblib"))

    torch.save({
        "state_dict":  pipeline["skill_model"].state_dict(),
        "input_size":  pipeline["skill_model"].fc1.in_features,
        "output_size": pipeline["skill_model"].fc2.out_features,
    }, os.path.join(model_dir, "skill_model.pt"))

    with open(os.path.join(model_dir, "skill_vocab.json"), "w") as f:
        json.dump(pipeline["skill_vocab"], f)

    scipy.sparse.save_npz(os.path.join(model_dir, "job_vectors.npz"), pipeline["job_vectors"])

    pipeline["jobs"].to_csv(os.path.join(model_dir, "jobs_snapshot.csv"), index=False)

    print(f"Pipeline saved to {model_dir}/")


def load_saved_pipeline(model_dir="models"):
    print("Loading pre-trained pipeline from disk...")

    vectorizer     = joblib.load(os.path.join(model_dir, "vectorizer.joblib"))
    role_model     = joblib.load(os.path.join(model_dir, "role_model.joblib"))
    job_vectorizer = joblib.load(os.path.join(model_dir, "job_vectorizer.joblib"))

    with open(os.path.join(model_dir, "skill_vocab.json")) as f:
        skill_vocab = json.load(f)

    ckpt = torch.load(os.path.join(model_dir, "skill_model.pt"), map_location="cpu", weights_only=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    skill_model = SkillModel(ckpt["input_size"], ckpt["output_size"]).to(device)
    skill_model.load_state_dict(ckpt["state_dict"])
    skill_model.eval()

    job_vectors = scipy.sparse.load_npz(os.path.join(model_dir, "job_vectors.npz"))
    jobs        = pd.read_csv(os.path.join(model_dir, "jobs_snapshot.csv")).fillna("").astype(str)

    print("Pipeline loaded.")
    return {
        "vectorizer":     vectorizer,
        "skill_model":    skill_model,
        "skill_vocab":    skill_vocab,
        "role_model":     role_model,
        "jobs":           jobs,
        "job_vectorizer": job_vectorizer,
        "job_vectors":    job_vectors,
        "device":         device,
    }


# ──────────────────────────────────────────────────────────────
# INFERENCE HELPERS  (all take pipeline dict, no globals)
# ──────────────────────────────────────────────────────────────
def is_skill_present(skill, text):
    return any(word in text for word in skill.split())


def predict_skills(text, pipeline):
    vectorizer  = pipeline["vectorizer"]
    skill_model = pipeline["skill_model"]
    skill_vocab = pipeline["skill_vocab"]
    device      = pipeline["device"]

    text = normalize_text(text)
    vec  = vectorizer.transform([text]).toarray()
    vec  = torch.tensor(vec, dtype=torch.float32).to(device)

    with torch.no_grad():
        pred = skill_model(vec)[0].cpu().numpy()

    idxs   = pred.argsort()[-10:][::-1]
    skills = [
        skill_vocab[i] for i in idxs
        if pred[i] > 0.2 and is_skill_present(skill_vocab[i], text)
    ]

    keywords = [
        "python", "machine learning", "deep learning", "tensorflow", "pytorch",
        "sql", "spark", "kafka", "airflow", "etl", "aws", "hadoop",
        "docker", "kubernetes", "ci/cd", "terraform", "azure",
        "html", "css", "javascript", "react", "node.js",
        "excel", "tableau", "power bi", "data analysis",
        "java", "mongodb", "rest api"
    ]
    for k in keywords:
        if k in text and k not in skills:
            skills.append(k)

    IGNORE = ["junit", "testng", "manual testing"]
    skills = [s for s in skills if s not in IGNORE]
    return skills[:8]


def match_jobs(skills, text, role, pipeline):
    job_vectorizer = pipeline["job_vectorizer"]
    job_vectors    = pipeline["job_vectors"]
    jobs           = pipeline["jobs"]

    query  = (" ".join(skills) * 3) + " " + text[:150]
    vec    = job_vectorizer.transform([query])
    scores = cosine_similarity(vec, job_vectors)[0]

    indices = np.argsort(scores)[-10:][::-1]
    results, seen = [], set()

    for i in indices:
        job     = jobs.iloc[i]
        company = job.get("company_name", "Unknown")
        title   = job.get("title", "").lower()
        desc    = job.get("description", "")

        if role.lower() not in title and not any(s in title for s in skills):
            continue

        if company not in seen:
            results.append({
                "title":          job.get("title", "Unknown"),
                "company":        company,
                "score":          float(round(scores[i] * 100, 2)),
                "description":    desc,
                "required_skills": predict_skills(desc, pipeline)
            })
            seen.add(company)

        if len(results) == 5:
            break

    return results, float(scores[indices[0]])


# ──────────────────────────────────────────────────────────────
# PUBLIC PIPELINE ENTRY POINT
# ──────────────────────────────────────────────────────────────
def run_pipeline(image_path, pipeline, ocr_reader):
    text = extract_text(image_path, ocr_reader)
    text = normalize_text(text)
    print("\n📄 OCR TEXT:\n", text[:300])

    vec   = pipeline["vectorizer"].transform([text])
    skills = predict_skills(text, pipeline)
    role   = pipeline["role_model"].predict(vec)[0]

    # Only override when there are STRONG, specific signals the model likely missed
    # Use word counts to avoid false positives from single mentions
    devops_signals = sum(1 for w in ["kubernetes", "ci/cd", "terraform", "ansible", "helm"] if w in text)
    if devops_signals >= 2:
        role = "DevOps Engineer"
    elif text.count("etl") >= 2 or ("data engineer" in text):
        role = "Data Engineer"
    elif "excel" in text and "tableau" in text and "machine learning" not in text:
        role = "Business Analyst"
    # else: trust the trained model
    exp = extract_experience(text)
    jobs_list, best_score = match_jobs(skills, text, role, pipeline)

    return {
        "Skills":             skills,
        "Predicted Role":     role,
        "Experience (Years)": exp,
        "Best Match Score":   round(best_score * 100, 2),
        "Top Job Matches":    jobs_list,
        "Text":               text,
    }


# -------------------------
# CLI TEST
# -------------------------
if __name__ == "__main__":
    image_path = r"C:\Users\shaik\Downloads\Artificial-Intelligence-Engineer-Resume-Sample.jpg"
    print("File exists:", os.path.exists(image_path))
    pipeline   = load_pipeline()
    ocr_reader = get_ocr_reader()
    result     = run_pipeline(image_path, pipeline, ocr_reader)
    print("\n🔥 FINAL RESULT")
    for k, v in result.items():
        print(f"{k}: {v}")