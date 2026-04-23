import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import os

# Emotion classes
EMOTIONS = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

def _build_efficientnet(num_classes: int) -> nn.Module:
    model = models.efficientnet_b0(weights=None)
    model.classifier = nn.Sequential(
        nn.Dropout(0.4),
        nn.Linear(1280, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(0.3),
        nn.Linear(512, num_classes),
    )
    return model

class EmotionPredictor:
    def __init__(self, model_path=None):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "emotion_efficientnet_b0.pt")
        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        
        try:
            checkpoint = torch.load(model_path, map_location=self.device)
            num_classes = checkpoint.get("num_classes", len(EMOTIONS))
            self.model = _build_efficientnet(num_classes)
            self.model.load_state_dict(checkpoint["model_state_dict"])
            self.model.to(self.device)
            self.model.eval()
            print(f"Model loaded from {model_path}")
        except Exception as e:
            print(f"Error loading model: {e}")
            self.model = None

    def predict(self, image_path):
        if self.model is None:
            return None
        
        image = Image.open(image_path).convert('RGB')
        tensor = self.transform(image).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            logits = self.model(tensor)
            probs = torch.softmax(logits, dim=1).squeeze().cpu().numpy()
            
        dominant_idx = probs.argmax()
        return {
            "dominant": EMOTIONS[dominant_idx],
            "confidence": float(probs[dominant_idx]),
            "scores": {EMOTIONS[i]: float(probs[i]) for i in range(len(EMOTIONS))}
        }

if __name__ == "__main__":
    # Example usage
    predictor = EmotionPredictor()
    # results = predictor.predict("path_to_test_image.jpg")
    # print(results)
