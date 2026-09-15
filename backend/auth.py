
import os
import sqlite3
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(
    BASE_DIR,
    "data",
    "inspectra.db"
)

SECRET_KEY = "INSPECTRA_CHANGE_THIS_SECRET_KEY"
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24



def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError(
            "Password must be 72 bytes or fewer."
        )

    return bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt()
    ).decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    password_bytes = plain_password.encode("utf-8")

    if len(password_bytes) > 72:
        return False

    return bcrypt.checkpw(
        password_bytes,
        hashed_password.encode("utf-8")
    )


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expire
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def decode_access_token(token: str):
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            return None

        return int(user_id)

    except (JWTError, ValueError, TypeError):
        return None


def create_user(
    name: str,
    email: str,
    password: str
):
    name = name.strip()
    email = email.strip().lower()

    if not name:
        return {
            "success": False,
            "error": "Name is required."
        }

    if not email:
        return {
            "success": False,
            "error": "Email is required."
        }

    if not password:
        return {
            "success": False,
            "error": "Password is required."
        }

    if len(password) < 6:
        return {
            "success": False,
            "error": "Password must contain at least 6 characters."
        }

    conn = get_db()

    try:
        existing_user = conn.execute(
            "SELECT id FROM users WHERE email = ?",
            (email,)
        ).fetchone()

        if existing_user:
            return {
                "success": False,
                "error": "An account with this email already exists."
            }

        password_hash = hash_password(password)

        cursor = conn.execute(
            """
            INSERT INTO users
            (name, email, password_hash, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (
                name,
                email,
                password_hash,
                datetime.now(timezone.utc).isoformat()
            )
        )

        user_id = cursor.lastrowid

        conn.execute(
            """
            INSERT INTO user_settings
            (user_id)
            VALUES (?)
            """,
            (user_id,)
        )

        conn.commit()

        return {
            "success": True,
            "user_id": user_id,
            "name": name,
            "email": email
        }

    except sqlite3.IntegrityError:
        conn.rollback()

        return {
            "success": False,
            "error": "An account with this email already exists."
        }

    finally:
        conn.close()


def authenticate_user(
    email: str,
    password: str
):
    email = email.strip().lower()

    conn = get_db()

    try:
        user = conn.execute(
            """
            SELECT id, name, email, password_hash
            FROM users
            WHERE email = ?
            """,
            (email,)
        ).fetchone()

        if not user:
            return None

        if not verify_password(
            password,
            user["password_hash"]
        ):
            return None

        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }

    finally:
        conn.close()


def get_user(user_id: int):
    conn = get_db()

    try:
        user = conn.execute(
            """
            SELECT id, name, email, created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,)
        ).fetchone()

        if not user:
            return None

        return dict(user)

    finally:
        conn.close()
