
from PIL import Image
from model_loader import pcb_model


def inspect_pcb(image_path):

    results = pcb_model(
        image_path,
        verbose=False
    )

    result = results[0]

    image = Image.open(image_path)
    width, height = image.size

    defects = []

    if result.boxes is not None:

        for box in result.boxes:

            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())

            x1, y1, x2, y2 = map(
                float,
                box.xyxy[0].tolist()
            )

            defect_name = pcb_model.names[class_id]

            box_width = x2 - x1
            box_height = y2 - y1

            box_area = box_width * box_height
            image_area = width * height

            area_percent = (
                box_area / image_area
            ) * 100

            center_x = (x1 + x2) / 2
            center_y = (y1 + y2) / 2

            defects.append({
                "defect": defect_name,

                "confidence": round(
                    confidence * 100,
                    2
                ),

                "box": [
                    round(x1, 2),
                    round(y1, 2),
                    round(x2, 2),
                    round(y2, 2)
                ],

                "measurements": {
                    "width": round(
                        box_width,
                        2
                    ),
                    "height": round(
                        box_height,
                        2
                    ),
                    "area_pixels": round(
                        box_area,
                        2
                    ),
                    "area_percent": round(
                        area_percent,
                        4
                    ),
                    "center": {
                        "x": round(
                            center_x,
                            2
                        ),
                        "y": round(
                            center_y,
                            2
                        )
                    }
                }
            })

    status = (
        "FAIL"
        if defects
        else "PASS"
    )

    average_confidence = (
        sum(
            d["confidence"]
            for d in defects
        ) / len(defects)
        if defects
        else 100.0
    )

    return {
        "success": True,

        "domain": "PCB / Electronics",

        "status": status,

        "inspection_type": "object_detection",

        "image": {
            "width": width,
            "height": height
        },

        "defects": defects,

        "total_defects": len(defects),

        "average_confidence": round(
            average_confidence,
            2
        ),

        "analysis_notes": [
            "Defects are detected using YOLO object detection.",
            "Bounding boxes provide defect localization.",
            "Area measurements are calculated from bounding boxes.",
            "Severity is not inferred because validated severity labels are unavailable."
        ]
    }
