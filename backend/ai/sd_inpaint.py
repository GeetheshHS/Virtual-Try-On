import os
import torch
from PIL import Image
from diffusers import StableDiffusionInpaintPipeline, AutoencoderKL

class SDInpaintModelWrapper:
    def __init__(self):
        self.pipeline = None

    def load_model(self, model_dir: str, device: str, weight_dtype):
        # Resolve paths
        base_ckpt = os.path.join(model_dir, "stable-diffusion-inpainting")
        vae_ckpt = os.path.join(model_dir, "sd-vae-ft-mse")
        
        # We reuse the same base model checkpoint and load the standard Inpaint pipeline
        # We can also load the custom VAE for consistency in generation style
        vae_exists = os.path.exists(vae_ckpt)
        vae = AutoencoderKL.from_pretrained(vae_ckpt, local_files_only=True).to(device, dtype=weight_dtype) if vae_exists else None
        
        # Check if local checkpoint directory exists to run fully offline
        local_only = os.path.exists(base_ckpt)
        
        # Common kwargs — always disable safety_checker and feature_extractor
        # (feature_extractor folder was excluded from download intentionally)
        common_kwargs = dict(
            torch_dtype=weight_dtype,
            safety_checker=None,
            feature_extractor=None,
            requires_safety_checker=False,
            local_files_only=local_only,
        )
        
        try:
            # Load StableDiffusionInpaintPipeline
            if vae:
                self.pipeline = StableDiffusionInpaintPipeline.from_pretrained(
                    base_ckpt,
                    vae=vae,
                    **common_kwargs
                ).to(device)
            else:
                self.pipeline = StableDiffusionInpaintPipeline.from_pretrained(
                    base_ckpt,
                    **common_kwargs
                ).to(device)
        except Exception as e:
            raise RuntimeError(
                f"Failed to load Stable Diffusion Inpainting model from '{base_ckpt}'. "
                f"Make sure the model was fully downloaded (run download_models.py). "
                f"Original error: {e}"
            ) from e
            
        # Optimize memory usage
        if device == "cuda":
            try:
                self.pipeline.enable_attention_slicing()
                self.pipeline.vae.enable_slicing()
                self.pipeline.vae.enable_tiling()
                torch.cuda.empty_cache()
            except Exception as e:
                print(f"Warning: Could not enable VRAM optimizations for SD Inpaint: {e}")


    @torch.inference_mode()
    def generate(
        self,
        person_image: Image.Image,
        mask_image: Image.Image,
        prompt: str,
        num_inference_steps: int = 35,
        guidance_scale: float = 7.5,
        height: int = 512,
        width: int = 512,
        generator=None,
        **kwargs
    ) -> Image.Image:
        if self.pipeline is None:
            raise ValueError("SD Inpaint pipeline is not loaded. Call load_model first.")
        
        # Resize images to match requested dimensions
        p_img = person_image.resize((width, height), Image.LANCZOS)
        m_img = mask_image.resize((width, height), Image.NEAREST)
        
        # Execute standard diffusion inpainting
        results = self.pipeline(
            prompt=prompt,
            image=p_img,
            mask_image=m_img,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            height=height,
            width=width,
            generator=generator,
            **kwargs
        )
        
        # Post-process: blend generated result with original person image using the mask
        from ai.utils_catvton import repaint_result
        final_img = repaint_result(results.images[0], p_img, m_img)
        return final_img
