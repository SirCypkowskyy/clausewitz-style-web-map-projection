"""Data models for province data structures."""

from pydantic import BaseModel, Field


class Province(BaseModel):
    """Province data structure.

    Attributes:
        id: Province ID
        name: Province name
        type: Province type (e.g., "land")
        owner: Province owner
        development: Development value
        trade_goods: Trade goods type
        terrain: Terrain type
        description: Province description

    """

    id: int
    name: str
    type: str
    owner: str
    development: int
    trade_goods: str
    terrain: str
    description: str


class ProvincesData(BaseModel):
    """Root data structure for provinces JSON file.

    Attributes:
        provinces: Dictionary mapping province key strings to Province objects.
                   Keys are used for lookup and may differ from province IDs.

    """

    provinces: dict[str, Province] = Field(default_factory=dict)
