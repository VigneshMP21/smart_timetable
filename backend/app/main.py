"""
Purpose: FastAPI Application Core
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Configures the FastAPI app, mounts middleware, hooks routers, and handles database lifespan setups.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.database import engine
from app.config import settings
from app.api import auth, classes, faculties, health, rooms, subjects, upload, timetable, download, setup_config
from app.middleware.auth_middleware import AuthMiddleware
from app.utils.logger import get_logger
from app.utils.exceptions import ExcelValidationError, SchedulingFailureError, TimetableEditValidationError

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles application startup and shutdown lifespan events.

    The schema is managed via the Supabase SQL scripts in database/schema
    (profiles, classes, subjects, faculties, constraints, timetable_entries,
    RLS policies and the signup trigger), so no DDL is run here. Startup only
    verifies that the Supabase PostgreSQL connection is reachable so
    misconfiguration fails fast.
    """
    logger.info("Initializing application lifespan setup.")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Supabase PostgreSQL connection verified.")
    except Exception as e:
        logger.critical(f"Failed to connect to Supabase PostgreSQL: {str(e)}")
        raise e

    yield
    logger.info("Tearing down application lifespan.")


app = FastAPI(
    title="Automatic Timetable Scheduler API",
    description="High-performance backend utilizing constraint satisfaction solvers to generate institutional timetables.",
    version="1.0.0",
    lifespan=lifespan
)

# JWT validation for incoming requests (attaches request.state.user).
# Added first so it sits inside CORS - CORS must stay outermost so even
# rejected auth requests receive the required CORS headers.
app.add_middleware(AuthMiddleware)

# CORS configurations (outermost middleware).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(classes.router)
app.include_router(rooms.router)
app.include_router(subjects.router)
app.include_router(faculties.router)
app.include_router(upload.router)
app.include_router(setup_config.router)
app.include_router(timetable.router)
app.include_router(download.router)


@app.exception_handler(ExcelValidationError)
async def excel_validation_handler(request: Request, exc: ExcelValidationError):
    """
    Custom exception handler to return structured validation feedback.
    """
    logger.warning(f"Returning structured validation error response: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status": "failed",
            "message": exc.message,
            "errors": exc.errors
        }
    )


@app.exception_handler(SchedulingFailureError)
async def scheduling_failure_handler(request: Request, exc: SchedulingFailureError):
    """
    Custom exception handler to return scheduling failure details.
    """
    logger.error(f"Returning scheduling failure error response: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status": "failed",
            "message": exc.message
        }
    )


@app.exception_handler(TimetableEditValidationError)
async def timetable_edit_validation_handler(request: Request, exc: TimetableEditValidationError):
    """
    Custom exception handler to return manual-edit validation failures with
    the exact per-cell conflict messages.
    """
    logger.warning(f"Returning manual edit validation error response: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status": "failed",
            "message": exc.message,
            "errors": exc.errors
        }
    )


@app.get("/", tags=["Root"])
async def root():
    """
    Default root welcome message redirection to documentation.
    """
    return {
        "message": "Welcome to the Automatic Timetable Scheduler API! Please visit /docs for Swagger documentation."
    }
