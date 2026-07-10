import numpy as np
import torch
import torch.nn as nn
import cv2
from PIL import Image
from ai.model_manager import ModelManager

def generate_clothing_mask(person_image: Image.Image, category: str = "upper", preserve_arms: bool = True) -> Image.Image:
    """
    Generates a binary mask highlighting the clothing area to be replaced on the person.
    
    Categories:
    - 'upper': Masks upper-body clothes (label 4), dresses (label 7), arms (labels 14, 15), and scarves (label 17).
    - 'lower': Masks pants (label 6), skirts (label 5), and belts (label 8).
    - 'dress': Masks upper-body, lower-body, and dresses (labels 4, 5, 6, 7, 8, 14, 15, 17).
    """
    manager = ModelManager()
    manager.load_segmentation_model()
    
    processor = manager.seg_processor
    model = manager.seg_model
    device = manager.device
    
    # Preprocess image
    inputs = processor(images=person_image, return_tensors="pt").to(device)
    
    # Run inference
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits.cpu()
    
    # Upsample logits to original image size
    # SegFormer outputs logits at 1/4th the input resolution
    upsampled_logits = nn.functional.interpolate(
        logits,
        size=person_image.size[::-1], # PIL size is (width, height), interpolate expects (height, width)
        mode="bilinear",
        align_corners=False
    )
    
    pred_seg = upsampled_logits.argmax(dim=1)[0].numpy()
    
    # Create mask based on target category labels
    # Segformer B2 Clothes Label Map:
    # 4: Upper-clothes, 5: Skirt, 6: Pants, 7: Dress, 8: Belt, 14: Left-arm, 15: Right-arm, 17: Scarf
    if category == "upper":
        mask_labels = [4, 7, 17] if preserve_arms else [4, 7, 14, 15, 17]
    elif category == "lower":
        mask_labels = [5, 6, 8]
    elif category == "dress" or category == "overall":
        mask_labels = [4, 5, 6, 7, 8, 17] if preserve_arms else [4, 5, 6, 7, 8, 14, 15, 17]
    else:
        # Default to overall dress try-on
        mask_labels = [4, 5, 6, 7, 8, 17] if preserve_arms else [4, 5, 6, 7, 8, 14, 15, 17]
        
    binary_mask = np.zeros_like(pred_seg, dtype=np.uint8)
    for label in mask_labels:
        binary_mask[pred_seg == label] = 255
        
    # Edge dilation (smoothing & overlap margin for realistic diffusion borders)
    # Using OpenCV to dilate the mask edges by a small margin
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    dilated_mask = cv2.dilate(binary_mask, kernel, iterations=2)
    
    # Apply Gaussian blur to feather the edges. This creates a smooth transition
    # at the borders of the mask, preventing sharp seams or ghosting outlines.
    feathered_mask = cv2.GaussianBlur(dilated_mask, (9, 9), 0)
    
    # Convert back to PIL Image
    mask_image = Image.fromarray(feathered_mask).convert("L")
    return mask_image

def clean_garment_image(cloth_image: Image.Image, category: str = "upper") -> Image.Image:
    """
    Isolates the garment fabric in the cloth_image by masking out the model's skin,
    face, pants, and background, replacing them with a solid white background.
    """
    manager = ModelManager()
    manager.load_segmentation_model()
    
    processor = manager.seg_processor
    model = manager.seg_model
    device = manager.device
    
    # Preprocess image
    inputs = processor(images=cloth_image, return_tensors="pt").to(device)
    
    # Run inference
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits.cpu()
        
    # Upsample logits to original image size
    upsampled_logits = nn.functional.interpolate(
        logits,
        size=cloth_image.size[::-1],
        mode="bilinear",
        align_corners=False
    )
    
    pred_seg = upsampled_logits.argmax(dim=1)[0].numpy()
    
    # Keep ONLY the garment fabric (exclude skin, face, arms, pants, background)
    if category == "upper":
        keep_labels = [4, 7, 17]
    elif category == "lower":
        keep_labels = [5, 6, 8]
    else:
        keep_labels = [4, 5, 6, 7, 8, 17]
        
    binary_mask = np.zeros_like(pred_seg, dtype=np.uint8)
    for label in keep_labels:
        binary_mask[pred_seg == label] = 255
        
    # Dilate slightly to avoid cutting off edges of the garment fabric
    dilated_mask = cv2.dilate(
        binary_mask, 
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), 
        iterations=1
    )
    
    # Apply mask to cloth_image: set background (outside clothing) to solid white
    cloth_arr = np.array(cloth_image.convert("RGB"))
    cloth_arr[dilated_mask == 0] = [255, 255, 255]
    
    return Image.fromarray(cloth_arr)
