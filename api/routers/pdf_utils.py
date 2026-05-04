# api/routers/pdf_utils.py
# Shared PDF extraction utility used by resume_ai.py and smart_resume.py

import io
from fastapi import HTTPException


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