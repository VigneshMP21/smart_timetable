"""
Purpose: App Logging Engine Setup
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Configures the logging systems, adding handlers for both file logging and console output.
"""

import logging
import sys
from logging.handlers import RotatingFileHandler
from app.config import settings


def setup_logger() -> None:
    """
    Sets up the global logging configuration with console and rotating file handlers.
    """
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    log_level_name = settings.LOG_LEVEL.upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    # Clear pre-existing handlers on root logger
    root_logger = logging.getLogger()
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    root_logger.setLevel(log_level)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(log_format))
    console_handler.setLevel(log_level)
    root_logger.addHandler(console_handler)

    # File handler (rotates at 5MB, keeps 5 logs)
    log_file = settings.LOG_DIR_PATH / "timetable_scheduler.log"
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setFormatter(logging.Formatter(log_format))
    file_handler.setLevel(log_level)
    root_logger.addHandler(file_handler)

    # Prevent propagation from root to sub-loggers duplicating records
    logging.getLogger("uvicorn.access").propagate = True


def get_logger(name: str) -> logging.Logger:
    """
    Retrieves a logger instance for the specified module name.

    Args:
        name (str): The name of the module invoking the logger.

    Returns:
        logging.Logger: The configured Logger instance.
    """
    return logging.getLogger(name)


# Run setup when imported to configure globally
setup_logger()
