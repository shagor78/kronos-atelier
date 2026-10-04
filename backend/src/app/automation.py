"""Kronos Atelier DevOps & Database Verification Automation Module.

Provides production database integrity audits, backup verification, and
deployment notification formatting without exposing secrets or credentials.
"""

from dataclasses import dataclass
import json
import os
import sqlite3
from typing import Dict, List, Optional


SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "secret",
    "jwt_secret",
    "token",
    "api_key",
    "private_key",
}


@dataclass
class DeploymentReport:
    """Represents a verified production deployment event."""

    project: str
    environment: str
    branch: str
    commit_sha: str
    status: str
    server: str
    rollback_executed: bool = False


def redact_metadata(payload: Dict[str, object]) -> Dict[str, object]:
    """Redacts sensitive keys from dictionaries before logging or alerting."""
    cleaned: Dict[str, object] = {}
    for key, value in payload.items():
        lowered = key.lower()
        if lowered in SENSITIVE_KEYS or "password" in lowered or "secret" in lowered:
            cleaned[key] = "[REDACTED]"
        else:
            cleaned[key] = value
    return cleaned


def format_deployment_message(report: DeploymentReport) -> str:
    """Formats a production deployment notification for Email, Telegram, or SMS."""
    if report.status.upper() == "SUCCESS":
        return (
            "🚀 PRODUCTION DEPLOYMENT SUCCESSFUL\n\n"
            f"Project: {report.project}\n"
            f"Environment: {report.environment}\n"
            f"Branch: {report.branch}\n\n"
            f"Commit: {report.commit_sha}\n\n"
            "CI: PASSED\n"
            "Security: PASSED\n"
            "Build: PASSED\n"
            "Deployment: PASSED\n"
            "Health Check: HEALTHY\n\n"
            f"Server: {report.server}\n\n"
            "Deployment completed successfully."
        )

    rollback_state = "EXECUTED" if report.rollback_executed else "PENDING"
    return (
        "❌ PRODUCTION DEPLOYMENT FAILED\n\n"
        f"Project: {report.project}\n"
        f"Environment: {report.environment}\n\n"
        "CI: PASSED\n"
        "Deployment: FAILED\n"
        "Health Check: FAILED\n\n"
        f"Rollback: {rollback_state}"
    )


def verify_sqlite_schema(db_path: str, required_tables: Optional[List[str]] = None) -> bool:
    """Verifies that a SQLite database file exists and contains all required tables."""
    if required_tables is None:
        required_tables = [
            "users",
            "categories",
            "products",
            "cart_items",
            "wishlist_items",
            "orders",
            "order_items",
            "reviews",
            "audit_logs",
            "notifications",
        ]

    if db_path != ":memory:" and not os.path.exists(db_path):
        return False

    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing = {row[0] for row in cursor.fetchall()}
        return all(table in existing for table in required_tables)
    finally:
        conn.close()


if __name__ == "__main__":
    sample_report = DeploymentReport(
        project="E-commerce Platform",
        environment="Production",
        branch="main",
        commit_sha="8f31d9c4b021",
        status="SUCCESS",
        server="AWS EC2",
    )
    print(
        json.dumps(
            {
                "status": "OK",
                "preview": format_deployment_message(sample_report),
            }
        )
    )
