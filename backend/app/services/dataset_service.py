from __future__ import annotations

import re
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np
import pandas as pd

from app.schemas.datasets import CoordinateColumns, DatasetMetadata, MeshDataResponse, PointCoordinates, PointDataResponse
from app.services.exceptions import DatasetNotFoundError, DatasetValidationError
from app.services.mesh_service import (
    MeshRecord,
    has_mesh_connectivity,
    has_node_table,
    reconstruct_mesh,
    serialize_mesh,
)

DATASET_DIR = Path(__file__).resolve().parents[2] / "temp" / "datasets"
DATASET_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class DatasetRecord:
    path: Path
    filename: str
    dataframe: pd.DataFrame
    metadata: DatasetMetadata
    mesh: MeshRecord | None = None


_datasets: dict[str, DatasetRecord] = {}

_COORDINATE_NAMES = {
    "x": {"x", "xcoord", "xcoordinate", "coordinatex", "positionx", "posx"},
    "y": {"y", "ycoord", "ycoordinate", "coordinatey", "positiony", "posy"},
    "z": {"z", "zcoord", "zcoordinate", "coordinatez", "positionz", "posz"},
}


def _normalized_column_name(value: str) -> str:
    without_units = re.sub(r"\[[^]]*]|\([^)]*\)", "", value.lower())
    return re.sub(r"[^a-z0-9]", "", without_units)


def _prepare_csv_text(payload: bytes) -> str:
    try:
        text = payload.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = payload.decode("latin-1")
        except UnicodeDecodeError as exc:
            raise DatasetValidationError("The CSV must use UTF-8 or Latin-1 text encoding.") from exc

    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        raise DatasetValidationError("The uploaded CSV is empty.")

    header_candidate: str | None = None
    content_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("%") or stripped.startswith("#"):
            candidate = stripped[1:].strip()
            normalized = [_normalized_column_name(part) for part in re.split(r"[,;\t]", candidate)]
            if any(name in names for name in normalized for names in _COORDINATE_NAMES.values()):
                header_candidate = candidate
            continue
        content_lines.append(line)

    if not content_lines:
        raise DatasetValidationError("The CSV does not contain data rows.")

    first_parts = re.split(r"[,;\t]", content_lines[0])
    first_row_is_numeric = all(_is_number(part.strip()) for part in first_parts if part.strip())
    if first_row_is_numeric and header_candidate:
        content_lines.insert(0, header_candidate)

    return "\n".join(content_lines)


def _is_number(value: str) -> bool:
    try:
        float(value)
    except ValueError:
        return False
    return True


def _parse_dataframe(payload: bytes) -> pd.DataFrame:
    prepared = _prepare_csv_text(payload)
    try:
        dataframe = pd.read_csv(StringIO(prepared), sep=None, engine="python")
    except (pd.errors.ParserError, UnicodeError, ValueError) as exc:
        raise DatasetValidationError("The CSV could not be parsed. Check its delimiter and row format.") from exc

    if dataframe.empty:
        raise DatasetValidationError("The CSV does not contain any data rows.")

    dataframe.columns = [str(column).strip() for column in dataframe.columns]
    for column in dataframe.columns:
        if not pd.api.types.is_numeric_dtype(dataframe[column]):
            converted = pd.to_numeric(dataframe[column], errors="coerce")
            if converted.notna().sum() >= max(1, int(len(dataframe) * 0.5)):
                dataframe[column] = converted
    return dataframe


def detect_coordinates(dataframe: pd.DataFrame) -> CoordinateColumns:
    found: dict[str, str] = {}
    for axis, aliases in _COORDINATE_NAMES.items():
        for column in dataframe.columns:
            if _normalized_column_name(column) in aliases and pd.api.types.is_numeric_dtype(dataframe[column]):
                found[axis] = column
                break

    if "x" not in found or "y" not in found:
        raise DatasetValidationError(
            "The dataset must contain numeric X and Y coordinate columns (Z is optional)."
        )
    return CoordinateColumns(x=found["x"], y=found["y"], z=found.get("z"))


