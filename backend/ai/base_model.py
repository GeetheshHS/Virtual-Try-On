from abc import ABC, abstractmethod
from PIL import Image

class BaseTryOnModel(ABC):
    @abstractmethod
    def load_model(self, model_dir: str, device: str, weight_dtype):
        """
        Loads the model checkpoints from the specified directory onto the device.
        """
        pass

    @abstractmethod
    def generate(
        self,
        person_image: Image.Image,
        cloth_image: Image.Image,
        mask_image: Image.Image,
        num_inference_steps: int = 50,
        guidance_scale: float = 2.5,
        height: int = 512,
        width: int = 512,
        **kwargs
    ) -> Image.Image:
        """
        Generates the virtual try-on result.
        """
        pass
