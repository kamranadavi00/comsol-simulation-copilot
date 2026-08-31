from typing import Any, Literal

from pydantic import BaseModel, Field


class CoordinateColumns(BaseModel):
    x: str
    y: str
    z: str | None = None


class MeshMetadata(BaseModel):
    available: bool = True
    source: Literal["original"] = "original"
    node_count: int = Field(alias="nodeCount")
    element_count: int = Field(alias="elementCount")
    element_type_counts: dict[str, int] = Field(alias="elementTypeCounts")
    domain_count: int | None = Field(default=None, alias="domainCount")
    boundary_count: int | None = Field(default=None, alias="boundaryCount")
    mesh_dimension: Literal["1D", "2D", "3D"] = Field(alias="meshDimension")
    node_fields: list[str] = Field(default_factory=list, alias="nodeFields")
    element_fields: list[str] = Field(default_factory=list, alias="elementFields")
    visualization_tier: Literal["full", "surface", "decimated", "progressive"] = Field(
        alias="visualizationTier"
    )


class DatasetMetadata(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    filename: str
    row_count: int = Field(alias="rowCount")
    dimension: Literal["2D", "3D"]
    coordinate_columns: CoordinateColumns = Field(alias="coordinateColumns")
    fields: list[str]
    bounds: dict[str, tuple[float, float]]
    mesh: MeshMetadata | None = None


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


class MeshCoordinates(BaseModel):
    x: list[float]
    y: list[float]
    z: list[float]


class MeshDataResponse(BaseModel):
    dataset_id: str = Field(alias="datasetId")
    source: Literal["original"] = "original"
    node_ids: list[str] = Field(alias="nodeIds")
    coordinates: MeshCoordinates
    node_fields: dict[str, list[float | None]] = Field(alias="nodeFields")
    element_ids: list[str] = Field(alias="elementIds")
    element_types: list[str] = Field(alias="elementTypes")
    element_offsets: list[int] = Field(alias="elementOffsets")
    connectivity: list[int]
    domain_ids: list[str | None] = Field(alias="domainIds")
    boundary_ids: list[str | None] = Field(alias="boundaryIds")
    element_fields: dict[str, list[float | None]] = Field(alias="elementFields")
    surface_triangles: list[int] = Field(alias="surfaceTriangles")
    surface_owners: list[int] = Field(alias="surfaceOwners")
    surface_edges: list[int] = Field(alias="surfaceEdges")
    all_edges: list[int] = Field(alias="allEdges")
    statistics: MeshMetadata


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
