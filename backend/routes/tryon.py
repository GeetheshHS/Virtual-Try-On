import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from PIL import Image
from gradio_client import Client, handle_file

from utils.helpers import generate_unique_id, save_and_compress_image
from services.segmentation import generate_clothing_mask, clean_garment_image
from ai.model_manager import ModelManager

router = APIRouter()

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")

# Ensure folders exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Configurations
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_MIMETYPES = {"image/jpeg", "image/png", "image/webp"}

def validate_image_file(file: UploadFile):
    """
    Validates file format and file size.
    """
    if file.content_type not in ALLOWED_MIMETYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{file.content_type}'. Supported formats: JPG, PNG, WEBP."
        )
    # Estimate size (can be checked by reading chunk)
    # The SpooledTemporaryFile might not have an accurate size, so we read a chunk
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    
    if size > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of 5MB. Uploaded: {size / (1024 * 1024):.2f}MB"
        )

@router.post("/upload/person")
async def upload_person(file: UploadFile = File(...)):
    validate_image_file(file)
    file_id = generate_unique_id()
    filename = f"person_{file_id}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save & compress
    save_and_compress_image(file.file, filepath)
    
    return {
        "id": file_id,
        "url": f"/uploads/{filename}",
        "filename": filename
    }

@router.post("/upload/cloth")
async def upload_cloth(file: UploadFile = File(...)):
    validate_image_file(file)
    file_id = generate_unique_id()
    filename = f"cloth_{file_id}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save & compress
    save_and_compress_image(file.file, filepath)
    
    return {
        "id": file_id,
        "url": f"/uploads/{filename}",
        "filename": filename
    }

class GenerateRequest(BaseModel):
    person_id: str
    cloth_id: str
    category: Optional[str] = "upper"  # 'upper', 'lower', 'dress'
    prompt: Optional[str] = ""
    height: Optional[int] = 512
    width: Optional[int] = 512
    mode: Optional[str] = "system" # 'system', 'ai'
    preserve_arms: Optional[bool] = True