def detect_numeric_fields(dataframe: pd.DataFrame, coordinates: CoordinateColumns) -> list[str]:
    coordinate_names = {coordinates.x, coordinates.y, coordinates.z}
    fields = [
        column
        for column in dataframe.columns
        if column not in coordinate_names and pd.api.types.is_numeric_dtype(dataframe[column])
    ]
    fields = [field for field in fields if dataframe[field].notna().any()]
    if not fields:
        raise DatasetValidationError("The dataset must contain at least one numeric scalar field.")
    return fields


def _coordinate_map(coordinates: CoordinateColumns) -> dict[str, str]:
    result = {"x": coordinates.x, "y": coordinates.y}
    if coordinates.z:
        result["z"] = coordinates.z
    return result


def get_bounds(dataframe: pd.DataFrame, coordinates: CoordinateColumns) -> dict[str, tuple[float, float]]:
    bounds: dict[str, tuple[float, float]] = {}
    for axis, column in _coordinate_map(coordinates).items():
        series = dataframe[column].dropna()
        bounds[axis] = (float(series.min()), float(series.max()))
    return bounds


def register_dataset(payload: bytes, filename: str) -> DatasetMetadata:
    dataframe = _parse_dataframe(payload)
    mesh: MeshRecord | None = None
    if has_node_table(dataframe) and has_mesh_connectivity(dataframe):
        dataframe, mesh_coordinates, mesh = reconstruct_mesh(dataframe, dataframe)
        coordinates = CoordinateColumns(
            x=mesh_coordinates["x"],
            y=mesh_coordinates["y"],
            z=mesh_coordinates.get("z"),
        )
    else:
        coordinates = detect_coordinates(dataframe)
    coordinate_columns = list(_coordinate_map(coordinates).values())
    dataframe = dataframe.dropna(subset=coordinate_columns).reset_index(drop=True)
    if dataframe.empty:
        raise DatasetValidationError("No rows contain complete coordinate values.")

    fields = list(dict.fromkeys([*mesh.node_fields, *mesh.element_fields])) if mesh else detect_numeric_fields(dataframe, coordinates)
    if not fields:
        raise DatasetValidationError("The mesh must contain at least one numeric node or element result field.")
    dataset_id = str(uuid4())
    path = DATASET_DIR / f"{dataset_id}.csv"
    path.write_bytes(payload)

    metadata = DatasetMetadata(
        datasetId=dataset_id,
        filename=filename,
        rowCount=len(dataframe),
        dimension="3D" if coordinates.z else "2D",
        coordinateColumns=coordinates,
        fields=fields,
        bounds=get_bounds(dataframe, coordinates),
        mesh=mesh.statistics if mesh else None,
    )
    _datasets[dataset_id] = DatasetRecord(
        path=path,
        filename=filename,
        dataframe=dataframe,
        metadata=metadata,
        mesh=mesh,
    )
    return metadata


