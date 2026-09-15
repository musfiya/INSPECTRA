
import os
import sqlite3
import json
from datetime import datetime, timezone


BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

DB_PATH = os.path.join(
    BASE_DIR,
    "data",
    "inspectra.db"
)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def save_inspection(
    user_id,
    filename,
    domain,
    result,
    image_path=None
):
    conn = get_db()

    try:
        confidence = result.get(
            "average_confidence"
        )

        # Semiconductor uses prediction confidence
        # rather than average_confidence.
        if confidence is None:
            prediction = result.get(
                "prediction",
                {}
            )

            confidence = prediction.get(
                "confidence"
            )

        total_defects = result.get(
            "total_defects",
            0
        )

        status = result.get(
            "status",
            "UNKNOWN"
        )

        inspection_type = result.get(
            "inspection_type"
        )

        created_at = datetime.now(
            timezone.utc
        ).isoformat()

        cursor = conn.execute(
            """
            INSERT INTO inspections (
                user_id,
                filename,
                domain,
                status,
                inspection_type,
                confidence,
                total_defects,
                result_json,
                image_path,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                filename,
                domain,
                status,
                inspection_type,
                confidence,
                total_defects,
                json.dumps(
                    result,
                    ensure_ascii=False
                ),
                image_path,
                created_at
            )
        )

        conn.commit()

        return cursor.lastrowid

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


def get_inspections(
    user_id,
    limit=100
):
    conn = get_db()

    try:
        rows = conn.execute(
            """
            SELECT
                id,
                filename,
                domain,
                status,
                inspection_type,
                confidence,
                total_defects,
                result_json,
                image_path,
                created_at
            FROM inspections
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (
                user_id,
                limit
            )
        ).fetchall()

        inspections = []

        for row in rows:

            item = dict(row)

            try:
                item["result"] = json.loads(
                    item["result_json"]
                )
            except Exception:
                item["result"] = {}

            del item["result_json"]

            inspections.append(item)

        return inspections

    finally:
        conn.close()


def get_inspection(
    inspection_id,
    user_id
):
    conn = get_db()

    try:
        row = conn.execute(
            """
            SELECT
                id,
                filename,
                domain,
                status,
                inspection_type,
                confidence,
                total_defects,
                result_json,
                image_path,
                created_at
            FROM inspections
            WHERE id = ?
              AND user_id = ?
            """,
            (
                inspection_id,
                user_id
            )
        ).fetchone()

        if not row:
            return None

        item = dict(row)

        try:
            item["result"] = json.loads(
                item["result_json"]
            )
        except Exception:
            item["result"] = {}

        del item["result_json"]

        return item

    finally:
        conn.close()


def get_dashboard_stats(user_id):
    conn = get_db()

    try:

        total = conn.execute(
            """
            SELECT COUNT(*)
            FROM inspections
            WHERE user_id = ?
            """,
            (user_id,)
        ).fetchone()[0]


        passed = conn.execute(
            """
            SELECT COUNT(*)
            FROM inspections
            WHERE user_id = ?
              AND status = 'PASS'
            """,
            (user_id,)
        ).fetchone()[0]


        defects = conn.execute(
            """
            SELECT COALESCE(
                SUM(total_defects),
                0
            )
            FROM inspections
            WHERE user_id = ?
            """,
            (user_id,)
        ).fetchone()[0]


        avg_confidence = conn.execute(
            """
            SELECT AVG(confidence)
            FROM inspections
            WHERE user_id = ?
              AND confidence IS NOT NULL
            """,
            (user_id,)
        ).fetchone()[0]


        return {
            "total_inspections": total,
            "passed": passed,
            "failed": total - passed,
            "defects_found": defects,
            "average_confidence": (
                round(avg_confidence, 2)
                if avg_confidence is not None
                else 0.0
            )
        }

    finally:
        conn.close()