@router.post("/generate")
async def generate_tryon(
    person_id: str = Form(...),
    cloth_id: str = Form(...),
    category: Optional[str] = Form("upper"),
    prompt: Optional[str] = Form(""),
    height: Optional[int] = Form(512),
    width: Optional[int] = Form(512),
    mode: Optional[str] = Form("system"),
    preserve_arms: Optional[bool] = Form(True)
):
    # Retrieve files
    person_filename = f"person_{person_id}.jpg"
    cloth_filename = f"cloth_{cloth_id}.jpg"
    
    person_path = os.path.join(UPLOAD_DIR, person_filename)
    cloth_path = os.path.join(UPLOAD_DIR, cloth_filename)
    
    if not os.path.exists(person_path):
        raise HTTPException(status_code=404, detail="Person image not found. Please upload again.")
    if not os.path.exists(cloth_path):
        raise HTTPException(status_code=404, detail="Clothing image not found. Please upload again.")
        
    try:
        # Load images
        person_image = Image.open(person_path)
        cloth_image = Image.open(cloth_path)
        
        orig_w, orig_h = person_image.size
        
        # Calculate target height and width preserving the original aspect ratio.
        # We target 1024px on GPU for maximum detail and clarity, falling back to 768px on CPU.
        import torch
        max_dim = 1024 if torch.cuda.is_available() else 768
        if orig_w > orig_h:
            target_w = max_dim
            target_h = int(max_dim * orig_h / orig_w)
        else:
            target_h = max_dim
            target_w = int(max_dim * orig_w / orig_h)
            
        # Ensure dimensions are multiples of 32 (required by diffusion models)
        target_w = max(32, (target_w // 32) * 32)
        target_h = max(32, (target_h // 32) * 32)
        
        # Determine unique generation ID
        result_id = generate_unique_id()
        result_filename = f"result_{result_id}.jpg"
        result_path = os.path.join(OUTPUT_DIR, result_filename)
        
        # Check generation mode
        if mode == "ai":
            print(f"Running remote Hugging Face AI Virtual Try-On pipeline at native aspect ratio...")
            print("Isolating garment fabric from model/background...")
            cloth_image_clean = clean_garment_image(cloth_image, category)
            clean_cloth_path = os.path.join(UPLOAD_DIR, f"clean_cloth_{cloth_id}_{result_id}.jpg")
            cloth_image_clean.save(clean_cloth_path, "JPEG")
            
            try:
                client = Client("wizzseen/virtual-try-on")
                person_input = handle_file(person_path)
                cloth_input = handle_file(clean_cloth_path)
                
                result = client.predict(
                    cloth_input,
                    person_input,
                    api_name="/predict"
                )
                
                if isinstance(result, dict) and "path" in result:
                    result_path_temp = result["path"]
                else:
                    result_path_temp = str(result)
                
                # Load the remote result, resize back to original resolution and aspect ratio, and save
                remote_img = Image.open(result_path_temp)
                result_img_resized = remote_img.resize((orig_w, orig_h), Image.LANCZOS)
                result_img_resized.save(result_path, "JPEG", quality=90)
                print(f"Successfully retrieved and fitted remote try-on result: {result_path}")
            finally:
                if os.path.exists(clean_cloth_path):
                    os.remove(clean_cloth_path)
        else:
            # 1. Generate clothing mask using SegFormer
            print(f"Generating clothing mask for category '{category}' (preserve_arms={preserve_arms}) at resolution {target_w}x{target_h}...")
            # We resize the person image temporarily to target dimensions to run SegFormer on matching scale
            person_image_resized = person_image.resize((target_w, target_h), Image.BICUBIC)
            mask_image_resized = generate_clothing_mask(person_image_resized, category, preserve_arms)
            
            manager = ModelManager()
            
            # 2. Run Inference
            if prompt and prompt.strip() != "":
                # Text-guided editing with Stable Diffusion Inpainting
                print(f"Running prompt-based clothing modification: '{prompt}'...")
                inpaint_model = manager.get_sd_inpaint_model()
                result_img = inpaint_model.generate(
                    person_image=person_image_resized,
                    mask_image=mask_image_resized,
                    prompt=prompt,
                    height=target_h,
                    width=target_w
                )
            else:
                # Direct Virtual Try-On with CatVTON
                print(f"Running local CatVTON Virtual Try-On pipeline at resolution {target_w}x{target_h}...")
                print("Isolating garment fabric from model/background...")
                cloth_image_clean = clean_garment_image(cloth_image, category)
                
                catvton_model = manager.get_catvton_model()
                result_img = catvton_model.generate(
                    person_image=person_image_resized,
                    cloth_image=cloth_image_clean,
                    mask_image=mask_image_resized,
                    height=target_h,
                    width=target_w
                )
            
            # 3. Resize generated result back to original resolution and aspect ratio and save
            result_img_resized = result_img.resize((orig_w, orig_h), Image.BICUBIC)
            result_img_resized.save(result_path, "JPEG", quality=95)
            manager.free_memory()
        
        return {
            "result_id": result_id,
            "url": f"/outputs/{result_filename}",
            "filename": result_filename
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Inference pipeline failed: {str(e)}. Check system memory/VRAM limits."
        )

@router.get("/result/{id}")
async def get_result(id: str):
    filename = f"result_{id}.jpg"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Generated try-on result not found.")
        
    return FileResponse(filepath)

@router.delete("/cleanup/{id}")
async def cleanup_files(id: str, background_tasks: BackgroundTasks):
    """
    Cleans up uploaded and generated files associated with a transaction ID.
    Executes in a background task to prevent blocking API responses.
    """
    def delete_transaction_files():
        paths_to_delete = [
            os.path.join(UPLOAD_DIR, f"person_{id}.jpg"),
            os.path.join(UPLOAD_DIR, f"cloth_{id}.jpg"),
            os.path.join(OUTPUT_DIR, f"result_{id}.jpg")
        ]
        for path in paths_to_delete:
            if os.path.exists(path):
                try:
                    os.remove(path)
                    print(f"Deleted temporary session file: {path}")
                except Exception as e:
                    print(f"Warning: Failed to delete session file {path}: {e}")
                    
    background_tasks.add_task(delete_transaction_files)
    return {"status": "success", "message": "Cleanup task scheduled."}
