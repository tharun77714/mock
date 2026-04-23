import os
import json
import re
import io
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from openai import OpenAI

smart_resume_router = APIRouter()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

groq_client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
) if GROQ_API_KEY else None

def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Try pdfplumber first, then pypdf fallback."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
            return text.strip()
    except ImportError:
        pass
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"pdfplumber extraction failed: {e}")

    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="No PDF library installed. Run: pip install pdfplumber"
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF extraction failed: {e}")

SMART_RESUME_PROMPT = """\
You are an elite Tech Career Architect and Executive Resume Writer.

TASK:
You are given a candidate's MASTER RESUME, a TARGET ROLE, TARGET COMPANY, and a JOB DESCRIPTION.
You must generate a perfectly tailored resume and cover letter tailored precisely to this role.

TARGET ROLE: {role}
TARGET COMPANY: {company}

JOB DESCRIPTION:
{jd}

CANDIDATE'S MASTER RESUME:
{resume_text}

Return ONLY a valid raw JSON object — no markdown fences, no explanation, no extra text. Use this EXACT structure:
{{
  "tailored_summary": "<A powerful, 2-3 sentence executive summary positioning the candidate for this exact role. DO NOT hallucinate experience they don't have, but frame what they have in the best light.>",
  "top_skills": [
    "<Highlight 6-8 key technical or soft skills from their resume that directly map to the Job Description requirements>"
  ],
  "experience": [
    {{
      "company": "<Extracted company name>",
      "role": "<Extracted role title>",
      "tailored_bullets": [
        "<Rewrite the candidate's achievements into maximum impact STAR-method bullets (Situation, Task, Action, Result) optimized for the job description. Quantify results where possible based on the master resume.>"
      ]
    }}
  ],
  "cover_letter": "<Write a compelling, modern, and concise cover letter (3-4 paragraphs) expressing interest in the role at the target company, highlighting how the candidate's background matches the specific needs outlined in the job description. Do not use generic placeholders like [Company Name], use the actual Target Company. Use placeholders like [Your Name] for the candidate's name if not found.>",
  "match_analysis": {{
    "score": <Integer 0-100 indicating how strong their background actually fits the job description before tailoring>,
    "rationale": "<One sentence explaining the score>"
  }}
}}

RULES:
1. Do not invent fake metrics or experience. Infer politely if logical, but stay grounded in the Master Resume.
2. The output MUST be raw JSON without ```json or markdown formatting.
3. Every bullet must start with a strong action verb.
"""

def clean_json(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'^```\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    return raw.strip()


@smart_resume_router.post("/smart-resume/generate")
async def generate_smart_resume(
    file: UploadFile = File(...),
    target_role: str = Form(...),
    target_company: str = Form(...),
    job_description: str = Form(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    resume_text = extract_pdf_text(pdf_bytes)

    if len(resume_text.strip()) < 80:
        raise HTTPException(
            status_code=422,
            detail="Could not extract enough text. Ensure the PDF is text-based (not a scanned image)."
        )

    resume_text = resume_text[:8000]
    job_desc_text = job_description[:5000]

    if not groq_client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured. Cannot run analysis.")

    try:
        prompt = SMART_RESUME_PROMPT.format(
            role=target_role,
            company=target_company,
            jd=job_desc_text,
            resume_text=resume_text
        )
        
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=5000
        )
        raw = resp.choices[0].message.content
        result = json.loads(clean_json(raw))
        
        return JSONResponse({
            "success": True,
            "data": result
        })
    except json.JSONDecodeError as e:
        print("[SmartResume] JSON parse error:", e)
        print("[SmartResume] Raw output:", raw)
        return JSONResponse(status_code=500, content={"success": False, "error": "Failed to parse AI response into JSON. Please try again."})
    except Exception as e:
        print("[SmartResume] Error:", e)
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

