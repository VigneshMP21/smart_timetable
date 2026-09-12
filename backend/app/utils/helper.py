"""
Purpose: App Generic Helper Functions
Author: Scheduler Backend Team
Created Date: 2026-08-03
Module Description: Implements common list manipulations, string parsing, and configuration sanitizing logic.
"""

from typing import List, Any, Dict


def parse_comma_separated_list(input_str: Any) -> List[str]:
    """
    Parses a comma-separated string into a list of cleaned, non-empty string tokens.

    Args:
        input_str (Any): The input string to parse. If not a string, attempts basic conversion.

    Returns:
        List[str]: List of trimmed tokens.
    """
    if not input_str:
        return []
    if not isinstance(input_str, str):
        input_str = str(input_str)
    
    return [token.strip() for token in input_str.split(",") if token.strip()]


def clean_dict_keys(d: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitizes dictionary keys by removing whitespaces.

    Args:
        d (Dict[str, Any]): Dictionary to clean.

    Returns:
        Dict[str, Any]: New dictionary with trimmed keys.
    """
    return {str(k).strip(): v for k, v in d.items()}
