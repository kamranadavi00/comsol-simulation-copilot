from typing import Literal

import pandas as pd

from app.services.dataset_service import DatasetRecord, ensure_field, serialize_location
from app.services.exceptions import ActionValidationError


def _usable_series(record: DatasetRecord, field: object) -> tuple[str, pd.Series]:
    field_name = ensure_field(record, field)
    series = record.dataframe[field_name].dropna()
    if series.empty:
        raise ActionValidationError(f"Field '{field_name}' has no finite values.")
    return field_name, series


def find_extreme(
    record: DatasetRecord,
    field: object,
    kind: Literal["max", "min"],
) -> dict[str, object]:
    field_name, series = _usable_series(record, field)
    row_index = int(series.idxmax() if kind == "max" else series.idxmin())
    row = record.dataframe.loc[row_index]
    return {
        "action": f"find_{kind}",
        "field": field_name,
        "value": float(row[field_name]),
        "rowIndex": row_index,
        "location": serialize_location(row, record.metadata.coordinate_columns),
    }


def statistics(record: DatasetRecord, field: object) -> dict[str, object]:
    field_name, series = _usable_series(record, field)
    min_index = int(series.idxmin())
    max_index = int(series.idxmax())
    minimum = float(series.loc[min_index])
    maximum = float(series.loc[max_index])
    return {
        "action": "statistics",
        "field": field_name,
        "count": int(series.count()),
        "min": minimum,
        "max": maximum,
        "mean": float(series.mean()),
        "median": float(series.median()),
        "standardDeviation": float(series.std(ddof=0)),
        "range": maximum - minimum,
        "minLocation": serialize_location(
            record.dataframe.loc[min_index], record.metadata.coordinate_columns
        ),
        "maxLocation": serialize_location(
            record.dataframe.loc[max_index], record.metadata.coordinate_columns
        ),
    }

