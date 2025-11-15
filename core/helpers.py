"""Helper functions for the application."""

import json
from pathlib import Path
from typing import cast

from core.models import ProvincesData

PROVINCES_FILE = Path("provinces.json")


def load_provinces() -> ProvincesData:
    """Load province data from JSON file.

    Returns:
        ProvincesData: Province data model

    """
    if not PROVINCES_FILE.exists():
        return ProvincesData()
    with PROVINCES_FILE.open(encoding="utf-8") as f:
        raw_data = cast("dict[str, dict[str, object]]", json.load(f))
        return ProvincesData.model_validate(raw_data)