def register_dataset_files(files: list[tuple[str, bytes]]) -> DatasetMetadata:
    if not files:
        raise DatasetValidationError("At least one CSV file is required.")
    parsed = [(filename, _parse_dataframe(payload), payload) for filename, payload in files]
    node_candidates = [item for item in parsed if has_node_table(item[1])]
    element_candidates = [item for item in parsed if has_mesh_connectivity(item[1])]
    if not node_candidates or not element_candidates:
        raise DatasetValidationError(
            "Separate mesh upload requires a node table with node IDs/coordinates and an element table with connectivity."
        )
    node_name, node_frame, node_payload = node_candidates[0]
    element_names = {filename for filename, _, _ in element_candidates}
    element_frame = pd.concat(
        [frame for _, frame, _ in element_candidates],
        ignore_index=True,
        sort=False,
    )
    result_frames = [
        frame
        for filename, frame, _ in parsed
        if filename != node_name and filename not in element_names
    ]
    dataframe, mesh_coordinates, mesh = reconstruct_mesh(node_frame, element_frame, result_frames)
    coordinates = CoordinateColumns(
        x=mesh_coordinates["x"],
        y=mesh_coordinates["y"],
        z=mesh_coordinates.get("z"),
    )
    coordinate_names = list(_coordinate_map(coordinates).values())
    dataframe = dataframe.dropna(subset=coordinate_names).reset_index(drop=True)
    if not mesh.node_fields:
        raise DatasetValidationError("The mesh must contain at least one numeric node or element result field.")

    dataset_id = str(uuid4())
    path = DATASET_DIR / f"{dataset_id}.csv"
    path.write_bytes(node_payload)
    display_name = " + ".join(filename for filename, _, _ in parsed)
    metadata = DatasetMetadata(
        datasetId=dataset_id,
        filename=display_name,
        rowCount=len(dataframe),
        dimension="3D" if coordinates.z else "2D",
        coordinateColumns=coordinates,
        fields=list(dict.fromkeys([*mesh.node_fields, *mesh.element_fields])),
        bounds=get_bounds(dataframe, coordinates),
        mesh=mesh.statistics,
    )
    _datasets[dataset_id] = DatasetRecord(
        path=path,
        filename=display_name,
        dataframe=dataframe,
        metadata=metadata,
        mesh=mesh,
    )
    return metadata


def get_record(dataset_id: str) -> DatasetRecord:
    try:
        return _datasets[dataset_id]
    except KeyError as exc:
        raise DatasetNotFoundError(f"Dataset '{dataset_id}' was not found or has expired.") from exc


def get_metadata(dataset_id: str) -> DatasetMetadata:
    return get_record(dataset_id).metadata


def load_dataset(dataset_id: str) -> pd.DataFrame:
    return get_record(dataset_id).dataframe


def get_points(dataset_id: str, max_points: int) -> PointDataResponse:
    record = get_record(dataset_id)
    dataframe = record.dataframe
    total = len(dataframe)
    if total > max_points:
        positions = np.linspace(0, total - 1, num=max_points, dtype=np.int64)
        sample = dataframe.iloc[positions]
        row_indexes = positions.tolist()
    else:
        sample = dataframe
        row_indexes = list(range(total))

    coordinates = record.metadata.coordinate_columns
    z_values = sample[coordinates.z].astype(float).tolist() if coordinates.z else None
    field_values: dict[str, list[float | None]] = {}
    for field in record.metadata.fields:
        field_values[field] = [float(value) if pd.notna(value) else None for value in sample[field]]

    return PointDataResponse(
        datasetId=dataset_id,
        totalPoints=total,
        returnedPoints=len(sample),
        downsampled=total > max_points,
        rowIndexes=row_indexes,
        coordinates=PointCoordinates(
            x=sample[coordinates.x].astype(float).tolist(),
            y=sample[coordinates.y].astype(float).tolist(),
            z=z_values,
        ),
        fields=field_values,
    )


def get_mesh(dataset_id: str) -> MeshDataResponse:
    record = get_record(dataset_id)
    if record.mesh is None:
        raise DatasetValidationError(
            "Mesh connectivity is not available in this dataset. The exact COMSOL mesh cannot be recovered from coordinates alone."
        )
    return serialize_mesh(
        dataset_id,
        record.dataframe,
        record.metadata.coordinate_columns,
        record.mesh,
    )


def serialize_location(row: pd.Series, coordinates: CoordinateColumns) -> dict[str, float]:
    location = {"x": float(row[coordinates.x]), "y": float(row[coordinates.y])}
    if coordinates.z:
        location["z"] = float(row[coordinates.z])
    return location


def ensure_field(record: DatasetRecord, field: Any) -> str:
    if not isinstance(field, str) or not field:
        raise DatasetValidationError("A field name is required.")
    if field not in record.metadata.fields:
        raise DatasetValidationError(f"Field '{field}' is missing or is not a usable numeric field.")
    return field
