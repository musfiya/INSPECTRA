
from PIL import Image
import torch
import torch.nn.functional as F
import numpy as np

from model_loader import (
    semiconductor_model,
    semiconductor_transform,
    semiconductor_classes,
    DEVICE
)


def generate_gradcam(input_tensor, target_class):
    """
    Generate a Grad-CAM style spatial activation map from
    the final convolutional layer of ResNet18.

    This is an explanatory spatial heatmap, NOT validated
    defect localization.
    """

    activations = []
    gradients = []

    target_layer = semiconductor_model.layer4[-1].conv2

    def forward_hook(module, input, output):
        activations.append(output)

    def backward_hook(module, grad_input, grad_output):
        gradients.append(grad_output[0])

    forward_handle = target_layer.register_forward_hook(forward_hook)
    backward_handle = target_layer.register_full_backward_hook(backward_hook)

    semiconductor_model.zero_grad()

    outputs = semiconductor_model(input_tensor)
    target_score = outputs[0, target_class]
    target_score.backward()

    activation = activations[0]
    gradient = gradients[0]

    # Global-average-pool gradients
    weights = gradient.mean(dim=(2, 3), keepdim=True)

    # Weighted combination of feature maps
    cam = (weights * activation).sum(dim=1, keepdim=True)

    cam = F.relu(cam)

    # Resize to model input resolution
    cam = F.interpolate(
        cam,
        size=(224, 224),
        mode="bilinear",
        align_corners=False
    )

    cam = cam[0, 0]

    # Normalize 0 -> 1
    cam_min = cam.min()
    cam_max = cam.max()

    if (cam_max - cam_min) > 1e-8:
        cam = (cam - cam_min) / (cam_max - cam_min)
    else:
        cam = torch.zeros_like(cam)

    heatmap = cam.detach().cpu().numpy()

    forward_handle.remove()
    backward_handle.remove()

    return heatmap


def inspect_semiconductor(image_path):

    image = Image.open(image_path).convert("RGB")
    width, height = image.size

    input_tensor = semiconductor_transform(image)
    input_tensor = input_tensor.unsqueeze(0).to(DEVICE)

    # ---------------------------------------------------------
    # Classification
    # ---------------------------------------------------------

    with torch.no_grad():
        outputs = semiconductor_model(input_tensor)
        probabilities = F.softmax(outputs, dim=1)
        confidence, predicted_class = torch.max(
            probabilities,
            dim=1
        )

    class_id = int(predicted_class.item())

    predicted_defect = semiconductor_classes[class_id]

    confidence_percent = float(
        confidence.item() * 100
    )

    class_probabilities = {}

    for i, class_name in enumerate(semiconductor_classes):
        class_probabilities[class_name] = round(
            float(probabilities[0][i].item() * 100),
            2
        )

    # ---------------------------------------------------------
    # Grad-CAM spatial analysis
    # ---------------------------------------------------------

    heatmap = generate_gradcam(
        input_tensor,
        class_id
    )

    # Convert heatmap to compact JSON-friendly format
    heatmap_small = Image.fromarray(
        np.uint8(heatmap * 255)
    ).resize(
        (56, 56)
    )

    heatmap_array = (
        np.asarray(heatmap_small).astype(float) / 255.0
    )

    heatmap_data = np.round(
        heatmap_array,
        3
    ).tolist()

    # ---------------------------------------------------------
    # Final result
    # ---------------------------------------------------------

    status = (
        "PASS"
        if predicted_defect == "none"
        else "FAIL"
    )

    return {
        "success": True,
        "domain": "Semiconductor / Wafer",
        "status": status,
        "inspection_type": "image_classification",

        "image": {
            "width": width,
            "height": height
        },

        "prediction": {
            "defect": predicted_defect,
            "class_id": class_id,
            "confidence": round(
                confidence_percent,
                2
            )
        },

        "class_probabilities": class_probabilities,

        "spatial_analysis": {
            "method": "Grad-CAM",
            "type": "activation_heatmap",
            "width": 56,
            "height": 56,
            "values": heatmap_data,
            "note": (
                "Heatmap shows spatial regions that "
                "influenced the ResNet18 prediction. "
                "It is not validated defect localization."
            )
        },

        "total_defects": (
            0
            if predicted_defect == "none"
            else 1
        ),

        "analysis_notes": [
            "Defect type is predicted using ResNet18.",
            "Prediction confidence is calculated using softmax probabilities.",
            "The 'none' class represents a wafer without a detected defect.",
            "Grad-CAM provides an explanatory spatial heatmap.",
            "The heatmap is not a validated defect bounding box."
        ]
    }
