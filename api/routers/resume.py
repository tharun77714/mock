from fastapi import APIRouter, UploadFile, File
import os
import shutil
import sys

# To enable importing from resume_analyzer
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from resume_analyzer.train import load_saved_pipeline, run_pipeline, get_ocr_reader
from contextlib import asynccontextmanager

resume_router = APIRouter()

MODEL_DIR = os.path.join(parent_dir, "resume_analyzer", "models")
_pipeline = None
_ocr_reader = None

def init_resume_models():
    global _pipeline, _ocr_reader
    print("Loading AI Resume Analyzer pipeline from disk...")
    if os.path.exists(os.path.join(MODEL_DIR, "skill_model.pt")):
        _pipeline = load_saved_pipeline(MODEL_DIR)
        print("Resume AI Pipeline loaded.")
    else:
        print(f"Warning: Models not found at {MODEL_DIR}")
    
    print("Loading OCR Engine...")
    _ocr_reader = get_ocr_reader()
    print("OCR Engine Ready.")

# Gamification logic
def compute_career_score(skills, exp, best_match_score):
    # Skills: max 35 pts — diminishing returns after 10 skills
    skill_count = len(skills)
    if skill_count <= 5:
        skill_score = skill_count * 4
    elif skill_count <= 10:
        skill_score = 20 + (skill_count - 5) * 2
    else:
        skill_score = 30 + min(skill_count - 10, 5)
    skill_score = min(skill_score, 35)

    # Experience: max 35 pts — plateaus after 8 years (senior level)
    if exp <= 1:
        exp_score = exp * 8
    elif exp <= 4:
        exp_score = 8 + (exp - 1) * 6
    elif exp <= 8:
        exp_score = 26 + (exp - 4) * 2
    else:
        exp_score = 35
    exp_score = min(int(exp_score), 35)

    # Match score: max 30 pts — directly from job match quality
    match_score = min(best_match_score * 0.30, 30)

    return int(round(skill_score + exp_score + match_score))

def get_rank(score):
    if score < 30:  return {"name": "Junior",         "cls": "rank-junior",    "icon": "🟢"}
    if score < 50:  return {"name": "Mid-Level",      "cls": "rank-mid",       "icon": "🔵"}
    if score < 65:  return {"name": "Senior",         "cls": "rank-senior",    "icon": "🟣"}
    if score < 80:  return {"name": "Staff Engineer", "cls": "rank-staff",     "icon": "🟡"}
    return              {"name": "Principal",         "cls": "rank-principal", "icon": "🔴"}

def get_achievements(skills, exp, matched, missing):
    badges = []
    s_set  = {s.lower() for s in skills}
    if len(skills) >= 8:      badges.append({"icon": "🧰", "label": "Skill Master",     "cls": "badge-gold"})
    elif len(skills) >= 5:    badges.append({"icon": "🛠️", "label": "Toolsmith",        "cls": "badge-purple"})
    if exp >= 6:               badges.append({"icon": "⏳", "label": "Veteran Dev",      "cls": "badge-gold"})
    elif exp >= 3:             badges.append({"icon": "📆", "label": "Experienced",      "cls": "badge-blue"})
    else:                      badges.append({"icon": "🌱", "label": "Rising Star",      "cls": "badge-green"})
    if "python" in s_set:      badges.append({"icon": "🐍", "label": "Pythonista",       "cls": "badge-green"})
    if "machine learning" in s_set or "deep learning" in s_set:
                               badges.append({"icon": "🤖", "label": "AI Practitioner",  "cls": "badge-purple"})
    if any(k in s_set for k in ["docker","kubernetes"]):
                               badges.append({"icon": "🐳", "label": "Container Pro",    "cls": "badge-blue"})
    if any(k in s_set for k in ["aws","azure","gcp"]):
                               badges.append({"icon": "☁️", "label": "Cloud Rider",      "cls": "badge-blue"})
    if any(k in s_set for k in ["react","javascript","html","css"]):
                               badges.append({"icon": "🌐", "label": "Web Wizard",       "cls": "badge-purple"})
    if any(k in s_set for k in ["sql","mongodb"]):
                               badges.append({"icon": "🗄️", "label": "Data Wrangler",   "cls": "badge-green"})
    if not missing:            badges.append({"icon": "💯", "label": "Perfect Match",    "cls": "badge-gold"})
    if len(matched) >= 4:      badges.append({"icon": "🎯", "label": "High Relevance",   "cls": "badge-green"})
    return badges

def build_quests(skills, job_matches):
    cand_set = {s.lower() for s in skills}
    job_req  = set()
    for j in job_matches[:3]:
        for s in j.get("required_skills", []):
            job_req.add(s.lower())
    matched = sorted(cand_set & job_req)
    missing = sorted(job_req - cand_set)
    XP = [10, 15, 20, 25, 30]
    completed = [{"skill": s.title(), "xp": XP[i % 5]} for i, s in enumerate(matched[:5])]
    active    = [{"skill": s.title(), "xp": XP[i % 5]} for i, s in enumerate(missing[:5])]
    return completed, active, matched, missing

@resume_router.post("/analyze-resume")
async def analyze_resume(file: UploadFile = File(...)):
    if _pipeline is None:
        init_resume_models()

    import tempfile, uuid
    temp_dir = tempfile.gettempdir()
    safe_name = f"resume_{uuid.uuid4().hex}.pdf"
    temp_path = os.path.join(temp_dir, safe_name)

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        raw = run_pipeline(temp_path, _pipeline, _ocr_reader)

        skills     = raw.get("Skills", [])
        exp        = raw.get("Experience (Years)", 0)
        best_score = raw.get("Best Match Score", 50)
        job_list   = raw.get("Top Job Matches", [])

        career_score            = compute_career_score(skills, exp, best_score)
        rank                    = get_rank(career_score)
        completed, active, matched, missing = build_quests(skills, job_list)
        badges                  = get_achievements(skills, exp, matched, missing)

        jobs_mapped = [
            {"title": j.get("title",""), "company": j.get("company",""), "score": j.get("score",0), "description": j.get("description", "")}
            for j in job_list
        ]

        return {
            "skills":     skills,
            "role":       raw.get("Predicted Role", "Unknown"),
            "experience": str(exp),
            "jobs":       jobs_mapped,
            "text":       raw.get("Text", ""),
            "score":      best_score,
            "careerScore":      career_score,
            "rank":             rank,
            "badges":           badges,
            "questsCompleted":  completed,
            "questsActive":     active,
        }

    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
