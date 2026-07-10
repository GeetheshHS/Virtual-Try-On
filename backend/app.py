import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routes import tryon as tryon_router
from download_models import verify_models_exist, download_all_models

app = FastAPI(
    title="AI-Powered Virtual Try-On API",
    description="Local Virtual Try-On API backend running CatVTON and Stable Diffusion Inpainting.",
    version="1.0.0"
)

# CORS configuration
# Restrict to standard Vite local development client origins
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup hook to verify and download required weights
@app.on_event("startup")
async def startup_event():
    print("Checking model checkpoints in backend/models/...")
    if not verify_models_exist():
        print("Model checkpoints missing or incomplete! Starting automatic download...")
        try:
            download_all_models()
        except Exception as e:
            print(f"CRITICAL: Failed to automatically download models: {e}")
            print("Please run 'python download_models.py' manually.")
    else:
        print("All model checkpoints are present locally. Application ready.")

# Mount static asset folders for uploads and generated outputs
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/uploads", StaticFiles(directory=os.path.join(BASE_DIR, "uploads")), name="uploads")
app.mount("/outputs", StaticFiles(directory=os.path.join(BASE_DIR, "outputs")), name="outputs")

# Include routers
app.include_router(tryon_router.router, tags=["Virtual Try-On"])

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "AI Virtual Try-On Local API Server is active.",
        "docs_url": "/docs"
    }
