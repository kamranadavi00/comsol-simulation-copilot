import math
import operator as operators
from collections.abc import Callable
from typing import Any

import pandas as pd

from app.services.dataset_service import DatasetRecord, ensure_field
from app.services.exceptions import ActionValidationError

_OPERATORS: dict[str, Callable[[pd.Series, float], pd.Series]] = {
    ">": operators.gt,
    ">=": operators.ge,
    "<": operators.lt,
    "<=": operators.le,
    "==": operators.eq,
}


def filter_rows(record: DatasetRecord, params: dict[str, Any]) -> dict[str, object]:
    field = ensure_field(record, params.get("field"))
    comparison = params.get("operator")
    if comparison not in _OPERATORS:
        raise ActionValidationError("Operator must be one of: >, >=, <, <=, ==.")
    try:
        value = float(params["value"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ActionValidationError("A numeric filter value is required.") from exc
    if not math.isfinite(value):
        raise ActionValidationError("The filter value must be finite.")

    mask = _OPERATORS[comparison](record.dataframe[field], value).fillna(False)
    indexes = record.dataframe.index[mask].astype(int).tolist()
    visual_row_indexes = params.get("visualRowIndexes")
    if visual_row_indexes is not None:
        if not isinstance(visual_row_indexes, list) or len(visual_row_indexes) > 100_000:
            raise ActionValidationError("visualRowIndexes must be an array with at most 100000 rows.")
        row_count = len(record.dataframe)
        if any(
            isinstance(row_index, bool)
            or not isinstance(row_index, int)
            or row_index < 0
            or row_index >= row_count
            for row_index in visual_row_indexes
        ):
            raise ActionValidationError("visualRowIndexes contains an invalid dataset row.")
        returned = [row_index for row_index in visual_row_indexes if bool(mask.iloc[row_index])]
        truncated = False
    else:
        max_results = 50_000
        returned = indexes[:max_results]
        truncated = len(indexes) > max_results
    return {
        "action": "filter",
        "field": field,
        "operator": comparison,
        "value": value,
        "matchedCount": len(indexes),
        "returnedCount": len(returned),
        "truncated": truncated,
        "rowIndexes": returned,
    }
