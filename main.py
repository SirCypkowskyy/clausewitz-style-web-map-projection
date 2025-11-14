"""FastAPI application for serving the Clausewitz-style map projection."""

import asyncio
import json
from pathlib import Path
from typing import cast

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from core.models import ProvincesData

app = FastAPI(
    title="Clausewitz-Style Web Map Projection",
    description="Interactive map with invisible bitmap data layer for province identification",
    version="0.1.0",
)

# Mount static files directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Setup Jinja2 templates
templates = Jinja2Templates(directory="templates")

# Path to provinces JSON file
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


@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request) -> HTMLResponse:
    """Serve the main map interface.

    Returns:
        HTMLResponse: The rendered index.html template

    """
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/provinces")
async def get_provinces() -> JSONResponse:
    """Get all province data.

    Returns:
        JSONResponse: All province data

    """
    provinces_data = load_provinces()
    return JSONResponse(content=provinces_data.model_dump())


@app.get("/api/provinces/{province_id}")
async def get_province(province_id: str) -> JSONResponse:
    """Get data for a specific province.

    Args:
        province_id: The ID of the province to retrieve

    Returns:
        JSONResponse: Province data or error if not found

    Raises:
        HTTPException: If province is not found

    """
    provinces_data = load_provinces()
    province = provinces_data.provinces.get(province_id)
    if province is None:
        raise HTTPException(status_code=404, detail="Province not found")
    return JSONResponse(content=province.model_dump())


def _get_map_layer_files() -> list[str]:
    """Get map layer files synchronously.

    Returns:
        list[str]: List of map layer filenames

    """
    static_path = Path("static")

    # Find all PNG files containing "map" but exclude data_map and visual_map
    map_files: list[str] = []
    if static_path.exists():
        for file in static_path.glob("*map*.png"):
            filename = file.name
            if filename not in ["data_map.png", "visual_map.png"]:
                map_files.append(filename)

    return sorted(map_files)


@app.get("/api/map-layers")
async def get_map_layers() -> JSONResponse:
    """Get list of all available map layer files.

    Returns:
        JSONResponse: List of map layer filenames

    """
    map_files = await asyncio.to_thread(_get_map_layer_files)
    return JSONResponse(content={"layers": map_files})


def main() -> None:
    """Run the FastAPI application using uvicorn."""
    # Binding to 0.0.0.0 allows access from other devices on the network
    uvicorn.run(app, port=8000)


if __name__ == "__main__":
    main()
