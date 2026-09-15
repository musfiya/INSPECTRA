
import os
import torch
import torch.nn as nn
from torchvision import models, transforms
from ultralytics import YOLO


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")


PCB_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "pcb_best.pt"
)

AUTOMOTIVE_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "automotive_best_yolo.pt"
)

SEMICONDUCTOR_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "semiconductor_best.pth"
)


# ============================================================
# DEVICE
# ============================================================

DEVICE = torch.device("cpu")


# ============================================================
# PCB YOLO MODEL
# ============================================================

pcb_model = YOLO(PCB_MODEL_PATH)


# ============================================================
# AUTOMOTIVE YOLO MODEL
# ============================================================

automotive_model = YOLO(AUTOMOTIVE_MODEL_PATH)


# ============================================================
# SEMICONDUCTOR RESNET18 MODEL
# ============================================================

semiconductor_checkpoint = torch.load(
    SEMICONDUCTOR_MODEL_PATH,
    map_location=DEVICE,
    weights_only=False
)

semiconductor_classes = [
    "Center",
    "Donut",
    "Edge-Loc",
    "Edge-Ring",
    "Loc",
    "Near-full",
    "Random",
    "Scratch",
    "none"
]

semiconductor_model = models.resnet18(weights=None)

semiconductor_model.fc = nn.Linear(
    semiconductor_model.fc.in_features,
    len(semiconductor_classes)
)

semiconductor_model.load_state_dict(
    semiconductor_checkpoint
    if not isinstance(semiconductor_checkpoint, dict)
    else semiconductor_checkpoint.get(
        "model_state_dict",
        semiconductor_checkpoint
    )
)

semiconductor_model = semiconductor_model.to(DEVICE)
semiconductor_model.eval()


# ============================================================
# SEMICONDUCTOR IMAGE TRANSFORM
# ============================================================

semiconductor_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.Grayscale(num_output_channels=3),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# ============================================================
# LOADER STATUS
# ============================================================

print("AI INSPECTOR MODEL LOADER")
print("=" * 50)

print("PCB Model:")
print("  ✓ YOLO loaded")
print("  Classes:", pcb_model.names)

print("\nAutomotive Model:")
print("  ✓ YOLO loaded")
print("  Classes:", automotive_model.names)

print("\nSemiconductor Model:")
print("  ✓ ResNet18 loaded")
print("  Classes:", semiconductor_classes)

print("\nDevice:", DEVICE)

print("\n✓ ALL MODELS LOADED SUCCESSFULLY")
