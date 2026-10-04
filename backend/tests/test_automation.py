"""Automated Python Unit & Security Tests for Kronos Atelier Automation Layer."""

import sqlite3
import tempfile
import unittest

from backend.src.app.automation import (
    DeploymentReport,
    format_deployment_message,
    redact_metadata,
    verify_sqlite_schema,
)


class TestEcommerceAutomation(unittest.TestCase):
    """Tests deployment notifications, secret redaction, and schema verification."""

    def test_redact_metadata_removes_secrets(self) -> None:
        raw = {
            "user": "admin@kronos-atelier.com",
            "password": "SuperSecretPassword",
            "jwt_secret": "hmac-secret-value",
            "status": "HEALTHY",
        }
        sanitized = redact_metadata(raw)
        self.assertEqual(sanitized["user"], "admin@kronos-atelier.com")
        self.assertEqual(sanitized["password"], "[REDACTED]")
        self.assertEqual(sanitized["jwt_secret"], "[REDACTED]")
        self.assertEqual(sanitized["status"], "HEALTHY")

    def test_format_deployment_success_message(self) -> None:
        report = DeploymentReport(
            project="E-commerce Platform",
            environment="Production",
            branch="main",
            commit_sha="a94f2c8",
            status="SUCCESS",
            server="AWS EC2",
        )
        msg = format_deployment_message(report)
        self.assertIn("PRODUCTION DEPLOYMENT SUCCESSFUL", msg)
        self.assertIn("Health Check: HEALTHY", msg)
        self.assertIn("Server: AWS EC2", msg)

    def test_format_deployment_failure_message(self) -> None:
        report = DeploymentReport(
            project="E-commerce Platform",
            environment="Production",
            branch="main",
            commit_sha="a94f2c8",
            status="FAILED",
            server="AWS EC2",
            rollback_executed=True,
        )
        msg = format_deployment_message(report)
        self.assertIn("PRODUCTION DEPLOYMENT FAILED", msg)
        self.assertIn("Rollback: EXECUTED", msg)

    def test_verify_sqlite_schema_checks_tables(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".sqlite") as tmp:
            conn = sqlite3.connect(tmp.name)
            conn.execute("CREATE TABLE users (id TEXT PRIMARY KEY)")
            conn.execute("CREATE TABLE products (id TEXT PRIMARY KEY)")
            conn.commit()
            conn.close()

            self.assertTrue(
                verify_sqlite_schema(tmp.name, required_tables=["users", "products"])
            )
            self.assertFalse(
                verify_sqlite_schema(
                    tmp.name, required_tables=["users", "products", "missing_table"]
                )
            )


if __name__ == "__main__":
    unittest.main()
