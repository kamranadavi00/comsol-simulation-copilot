from typing import Any, Literal

from pydantic import BaseModel, Field


class CoordinateColumns(BaseModel):
    x: str
    y: str
    z: str | None = None


class DatasetMetadata(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    filename: str
    row_count: int = Field(alias="rowCount")
    dimension: Literal["2D", "3D"]
    coordinate_columns: CoordinateColumns = Field(alias="coordinateColumns")
    fields: list[str]
    bounds: dict[str, tuple[float, float]]


class PointCoordinates(BaseModel):
    x: list[float]
    y: list[float]
    z: list[float] | None = None


class PointDataResponse(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    total_points: int = Field(alias="totalPoints")
    returned_points: int = Field(alias="returnedPoints")
    downsampled: bool
    row_indexes: list[int] = Field(alias="rowIndexes")
    coordinates: PointCoordinates
    fields: dict[str, list[float | None]]


class ActionRequest(BaseModel):
    action: Literal[
        "find_max",
        "find_min",
        "statistics",
        "filter",
        "profile",
        "nearest_point",
    ]
    params: dict[str, Any] = Field(default_factory=dict)

