"""
Purpose: App Entry Point Runner
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Launches the FastAPI development server using Uvicorn.
"""

import uvicorn

if __name__ == "__main__":
    # Start the FastAPI application with auto-reload for development
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
