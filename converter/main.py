import os
import json
import requests
import shutil
import uuid
import base64
import fitz  # PyMuPDF
import cloudinary
import cloudinary.uploader
from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import Optional, List
from ai_utils import execute_ai_task, openrouter_low_priority, gemini_vision, groq70b, huggingface_search, cohere_rerank, RerankRequest, supabase

app = FastAPI()

# Restrict CORS to known frontend/backend origins only
_allowed_origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    os.getenv("BACKEND_URL", "http://localhost:8005"),
    "https://app.unistudy.ai",
    "https://unistudy.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Remaining", "X-RateLimit-Reset"],
    max_age=86400,
)

# ---------------------------------------------------------------------------
# Shared-secret authentication for internal service calls
# ---------------------------------------------------------------------------
_converter_secret = os.getenv("CONVERTER_SECRET", "")
_api_key_header = APIKeyHeader(name="X-Converter-Secret", auto_error=False)

async def verify_converter_secret(api_key: Optional[str] = Security(_api_key_header)):
    """Reject requests that don't carry the shared converter secret."""
    if not _converter_secret:
        # If CONVERTER_SECRET is not configured, reject all calls
        raise HTTPException(status_code=500, detail="Converter secret not configured")
    if api_key != _converter_secret:
        raise HTTPException(status_code=401, detail="Invalid converter secret")
    return api_key

# ---------------------------------------------------------------------------
# Request models (JSON body instead of Form data)
# ---------------------------------------------------------------------------
class VisionRequest(BaseModel):
    user_id: str
    prompt: str
    mime_type: str = "application/pdf"
    base64pdf: str

class StreamRequest(BaseModel):
    user_id: str
    messages: List[dict]  # [{"role": "user", "content": "…"}]

class GenerateRequest(BaseModel):
    user_id: str
    prompt: str

class LowPriorityRequest(BaseModel):
    user_id: str
    prompt: str

class EmbedRequest(BaseModel):
    user_id: str
    query: str

# Cloudinary Config
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

