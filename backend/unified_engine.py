import os


from pcb_inspection import inspect_pcb
from automotive_inspection import inspect_automotive
from semiconductor_inspection import inspect_semiconductor


def inspect_image(image_path, domain):

    if not os.path.exists(image_path):
        return {
            "success": False,
            "error": f"Image not found: {image_path}"
        }

    domain_normalized = domain.strip().lower()

    # --------------------------------------------------------
    # PCB / ELECTRONICS
    # --------------------------------------------------------

    if domain_normalized in [
        "pcb",
        "electronics",
        "pcb / electronics",
        "pcb/electronics"
    ]:
        return inspect_pcb(image_path)

    # --------------------------------------------------------
    # AUTOMOTIVE
    # --------------------------------------------------------

    elif domain_normalized in [
        "automotive",
        "automotive parts"
    ]:
        return inspect_automotive(image_path)

    # --------------------------------------------------------
    # SEMICONDUCTOR
    # --------------------------------------------------------

    elif domain_normalized in [
        "semiconductor",
        "wafer",
        "semiconductor / wafer",
        "semiconductor/wafer"
    ]:
        return inspect_semiconductor(image_path)

    # --------------------------------------------------------
    # INVALID DOMAIN
    # --------------------------------------------------------

    else:
        return {
            "success": False,
            "error": (
                f"Unsupported inspection domain: {domain}. "
                "Supported domains are PCB / Electronics, "
                "Automotive, and Semiconductor / Wafer."
            )
        }
