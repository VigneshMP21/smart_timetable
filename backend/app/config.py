"""
Purpose: App Configuration Settings
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Configures Pydantic Settings to manage app-wide settings
loaded from environment variables and dotenv file.

Database + Auth now use Supabase:
  - DATABASE_URL points at Supabase PostgreSQL (via the connection pooler).
  - Authentication is handled by Supabase Auth. The backend validates the
    Supabase access tokens it receives (ES256 via the project JWKS, or HS256
    via the JWT secret) and stores user profile data in a public "profiles"
    table that is linked to auth.users.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    App-wide settings loaded from environment variables or .env file.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Supabase PostgreSQL connection string (transaction pooler recommended).
    # Example:
    # postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
    DATABASE_URL: str = ""
    LOG_LEVEL: str = "INFO"
    UPLOAD_DIR: str = "./app/uploads"

    # Supabase project configuration
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    # Supabase Auth JWT secret (Dashboard -> Settings -> API -> JWT Secret).
    # Only needed to verify HS256 access tokens. Projects that issue ES256
    # access tokens (ECDSA signing key) are verified via the JWKS endpoint
    # instead, so this value is optional.
    SUPABASE_JWT_SECRET: str = ""

    # Frontend base URL (used only for documentation / email link context).
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def supabase_configured(self) -> bool:
        """
        Whether the Supabase project credentials are present in the environment.

        Access token verification needs the project URL (for JWKS) and the anon
        key. The JWT secret is optional and only used as a fallback when a token
        arrives signed with HS256.

        Returns:
            bool: True when URL and anon key are both set.
        """
        return bool(self.SUPABASE_URL and self.SUPABASE_ANON_KEY)

    @property
    def auth_jwt_secret(self) -> str:
        """
        Backward-compatible alias for the Supabase JWT secret.
        """
        return self.SUPABASE_JWT_SECRET

    @property
    def UPLOADS_PATH(self) -> Path:
        """
        Returns the absolute path to the uploads directory.
        
        Returns:
            Path: The resolved path to the uploads folder.
        """
        return Path(self.UPLOAD_DIR).resolve()

    @property
    def EXCEL_UPLOAD_PATH(self) -> Path:
        """
        Returns the absolute path to the Excel uploads directory.
        
        Returns:
            Path: The path to the uploaded excel folder.
        """
        return self.UPLOADS_PATH / "excel"

    @property
    def GENERATED_PATH(self) -> Path:
        """
        Returns the absolute path to the generated files directory.
        
        Returns:
            Path: The path to the generated files folder.
        """
        return self.UPLOADS_PATH / "generated"

    @property
    def LOG_DIR_PATH(self) -> Path:
        """
        Returns the path for logs.
        
        Returns:
            Path: The path to the logs folder.
        """
        return Path(__file__).resolve().parent.parent / "logs"


# Instantiate settings
settings = Settings()

# Ensure directories exist on import
settings.EXCEL_UPLOAD_PATH.mkdir(parents=True, exist_ok=True)
settings.GENERATED_PATH.mkdir(parents=True, exist_ok=True)
settings.LOG_DIR_PATH.mkdir(parents=True, exist_ok=True)
