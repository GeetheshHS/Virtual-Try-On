import os
import sys
from huggingface_hub import snapshot_download

# Base directory for checkpoints
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "models"))

def verify_models_exist():
    """
    Checks if all required model files are present locally to avoid redundant downloads.
    """
    # 1. Check SegFormer Clothes Segmenter
    segformer_path = os.path.join(BASE_DIR, "segformer_b2_clothes")
    if not (os.path.exists(os.path.join(segformer_path, "config.json")) and 
            (os.path.exists(os.path.join(segformer_path, "pytorch_model.bin")) or 
             os.path.exists(os.path.join(segformer_path, "model.safetensors")))):
        return False

    # 2. Check SD VAE
    vae_path = os.path.join(BASE_DIR, "sd-vae-ft-mse")
    if not (os.path.exists(os.path.join(vae_path, "config.json")) and 
            (os.path.exists(os.path.join(vae_path, "diffusion_pytorch_model.safetensors")) or 
             os.path.exists(os.path.join(vae_path, "diffusion_pytorch_model.bin")))):
        return False

    # 3. Check CatVTON Weights
    catvton_path = os.path.join(BASE_DIR, "CatVTON")
    attention_path = os.path.join(catvton_path, "mix-48k-1024", "attention")
    if not os.path.exists(attention_path) or len(os.listdir(attention_path)) == 0:
        return False

    # 4. Check SD Inpainting Base
    sd_inpaint_path = os.path.join(BASE_DIR, "stable-diffusion-inpainting")
    unet_path = os.path.join(sd_inpaint_path, "unet")
    scheduler_path = os.path.join(sd_inpaint_path, "scheduler")
    if not (os.path.exists(unet_path) and os.path.exists(scheduler_path)):
        return False

    return True

def download_all_models():
    """
    Downloads all required open-source model checkpoints from Hugging Face locally.
    No API keys are required.
    """
    print("=" * 60)
    print("AI Virtual Try-On Model Downloader")
    print(f"Target Directory: {BASE_DIR}")
    print("=" * 60)
    
    os.makedirs(BASE_DIR, exist_ok=True)

    # 1. SegFormer Clothes segmentation model (~100MB)
    print("\n[1/4] Checking SegFormer Clothes Segmentation Model...")
    segformer_dir = os.path.join(BASE_DIR, "segformer_b2_clothes")
    snapshot_download(
        repo_id="mattmdjaga/segformer_b2_clothes",
        local_dir=segformer_dir,
        ignore_patterns=["*.msgpack", "*.h5", "*.ot"],
        local_dir_use_symlinks=False
    )
    print("SegFormer Model checked/downloaded successfully.")

    # 2. SD VAE (~330MB)
    print("\n[2/4] Checking StabilityAI SD-VAE-FT-MSE...")
    vae_dir = os.path.join(BASE_DIR, "sd-vae-ft-mse")
    snapshot_download(
        repo_id="stabilityai/sd-vae-ft-mse",
        local_dir=vae_dir,
        ignore_patterns=["*.msgpack", "*.h5", "*.ot", "diffusion_pytorch_model.bin"], # Safetensors is preferred
        local_dir_use_symlinks=False
    )
    print("SD VAE checked/downloaded successfully.")

    # 3. CatVTON attention adapter (~150MB)
    print("\n[3/4] Checking CatVTON Attention Weights...")
    catvton_dir = os.path.join(BASE_DIR, "CatVTON")
    snapshot_download(
        repo_id="zhengchong/CatVTON",
        local_dir=catvton_dir,
        allow_patterns=["mix-48k-1024/*"],
        local_dir_use_symlinks=False
    )
    print("CatVTON checked/downloaded successfully.")

    # 4. Stable Diffusion 1.5 Inpainting Base (~4.5GB)
    print("\n[4/4] Checking runwayml/stable-diffusion-inpainting...")
    sd_inpaint_dir = os.path.join(BASE_DIR, "stable-diffusion-inpainting")
    # Only download essential folders for inpainting & text encoding
    snapshot_download(
        repo_id="runwayml/stable-diffusion-inpainting",
        local_dir=sd_inpaint_dir,
        allow_patterns=[
            "unet/*",
            "scheduler/*",
            "text_encoder/*",
            "tokenizer/*",
            "vae/*",
            "model_index.json"
        ],
        ignore_patterns=["*.msgpack", "*.h5", "*.ot", "safety_checker/*", "feature_extractor/*"],
        local_dir_use_symlinks=False
    )
    print("Base SD Inpaint model checked/downloaded successfully.")

    # Patch model_index.json to nullify safety_checker and feature_extractor
    model_index_path = os.path.join(sd_inpaint_dir, "model_index.json")
    if os.path.exists(model_index_path):
        import json
        try:
            with open(model_index_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            needs_save = False
            if "feature_extractor" in data and data["feature_extractor"] != [None, None]:
                data["feature_extractor"] = [None, None]
                needs_save = True
            if "safety_checker" in data and data["safety_checker"] != [None, None]:
                data["safety_checker"] = [None, None]
                needs_save = True
                
            if needs_save:
                print("Patching model_index.json to skip missing feature_extractor and safety_checker...")
                with open(model_index_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2)
                print("model_index.json patched successfully.")
        except Exception as e:
            print(f"Warning: Failed to patch model_index.json: {e}")
    
    print("\n" + "=" * 60)
    print("All model checkpoints downloaded and ready!")
    print("=" * 60)

if __name__ == "__main__":
    try:
        download_all_models()
    except Exception as e:
        print(f"\nError: Model download failed: {e}", file=sys.stderr)
        sys.exit(1)
