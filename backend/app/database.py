"""
Purpose: Database connection and Session Management
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Configures the SQLAlchemy async database connection against
Supabase PostgreSQL (asyncpg driver), the sessionmaker, and declares the
declarative Base for models.

Supabase notes:
  - The backend connects with the database credentials from DATABASE_URL.
    Transaction-mode pooling (port 6543) is recommended for serverless hosts.
  - Row-level security is bypassed for the backend because data access uses
    the service role connection; RLS is enabled for the future browser-direct
    path and the profiles table.
"""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.config import settings


def _async_database_url(url: str) -> str:
    """
    Normalize a Postgres connection string for the asyncpg driver.

    Converts postgres/postgresql URLs to postgresql+asyncpg and ensures an
    SSL mode is requested (Supabase requires TLS).

    Args:
        url (str): Raw DATABASE_URL value.

    Returns:
        str: URL usable by SQLAlchemy's asyncpg dialect.
    """
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]
    return url


database_url = _async_database_url(settings.DATABASE_URL)

# Create the async engine
engine = create_async_engine(
    database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=10,
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Declarative base model
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency generator for obtaining an asynchronous database session.
    Yields the session and ensures proper cleanup (closing the session) afterwards.

    Yields:
        AsyncSession: The database session instance.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