def process_file_task(file_path: str, lecture_id: str, user_id: str, is_pptx: bool):
    temp_dir = os.path.dirname(file_path)
    try:
        pdf_path = file_path
        if is_pptx:
            # PPTX-to-PDF conversion requires LibreOffice on Linux.
            # Run: `libreoffice --headless --convert-to pdf <file> --outdir <dir>`
            import subprocess
            print(f"Converting PPTX to PDF via LibreOffice: {file_path}")
            result = subprocess.run(
                ["libreoffice", "--headless", "--convert-to", "pdf", file_path, "--outdir", temp_dir],
                capture_output=True, text=True, timeout=120
            )
            if result.returncode != 0:
                raise RuntimeError(f"LibreOffice conversion failed: {result.stderr}")
            pdf_path = os.path.join(temp_dir, os.path.splitext(os.path.basename(file_path))[0] + ".pdf")

        print(f"Extracting slides from PDF: {pdf_path}")
        doc = fitz.open(pdf_path)

        slides_to_process = []
        try:
            for i in range(len(doc)):
                page = doc.load_page(i)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                slide_number = i + 1
                image_path = os.path.join(temp_dir, f"slide_{slide_number}.png")
                pix.save(image_path)
                slides_to_process.append({
                    "slide_number": slide_number,
                    "image_path": image_path
                })
        finally:
            doc.close()

        print(f"Extracted {len(slides_to_process)} slide images. Processing with AI concurrently...")
        try:
            supabase.table("lectures").update({"slide_count": len(slides_to_process)}).eq("id", lecture_id).execute()
        except Exception as e:
            print(f"Failed to update slide count: {e}")

        def process_single_slide(slide_info):
            sn = slide_info["slide_number"]
            img_path = slide_info["image_path"]
            
            # 1. Upload to Cloudinary with retry for transient Windows socket errors
            image_url = ""
            for attempt in range(4):
                try:
                    response = cloudinary.uploader.upload(
                        img_path,
                        folder=f"unistudy/{user_id}/slides/{lecture_id}/"
                    )
                    image_url = response["secure_url"]
                    break
                except Exception as upload_err:
                    if attempt == 3:
                        raise upload_err
                    import time
                    time.sleep(1 * (attempt + 1))

            # 2. Extract AI
            with open(img_path, 'rb') as f:
                img_b64 = base64.b64encode(f.read()).decode('utf-8')
                
            vision_payload = {
                "base64_image": img_b64,
                "prompt": "Extract all text precisely from this slide. Also provide a detailed, easy-to-understand explanation of the slide's content, including descriptions of any charts or diagrams. Return the result as a JSON object with two keys: 'raw_text' and 'explanation'."
            }
            
            print(f"Processing slide {sn}...")
            try:
                vision_result = execute_ai_task(
                    user_id=user_id,
                    category="vision",
                    payload=vision_payload,
                    provider_func=gemini_vision,
                )
                resp = vision_result.get("response", {})
                raw_text = resp.get("raw_text", "")
                explanation = resp.get("explanation", "")
            except Exception as e:
                print(f"Error processing slide {sn}: {e}")
                raw_text = ""
                explanation = ""
                
            slide_record = {
                "lecture_id": lecture_id,
                "slide_number": sn,
                "raw_text": raw_text,
                "explanation": explanation,
                "image_url": image_url
            }

            # 3. Generate embedding
            if raw_text:
                try:
                    embed_payload = {
                        "inputs": raw_text,
                        "url": "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2"
                    }
                    embed_result = execute_ai_task(
                        user_id=user_id,
                        category="search",
                        payload=embed_payload,
                        provider_func=huggingface_search,
                    )
                    emb_resp = embed_result.get("response", [])
                    if emb_resp and isinstance(emb_resp, list):
                        slide_record["embedding"] = str(emb_resp).replace(" ", "")
                except Exception as e:
                    print(f"Error generating embedding for slide {sn}: {e}")

            try:
                supabase.table("slides").insert(slide_record).execute()
                print(f"Inserted slide {sn} into DB.")
            except Exception as e:
                print(f"Error inserting slide {sn} into DB: {e}")
            return slide_record

        slides_to_insert = []
        import concurrent.futures
        
        # Max 5 workers to parallelize significantly without causing instant massive API rate limits
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            future_to_slide = {executor.submit(process_single_slide, slide): slide for slide in slides_to_process}
            for future in concurrent.futures.as_completed(future_to_slide):
                try:
                    result = future.result()
                    slides_to_insert.append(result)
                except Exception as exc:
                    print(f"Slide processing generated an exception: {exc}")

        if slides_to_insert:
            print("Finished processing all slides.")
        else:
            print("No slides to process.")

    except Exception as e:
        print(f"Error processing file: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        # Always mark processing done first, then clean up
        try:
            supabase.table("lectures").update({"processing": False}).eq("id", lecture_id).execute()
        except Exception as e:
            print(f"Failed to update processing status: {e}")
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)


@app.post("/convert", dependencies=[Depends(verify_converter_secret)])
async def convert_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    lecture_id: str = Form(...),
    user_id: str = Form(...)
):
    """
    Endpoint to receive a PDF/PPTX file, convert it to slide images, 
    upload to Cloudinary, and notify the main app.
    """
    # Create temp directory
    temp_dir = os.path.join("/tmp", str(uuid.uuid4()))
    os.makedirs(temp_dir, exist_ok=True)
    
    file_path = os.path.join(temp_dir, file.filename)
    
    # Save uploaded file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    is_pptx = file.filename.lower().endswith('.pptx')

    # Process in background so we don't block the HTTP response
    background_tasks.add_task(process_file_task, file_path, lecture_id, user_id, is_pptx)
    
    return {"status": "processing started", "lecture_id": lecture_id}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Low-priority free-tier endpoint (e.g., quotes, nudges)

