import os
import torch
from PIL import Image
from ai.base_model import BaseTryOnModel
from ai.pipeline import CatVTONPipeline

class CatVTONModelWrapper(BaseTryOnModel):
    def __init__(self):
        self.pipeline = None

    def load_model(self, model_dir: str, device: str, weight_dtype):
        # Resolve paths to sub-models
        base_ckpt = os.path.join(model_dir, "stable-diffusion-inpainting")
        attn_ckpt = os.path.join(model_dir, "CatVTON")
        vae_ckpt = os.path.join(model_dir, "sd-vae-ft-mse")
        
        # Load the custom CatVTONPipeline
        self.pipeline = CatVTONPipeline(
            base_ckpt=base_ckpt,
            attn_ckpt=attn_ckpt,
            attn_ckpt_version="mix",
            weight_dtype=weight_dtype,
            device=device,
            skip_safety_check=True,
            vae_ckpt=vae_ckpt
        )
        
        # Optimize GPU memory usage for 4GB VRAM
        if device == "cuda":
            try:
                # Enable VAE slicing and tiling to reduce peak VRAM during decoding
                self.pipeline.vae.enable_slicing()
                self.pipeline.vae.enable_tiling()
                # Empty cache to free up VRAM after loading
                torch.cuda.empty_cache()
            except Exception as e:
                print(f"Warning: Could not enable VRAM optimizations: {e}")

    @torch.inference_mode()
    def generate(
        self,
        person_image: Image.Image,
        cloth_image: Image.Image,
        mask_image: Image.Image,
        num_inference_steps: int = 30, # 30 steps is much faster with matching quality
        guidance_scale: float = 2.5,
        height: int = 512,
        width: int = 512,
        **kwargs
    ) -> Image.Image:
        if self.pipeline is None:
            raise ValueError("CatVTON pipeline is not loaded. Call load_model first.")
        
        # Run inference
        results = self.pipeline(
            image=person_image,
            condition_image=cloth_image,
            mask=mask_image,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            height=height,
            width=width,
            **kwargs
        )
        
        # Post-process: blend generated result with original person image using the mask
        # to ensure that unmasked areas (face, pants, background, pose) are pixel-perfect preserved.
        from ai.utils_catvton import repaint_result
        p_img = person_image.resize((width, height), Image.LANCZOS)
        m_img = mask_image.resize((width, height), Image.NEAREST)
        
        final_img = repaint_result(results[0], p_img, m_img)
        return final_img
