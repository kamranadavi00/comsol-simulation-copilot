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

    mask = _OPERATORS[comparison](record.dataframe[field], value).fillna(False)
    indexes = record.dataframe.index[mask].astype(int).tolist()
    max_results = 50_000
    returned = indexes[:max_results]
    return {
        "action": "filter",
        "field": field,
        "operator": comparison,
        "value": value,
        "matchedCount": len(indexes),
        "returnedCount": len(returned),
        "truncated": len(indexes) > max_results,
        "rowIndexes": returned,
    }