@app.post("/low-priority", dependencies=[Depends(verify_converter_secret)])
async def low_priority_endpoint(body: LowPriorityRequest):
    """Handle low-priority free-tier text tasks via OpenRouter.
    Uses the free Llama-3-8B model by default. Quota is tracked under the
    `low_priority` category.
    """
    payload = {
        "model": "meta-llama/llama-3-8b-instruct:free",
        "messages": [{"role": "user", "content": body.prompt}],
    }
    return execute_ai_task(
        user_id=body.user_id,
        category="low_priority",
        payload=payload,
        provider_func=openrouter_low_priority,
    )

# ------------------------------------------------------------
# Vision endpoint – uses Gemini Flash (layer 1)
# ------------------------------------------------------------
@app.post("/vision", dependencies=[Depends(verify_converter_secret)])
async def vision_endpoint(body: VisionRequest):
    """Handle vision tasks (slide-explanation, PDF parsing, etc.).
    The caller must supply a base64-encoded PDF or image and a prompt.
    """
    payload = {
        "prompt": body.prompt,
        "mime_type": body.mime_type,
        "base64pdf": body.base64pdf,
    }
    try:
        return execute_ai_task(
            user_id=body.user_id,
            category="vision",
            payload=payload,
            provider_func=gemini_vision,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    except Exception as exc:
        import traceback
        trace = traceback.format_exc()
        print("VISION ENDPOINT ERROR:", trace)
        raise HTTPException(status_code=500, detail={"error": str(exc), "trace": trace})

# ------------------------------------------------------------
# Streaming endpoint – uses Groq 70B (real‑time)
# ------------------------------------------------------------
@app.post("/stream", dependencies=[Depends(verify_converter_secret)])
async def stream_endpoint(body: StreamRequest):
    """Real-time chat / calculator via Groq 70B.
    ``messages`` should be a list of ``{"role":…, "content":…}`` objects.
    """
    payload = {"messages": body.messages}
    try:
        return execute_ai_task(
            user_id=body.user_id,
            category="streaming",
            payload=payload,
            provider_func=groq70b,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=429, detail=str(exc))

# ------------------------------------------------------------
# Generate endpoint – batch text generation (uses Gemini Flash)
# ------------------------------------------------------------
@app.post("/generate", dependencies=[Depends(verify_converter_secret)])
async def generate_endpoint(body: GenerateRequest):
    """Batch text generation (flashcards, summaries, etc.)."""
    payload = {"prompt": body.prompt}
    try:
        return execute_ai_task(
            user_id=body.user_id,
            category="generation",
            payload=payload,
            provider_func=gemini_vision,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=429, detail=str(exc))

# ------------------------------------------------------------
# Rerank endpoint – uses Cohere for relevance scoring (internal only)
# ------------------------------------------------------------
@app.post("/rerank", dependencies=[Depends(verify_converter_secret)])
async def rerank_endpoint(body: RerankRequest):
    """Rerank a list of candidate documents using Cohere.
    Returns the reordered list (top_n) with scores.
    """
    payload = {
        "query": body.query,
        "documents": body.documents,
        "model": body.model,
        "top_n": body.top_n,
    }
    try:
        return execute_ai_task(
            user_id=body.user_id,
            category="rerank",
            payload=payload,
            provider_func=cohere_rerank,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=429, detail=str(exc))

# ------------------------------------------------------------
# Embed / search endpoint – uses HuggingFace (no quota limit)
# ------------------------------------------------------------
@app.post("/embed", dependencies=[Depends(verify_converter_secret)])
async def embed_endpoint(
    user_id: str = Form(...),
    model: str = Form(...),
    inputs: str = Form(...),
):
    """Call HuggingFace for embeddings or other feature‑extraction tasks.
    ``inputs`` is a JSON‑encoded value compatible with the selected model.
    """
    try:
        payload = {
            "model": model,
            "inputs": json.loads(inputs),
            "url": "https://api-inference.huggingface.co/pipeline/feature-extraction",
        }
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in inputs field")
    return execute_ai_task(
        user_id=user_id,
        category="search",
        payload=payload,
        provider_func=huggingface_search,
    )

# Ollama extraction helper – can be used by other services
# Vision extraction moved to Gemini. The function is no longer needed.
# If required, a similar wrapper can be implemented using the appropriate provider.
