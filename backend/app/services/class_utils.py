"""
Purpose: Class Domain Helper Utilities
Author: Smart Timetable Backend Team
Module Description: Shared helpers for the Add Class module - derives a
short code from a class/branch name and defines module defaults, so the
legacy bulk-upload flow can populate the new classes columns consistently.
"""

import re
from typing import Any, Optional, Set, Tuple

# Default section applied when a source (legacy upload) does not provide one.
DEFAULT_SECTION: str = "A"


def split_branch_token(token: str) -> Tuple[str, Optional[str]]:
    """
    Split a faculty branch token into a short code and its optional section.

    Faculty branches are stored as combined "CODE-SECTION" tokens (e.g.
    "CSE-1"). The split happens on the last "-" so short codes that themselves
    contain a dash (e.g. "AI-ML-1" -> ("AI-ML", "1")) still parse correctly.
    Tokens without a dash carry no section and match every section of the code.

    Args:
        token (str): A branch token from a faculty's branch_classes.

    Returns:
        Tuple[str, Optional[str]]: (uppercased short code, uppercased section or None).
    """
    value = " ".join((token or "").split()).upper()
    if not value:
        return "", None
    if "-" in value:
        code, _, section = value.rpartition("-")
        return code.strip(), (section.strip() or None)
    return value, None


def combine_branch_token(short_code: str, section: Optional[str]) -> str:
    """
    Build the stored branch token for a code + section pair.

    Args:
        short_code (str): The class short code (e.g. "CSE").
        section (Optional[str]): The section (e.g. "1") or None for all sections.

    Returns:
        str: "CSE-1" when a section is given, otherwise "CSE".
    """
    code = " ".join((short_code or "").split()).upper()
    sec = " ".join((section or "").split()).upper()
    if code and sec:
        return f"{code}-{sec}"
    return code


def faculty_branch_codes(faculty: Any) -> Set[str]:
    """
    Distinct short codes a faculty row covers (sections stripped).

    Args:
        faculty (Any): An object with a branch_classes attribute.

    Returns:
        Set[str]: Uppercased short codes.
    """
    codes: Set[str] = set()
    for token in (getattr(faculty, "branch_classes", None) or []):
        code, _ = split_branch_token(token)
        if code:
            codes.add(code)
    return codes


def faculty_matches_class(faculty: Any, short_code: str, section: Optional[str]) -> bool:
    """
    Whether a faculty row teaches the given class (code + section).

    A branch token with no section (e.g. "CSE") matches every section of that
    code; a combined token (e.g. "CSE-1") matches only that exact section.

    Args:
        faculty (Any): An object with a branch_classes attribute.
        short_code (str): The class short code.
        section (Optional[str]): The class section.

    Returns:
        bool: True when the faculty covers the class.
    """
    target_code = " ".join((short_code or "").split()).upper()
    target_section = " ".join((section or "").split()).upper()
    for token in (getattr(faculty, "branch_classes", None) or []):
        code, token_section = split_branch_token(token)
        if code == target_code and (token_section is None or token_section == target_section):
            return True
    return False


def derive_short_code(class_name: str) -> str:
    """
    Derive a short code from a class/branch name.

    Uses the leading character of up to three significant words
    (e.g. "Computer Science Engineering" -> "CSE"). Falls back to the first
    characters of the name when fewer words exist.

    Args:
        class_name (str): The full class/branch name.

    Returns:
        str: An uppercase short code suitable for display and search.
    """
    name = (class_name or "").strip()
    if not name:
        return ""

    words = [w for w in re.split(r"[\s\-/&]+", name) if w]
    if len(words) >= 2:
        code = "".join(word[0] for word in words[:3])
    else:
        code = name[:6]
    return code.upper()


def normalize_section(section: Optional[str]) -> str:
    """
    Normalize a section value, falling back to the module default.

    Args:
        section (Optional[str]): Raw section value from a source record.

    Returns:
        str: Uppercase single-token section (defaults to "A").
    """
    value = (section or "").strip()
    return value.upper() if value else DEFAULT_SECTION
