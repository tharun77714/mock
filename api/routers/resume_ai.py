import os
import json
import re
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
import google.genai as genai
from openai import OpenAI
from routers.pdf_utils import extract_pdf_text

resume_ai_router = APIRouter()

GEMINI_API_KEY = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

print(f"[ResumeAI] GEMINI_API_KEY={'SET (' + GEMINI_API_KEY[:8] + '...)' if GEMINI_API_KEY else 'NOT SET'}")
print(f"[ResumeAI] GROQ_API_KEY={'SET (' + GROQ_API_KEY[:8] + '...)' if GROQ_API_KEY else 'NOT SET'}")

gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None
groq_client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
) if GROQ_API_KEY else None

# Prompts
# ---------------------------------------------------------------------------
ATS_XRAY_PROMPT = """\
You are a FAANG senior recruiter and ATS algorithm expert. Brutally and precisely analyze this resume.
TARGET ROLE: {role}
TARGET COMPANY: {company}

RESUME TEXT:
{resume_text}

Return ONLY a valid raw JSON object — no markdown fences, no explanation, no extra text. Use this EXACT structure:
{{
  "infiltration_probability": <integer 0-100 — realistic ATS pass probability for {company} specifically>,
  "ats_signals": {{
    "detected": [<keywords from job description found verbatim or semantically in resume — list of strings>],
    "missing": [<critical {company}/{role} keywords completely absent from resume — list of strings>]
  }},
  "xray": {{
    "summary":    {{"grade": "<letter grade A/B/C/D/F with +/->", "issue": "<one brutal specific sentence>"}},
    "experience": {{"grade": "<grade>", "issue": "<specific issue>"}},
    "skills":     {{"grade": "<grade>", "issue": "<specific issue>"}},
    "projects":   {{"grade": "<grade>", "issue": "<specific issue>"}},
    "education":  {{"grade": "<grade>", "issue": "<specific issue>"}}
  }},
  "patch_notes": [
    {{
      "original": "<exact weak bullet point copied verbatim from the resume>",
      "upgraded": "<STAR-method rewrite with specific metrics tailored to {role} at {company}>",
      "section":  "<Experience|Projects|Summary>"
    }}
  ],
  "profile_card": {{
    "market_rank": "<pick one: Unranked | Competitive | Advanced | Elite | Principal>",
    "top_skills":  [<top 3 detected technical skills — list of strings>],
    "ai_summary":  "<One cold honest sentence about fit. Be specific to {company}. No fluff.>"
  }}
}}

Rules:
1. patch_notes must have 3-5 entries using REAL bullet text extracted from the resume.
2. ats_signals.missing must name skills {company} actually requires for {role} in 2025.
3. infiltration_probability must be specific to {company}'s known ATS strictness (Google=strict, startup=lenient).
4. Grades should be brutal — most resumes are C or below on experience bullets.
5. The upgraded bullet in patch_notes must include at least one metric or quantifiable result.
"""

GROQ_META_PROMPT = """\
You are a live tech market intelligence analyst with access to current 2025-2026 hiring trends.

TARGET ROLE: {role}
TARGET COMPANY: {company}

Return ONLY a valid raw JSON object — no markdown, no explanation:
{{
  "rising": [<3-4 skills trending UP for {role} in 2025-2026 — list of strings>],
  "fading": [<2-3 skills losing relevance in this space — list of strings>],
  "must_have": [<3-4 non-negotiable skills {company} specifically screens for in {role} — list of strings>],
  "company_culture_flag": "<One sentence: what does {company} look for beyond technical skills in {role} candidates>",
  "insider_tip": "<One actionable sentence a candidate can implement in their resume TODAY to stand out at {company}>"
}}
"""


# ---------------------------------------------------------------------------
# Helper — strip markdown fences from LLM output
# ---------------------------------------------------------------------------
def clean_json(raw: str) -> str:
    raw = raw.strip()
    # re.IGNORECASE handles ```JSON, ```Json, ```json from different LLMs
    raw = re.sub(r'^```json\s*', '', raw, flags=re.IGNORECASE)
    raw = re.sub(r'^```\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    # Also strip any leading/trailing non-JSON characters before the first { or [
    first_brace = min(
        (raw.find(c) for c in ('{', '[') if raw.find(c) != -1),
        default=0
    )
    last_brace = max(
        (raw.rfind(c) for c in ('}', ']') if raw.rfind(c) != -1),
        default=len(raw) - 1
    )
    if first_brace > 0 or last_brace < len(raw) - 1:
        raw = raw[first_brace:last_brace + 1]
    return raw.strip()


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------
@resume_ai_router.post("/resume/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    target_role: str = Form(...),
    target_company: str = Form(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    print(f"[ResumeAI] PDF size: {len(pdf_bytes)} bytes")
    resume_text = extract_pdf_text(pdf_bytes)
    print(f"[ResumeAI] Extracted text length: {len(resume_text)} chars")
    print(f"[ResumeAI] First 200 chars: {resume_text[:200]}")

    if len(resume_text.strip()) < 80:
        raise HTTPException(
            status_code=422,
            detail="Could not extract enough text. Ensure the PDF is text-based (not a scanned image)."
        )

    resume_text = resume_text[:8000]

    main_result = {}
    meta_result = {}
    errors = []

    if not groq_client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured. Cannot run analysis.")

    # ── Analysis 1: X-Ray + ATS + Patch Notes (Groq) ──────────────────────
    try:
        prompt = ATS_XRAY_PROMPT.format(
            role=target_role,
            company=target_company,
            resume_text=resume_text
        )
        print(f"[ResumeAI] Calling Groq for main analysis (prompt len: {len(prompt)})")
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=4000
        )
        raw = resp.choices[0].message.content
        print(f"[ResumeAI] Groq main response length: {len(raw)}")
        print(f"[ResumeAI] Groq main (first 500): {raw[:500]}")
        main_result = json.loads(clean_json(raw))
        print(f"[ResumeAI] Main parsed OK. infiltration={main_result.get('infiltration_probability')}")
    except json.JSONDecodeError as e:
        errors.append(f"Main analysis JSON parse error: {e}")
        print(f"[ResumeAI] Main JSON ERROR: {e}")
    except Exception as e:
        errors.append(f"Main analysis error: {e}")
        print(f"[ResumeAI] Main EXCEPTION: {e}")

    # ── Analysis 2: Meta Intelligence Report (Groq) ────────────────────────
    try:
        meta_prompt = GROQ_META_PROMPT.format(
            role=target_role,
            company=target_company
        )
        print(f"[ResumeAI] Calling Groq for meta report")
        resp2 = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": meta_prompt}],
            temperature=0.35,
            max_tokens=800
        )
        raw2 = resp2.choices[0].message.content
        print(f"[ResumeAI] Groq meta response: {raw2[:300]}")
        meta_result = json.loads(clean_json(raw2))
    except json.JSONDecodeError as e:
        errors.append(f"Meta report JSON parse error: {e}")
        print(f"[ResumeAI] Meta JSON ERROR: {e}")
    except Exception as e:
        errors.append(f"Meta report error: {e}")
        print(f"[ResumeAI] Meta EXCEPTION: {e}")

    return JSONResponse({
        "target_role": target_role,
        "target_company": target_company,
        "infiltration_probability": main_result.get("infiltration_probability", 0),
        "ats_signals": main_result.get("ats_signals", {"detected": [], "missing": []}),
        "xray": main_result.get("xray", {}),
        "patch_notes": main_result.get("patch_notes", []),
        "profile_card": main_result.get("profile_card", {}),
        "meta_report": meta_result,
        "errors": errors if errors else None
    })
