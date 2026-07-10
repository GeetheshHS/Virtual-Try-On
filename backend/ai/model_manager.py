import os
import gc
import torch
from ai.catvton import CatVTONModelWrapper
from ai.sd_inpaint import SDInpaintModelWrapper

class ModelManager:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(ModelManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, model_dir: str = None):
        if self._initialized:
            return
        
        # Determine the base models directory
        if model_dir:
            self.model_dir = model_dir
        else:
            # Try to resolve relative path from backend/ai/
            self.model_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
            
        # Detect device
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # Optimize precision: use FP16 for CUDA to save VRAM/RAM, FP32 for CPU (since CPU lacks FP16 support for many layers)
        self.weight_dtype = torch.float16 if self.device == "cuda" else torch.float32
        
        # Model placeholders
        self.catvton_wrapper = None
        self.sd_inpaint_wrapper = None
        self.seg_processor = None
        self.seg_model = None
        
        # Track where the models are currently resident ("cpu" vs "cuda")
        self.catvton_device = None
        self.sd_inpaint_device = None
        
        self._initialized = True
        print(f"ModelManager initialized: device={self.device}, weight_dtype={self.weight_dtype}, models_dir={self.model_dir}")

    def load_segmentation_model(self):
        """
        Loads the SegFormer clothing segmentation model from local cache.
        """
        if self.seg_model is not None:
            return
            
        from transformers import SegformerImageProcessor, AutoModelForSemanticSegmentation
        seg_model_path = os.path.join(self.model_dir, "segformer_b2_clothes")
        
        is_local = os.path.exists(seg_model_path)
        if not is_local:
            # Fallback to HF ID if local path doesn't exist
            seg_model_path = "mattmdjaga/segformer_b2_clothes"
            
        print(f"Loading SegFormer clothing segmentation model from {seg_model_path}...")
        self.seg_processor = SegformerImageProcessor.from_pretrained(seg_model_path, local_files_only=is_local)
        # SegFormer sem_seg can run on CPU or GPU. We run it on CPU or CUDA depending on availability
        self.seg_model = AutoModelForSemanticSegmentation.from_pretrained(seg_model_path, local_files_only=is_local).to(self.device)
        self.seg_model.eval()
        print("SegFormer loaded successfully.")

    def get_catvton_model(self) -> CatVTONModelWrapper:
        """
        Gets the CatVTON try-on model, moving it to GPU and moving the SD inpainting model to CPU if necessary.
        """
        # Ensure model is instantiated
        if self.catvton_wrapper is None:
            print("Instantiating CatVTON model...")
            self.catvton_wrapper = CatVTONModelWrapper()
            # Initially load directly to CPU to conserve memory during initialization, then move
            self.catvton_wrapper.load_model(self.model_dir, "cpu", self.weight_dtype)
            self.catvton_device = "cpu"
            
        # Free VRAM by offloading SD Inpaint if it is currently on CUDA
        if self.device == "cuda" and self.sd_inpaint_device == "cuda":
            print("Offloading SD Inpaint model to CPU to free VRAM...")
            self.sd_inpaint_wrapper.pipeline.to("cpu")
            self.sd_inpaint_device = "cpu"
            self.free_memory()
            
        # Load CatVTON to GPU if it's currently on CPU
        if self.device == "cuda" and self.catvton_device == "cpu":
            print("Moving CatVTON model to GPU...")
            self.catvton_wrapper.pipeline.unet.to("cuda")
            self.catvton_wrapper.pipeline.vae.to("cuda")
            self.catvton_wrapper.pipeline.device = "cuda"
            self.catvton_device = "cuda"
            self.free_memory()
            
        # If running on CPU only, ensure it's on CPU
        if self.device == "cpu":
            self.catvton_wrapper.pipeline.device = "cpu"
            self.catvton_device = "cpu"
            
        return self.catvton_wrapper

    def get_sd_inpaint_model(self) -> SDInpaintModelWrapper:
        """
        Gets the SD Inpainting model, moving it to GPU and moving the CatVTON model to CPU if necessary.
        """
        # Ensure model is instantiated
        if self.sd_inpaint_wrapper is None:
            print("Instantiating Stable Diffusion Inpaint model...")
            self.sd_inpaint_wrapper = SDInpaintModelWrapper()
            self.sd_inpaint_wrapper.load_model(self.model_dir, "cpu", self.weight_dtype)
            self.sd_inpaint_device = "cpu"
            
        # Free VRAM by offloading CatVTON if it is currently on CUDA
        if self.device == "cuda" and self.catvton_device == "cuda":
            print("Offloading CatVTON model to CPU to free VRAM...")
            self.catvton_wrapper.pipeline.unet.to("cpu")
            self.catvton_wrapper.pipeline.vae.to("cpu")
            self.catvton_wrapper.pipeline.device = "cpu"
            self.catvton_device = "cpu"
            self.free_memory()
            
        # Load SD Inpaint to GPU if it's currently on CPU
        if self.device == "cuda" and self.sd_inpaint_device == "cpu":
            print("Moving SD Inpaint model to GPU...")
            self.sd_inpaint_wrapper.pipeline.to("cuda")
            self.sd_inpaint_device = "cuda"
            self.free_memory()
            
        # If running on CPU only, ensure it's on CPU
        if self.device == "cpu":
            self.sd_inpaint_wrapper.pipeline.to("cpu")
            self.sd_inpaint_device = "cpu"
            
        return self.sd_inpaint_wrapper

    def free_memory(self):
        """
        Triggers garbage collection and empties the CUDA cache to prevent memory leaks and OOM errors.
        """
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            print("CUDA cache cleared.")
