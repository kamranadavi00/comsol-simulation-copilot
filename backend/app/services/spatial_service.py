from typing import Any

import numpy as np
from scipy.spatial import cKDTree

from app.services.dataset_service import DatasetRecord, serialize_location
from app.services.exceptions import ActionValidationError


def nearest_point(record: DatasetRecord, params: dict[str, Any]) -> dict[str, object]:
    coordinates = record.metadata.coordinate_columns
    axes = ["x", "y"] + (["z"] if coordinates.z else [])
    columns = [coordinates.x, coordinates.y] + ([coordinates.z] if coordinates.z else [])
    try:
        target = np.array([float(params[axis]) for axis in axes], dtype=float)
    except (KeyError, TypeError, ValueError) as exc:
        required = ", ".join(axes)
        raise ActionValidationError(f"Nearest-point coordinates must include numeric {required} values.") from exc

    points = record.dataframe[columns].to_numpy(dtype=float)
    _, position = cKDTree(points).query(target, k=1)
    row_index = int(position)
    row = record.dataframe.iloc[row_index]
    values = {
        field: float(row[field])
        for field in record.metadata.fields
        if not np.isnan(float(row[field]))
    }
    return {
        "action": "nearest_point",
        "rowIndex": row_index,
        "location": serialize_location(row, coordinates),
        "values": values,
    }

