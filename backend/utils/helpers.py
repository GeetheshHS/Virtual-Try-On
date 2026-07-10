import os
import uuid
from PIL import Image

def generate_unique_id() -> str:
    """
    Generates a unique string ID for transactions/files.
    """
    return str(uuid.uuid4())

def save_and_compress_image(input_path_or_file, output_path: str, max_size: int = 1024, quality: int = 85) -> str:
    """
    Saves and compresses an image to JPEG format, reducing file size and disk footprint.
    Resizes the image if its dimensions exceed max_size.
    """
    # Open image
    img = Image.open(input_path_or_file)
    
    # Convert RGBA to RGB for JPEG conversion
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
        
    # Calculate scale factor if size exceeds max_size
    w, h = img.size
    if max(w, h) > max_size:
        if w > h:
            new_w = max_size
            new_h = int(h * (max_size / w))
        else:
            new_h = max_size
            new_w = int(w * (max_size / h))
        img = img.resize((new_w, new_h), Image.LANCZOS)
        
    # Save image
    img.save(output_path, "JPEG", quality=quality, optimize=True)
    return output_path

def resize_maintain_aspect(image: Image.Image, size: tuple) -> Image.Image:
    """
    Resizes an image maintaining its aspect ratio. Pads the background with white.
    size: (width, height)
    """
    w, h = image.size
    target_w, target_h = size
    
    # Calculate aspect ratios
    aspect_src = w / h
    aspect_target = target_w / target_h
    
    if aspect_src > aspect_target:
        # Source is wider, scale by width
        new_w = target_w
        new_h = int(target_w / aspect_src)
    else:
        # Source is taller, scale by height
        new_h = target_h
        new_w = int(target_h * aspect_src)
        
    resized_img = image.resize((new_w, new_h), Image.LANCZOS)
    
    # Create white canvas and paste resized image centered
    canvas = Image.new("RGB", size, (255, 255, 255))
    paste_x = (target_w - new_w) // 2
    paste_y = (target_h - new_h) // 2
    canvas.paste(resized_img, (paste_x, paste_y))
    
    return canvas
