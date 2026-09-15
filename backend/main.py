
import os
import shutil
import tempfile

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    Header
)
from fastapi.middleware.cors import CORSMiddleware

from unified_engine import inspect_image

from auth import (
    create_user,
    authenticate_user,
    create_access_token,
    decode_access_token,
    get_user
)

from database import (
    save_inspection,
    get_inspections,
    get_inspection,
    get_dashboard_stats
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

UPLOAD_DIR = os.path.join(
    BASE_DIR,
    "data",
    "uploads"
)

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(
    title="INSPECTRA",
    description="Multi-domain AI Visual Inspection API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# BASIC ENDPOINTS
# ============================================================

@app.get("/")
def root():
    return {
        "success": True,
        "application": "INSPECTRA",
        "message": "AI Visual Inspection API is running",
        "domains": [
            "PCB / Electronics",
            "Automotive",
            "Semiconductor / Wafer"
        ]
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy"
    }


# ============================================================
# AUTHENTICATION
# ============================================================

@app.post("/auth/register")
def register(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...)
):
    result = create_user(
        name=name,
        email=email,
        password=password
    )

    if not result["success"]:
        return result

    token = create_access_token(
        result["user_id"]
    )

    return {
        "success": True,
        "message": "Account created successfully.",
        "token": token,
        "user": {
            "id": result["user_id"],
            "name": result["name"],
            "email": result["email"]
        }
    }


@app.post("/auth/login")
def login(
    email: str = Form(...),
    password: str = Form(...)
):
    user = authenticate_user(
        email=email,
        password=password
    )

    if not user:
        return {
            "success": False,
            "error": "Invalid email or password."
        }

    token = create_access_token(
        user["id"]
    )

    return {
        "success": True,
        "message": "Login successful.",
        "token": token,
        "user": user
    }


def get_authenticated_user(
    authorization: str | None
):
    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        return None

    token = authorization.replace(
        "Bearer ",
        "",
        1
    ).strip()

    user_id = decode_access_token(token)

    if user_id is None:
        return None

    return get_user(user_id)


@app.get("/auth/me")
def current_user(
    authorization: str | None = Header(default=None)
):
    user = get_authenticated_user(
        authorization
    )

    if not user:
        return {
            "success": False,
            "error": "Authentication required."
        }

    return {
        "success": True,
        "user": user
    }


# ============================================================
# INSPECTION
# ============================================================

@app.post("/inspect")
async def inspect(
    domain: str = Form(...),
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None)
):

    # --------------------------------------------------------
    # AUTHENTICATION
    # --------------------------------------------------------

    user = get_authenticated_user(
        authorization
    )

    if not user:
        return {
            "success": False,
            "error": "Authentication required."
        }


    # --------------------------------------------------------
    # VALIDATE FILE
    # --------------------------------------------------------

    if not file.filename:
        return {
            "success": False,
            "error": "No file supplied."
        }


    # --------------------------------------------------------
    # SAVE ORIGINAL UPLOAD
    # --------------------------------------------------------

    original_extension = os.path.splitext(
        file.filename
    )[1].lower()

    safe_filename = (
        f"user_{user['id']}_"
        f"{os.urandom(8).hex()}"
        f"{original_extension}"
    )

    saved_image_path = os.path.join(
        UPLOAD_DIR,
        safe_filename
    )


    # --------------------------------------------------------
    # TEMP FILE FOR AI
    # --------------------------------------------------------

    temp_path = None

    try:

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=original_extension
        ) as temp_file:

            temp_path = temp_file.name

            shutil.copyfileobj(
                file.file,
                temp_file
            )


        # ----------------------------------------------------
        # SAVE A PERMANENT COPY
        # ----------------------------------------------------

        shutil.copy2(
            temp_path,
            saved_image_path
        )


        # ----------------------------------------------------
        # RUN ACTUAL AI ENGINE
        # ----------------------------------------------------

        result = inspect_image(
            temp_path,
            domain
        )


        # ----------------------------------------------------
        # HANDLE AI FAILURE
        # ----------------------------------------------------

        if not result.get("success"):

            if os.path.exists(saved_image_path):
                os.remove(saved_image_path)

            return result


        # ----------------------------------------------------
        # ADD METADATA
        # ----------------------------------------------------

        result["filename"] = file.filename
        result["user_id"] = user["id"]


        # ----------------------------------------------------
        # SAVE INSPECTION TO DATABASE
        # ----------------------------------------------------

        inspection_id = save_inspection(
            user_id=user["id"],
            filename=file.filename,
            domain=result.get(
                "domain",
                domain
            ),
            result=result,
            image_path=saved_image_path
        )


        result["inspection_id"] = inspection_id
        result["saved"] = True


        return result


    except Exception as e:

        if os.path.exists(saved_image_path):

            try:
                os.remove(saved_image_path)
            except Exception:
                pass

        return {
            "success": False,
            "error": str(e)
        }


    finally:

        if (
            temp_path
            and os.path.exists(temp_path)
        ):

            try:
                os.remove(temp_path)

            except Exception:
                pass


# ============================================================
# HISTORY
# ============================================================

@app.get("/history")
def history(
    authorization: str | None = Header(default=None)
):

    user = get_authenticated_user(
        authorization
    )

    if not user:
        return {
            "success": False,
            "error": "Authentication required."
        }


    inspections = get_inspections(
        user["id"]
    )


    return {
        "success": True,
        "inspections": inspections,
        "count": len(inspections)
    }


# ============================================================
# INDIVIDUAL INSPECTION
# ============================================================

@app.get("/history/{inspection_id}")
def history_detail(
    inspection_id: int,
    authorization: str | None = Header(default=None)
):

    user = get_authenticated_user(
        authorization
    )

    if not user:
        return {
            "success": False,
            "error": "Authentication required."
        }


    inspection = get_inspection(
        inspection_id=inspection_id,
        user_id=user["id"]
    )


    if not inspection:

        return {
            "success": False,
            "error": "Inspection not found."
        }


    return {
        "success": True,
        "inspection": inspection
    }


# ============================================================
# DASHBOARD STATISTICS
# ============================================================

@app.get("/dashboard/stats")
def dashboard_stats(
    authorization: str | None = Header(default=None)
):

    user = get_authenticated_user(
        authorization
    )

    if not user:
        return {
            "success": False,
            "error": "Authentication required."
        }


    stats = get_dashboard_stats(
        user["id"]
    )


    return {
        "success": True,
        "stats": stats
    }
