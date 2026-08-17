from typing import Any

import numpy as np
import pandas as pd

from app.services.dataset_service import DatasetRecord, ensure_field
from app.services.exceptions import ActionValidationError


def create_profile(record: DatasetRecord, params: dict[str, Any]) -> dict[str, object]:
    field = ensure_field(record, params.get("field"))
    axis = params.get("axis")
    coordinate_map = {
        "x": record.metadata.coordinate_columns.x,
        "y": record.metadata.coordinate_columns.y,
    }
    if record.metadata.coordinate_columns.z:
        coordinate_map["z"] = record.metadata.coordinate_columns.z
    if axis not in coordinate_map:
        valid = ", ".join(coordinate_map)
        raise ActionValidationError(f"Profile axis must be one of: {valid}.")

    columns = list(coordinate_map.values()) + [field]
    frame = record.dataframe[columns].dropna()
    if frame.empty:
        raise ActionValidationError("No complete points are available for this profile.")

    other_columns = [column for key, column in coordinate_map.items() if key != axis]
    if other_columns:
        distances = np.zeros(len(frame), dtype=float)
        for column in other_columns:
            values = frame[column].to_numpy(dtype=float)
            span = float(np.ptp(values)) or 1.0
            distances += ((values - float(np.median(values))) / span) ** 2
        sample_size = min(len(frame), max(20, int(np.ceil(len(frame) * 0.02))))
        frame = frame.iloc[np.argsort(distances)[:sample_size]]

    axis_column = coordinate_map[axis]
    grouped = frame.groupby(axis_column, as_index=False)[field].mean().sort_values(axis_column)
    if len(grouped) > 2_000:
        positions = np.linspace(0, len(grouped) - 1, num=2_000, dtype=np.int64)
        grouped = grouped.iloc[positions]

    return {
        "action": "profile",
        "field": field,
        "axis": axis,
        "points": [
            {"position": float(row[axis_column]), "value": float(row[field])}
            for _, row in grouped.iterrows()
        ],
    }

