import math
import operator as operators
from collections.abc import Callable
from typing import Any

import numpy as np
import pandas as pd

from app.services.dataset_service import DatasetRecord, ensure_field
from app.services.exceptions import ActionValidationError

_OPERATORS: dict[str, Callable[[Any, float], Any]] = {
    ">": operators.gt,
    ">=": operators.ge,
    "<": operators.lt,
    "<=": operators.le,
    "==": operators.eq,
}

_MESH_SELECTION_MODES = {"any", "all", "average"}


def _filter_parameters(record: DatasetRecord, params: dict[str, Any]) -> tuple[str, str, float]:
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
    return field, comparison, value


def _selection_bounds(record: DatasetRecord, cell_indexes: list[int]) -> dict[str, list[float]] | None:
    mesh = record.mesh
    if mesh is None or not cell_indexes:
        return None
    node_indexes = {
        node_index
        for cell_index in cell_indexes
        for node_index in mesh.elements[cell_index].node_indices
    }
    coordinates = record.metadata.coordinate_columns
    bounds: dict[str, list[float]] = {}
    for axis, column in (("x", coordinates.x), ("y", coordinates.y), ("z", coordinates.z)):
        if column is None:
            bounds[axis] = [0.0, 0.0]
            continue
        values = record.dataframe.iloc[sorted(node_indexes)][column]
        bounds[axis] = [float(values.min()), float(values.max())]
    return bounds


def filter_mesh(record: DatasetRecord, params: dict[str, Any]) -> dict[str, object]:
    mesh = record.mesh
    if mesh is None:
        raise ActionValidationError("Mesh connectivity is required for mesh thresholding.")
    field, comparison, value = _filter_parameters(record, params)
    predicate = _OPERATORS[comparison]

    # A field present natively at nodes is point-associated. Element-only fields
    # are cell-associated even though the loader may project them to nodes for
    # smooth display. This keeps scientific filtering on the original values.
    association = "point" if field in mesh.point_fields else "cell" if field in mesh.element_fields else None
    if association is None:
        raise ActionValidationError(f"Field '{field}' has no mesh point or cell association.")

    selection_mode = str(params.get("selectionMode", "average")).lower()
    if selection_mode not in _MESH_SELECTION_MODES:
        raise ActionValidationError("selectionMode must be one of: any, all, average.")

    matched_point_indexes: list[int] = []
    matched_cell_indexes: list[int] = []
    if association == "cell":
        cell_values = np.asarray(
            [element.values.get(field, np.nan) for element in mesh.elements],
            dtype=np.float64,
        )
        mask = np.isfinite(cell_values) & predicate(cell_values, value)
        matched_cell_indexes = np.flatnonzero(mask).astype(int).tolist()
    else:
        point_values = pd.to_numeric(record.dataframe[field], errors="coerce").to_numpy(dtype=np.float64)
        point_mask = np.isfinite(point_values) & predicate(point_values, value)
        matched_point_indexes = np.flatnonzero(point_mask).astype(int).tolist()
        for cell_index, element in enumerate(mesh.elements):
            nodal_values = point_values[element.node_indices]
            if not np.isfinite(nodal_values).all():
                continue
            if selection_mode == "any":
                selected = bool(predicate(nodal_values, value).any())
            elif selection_mode == "all":
                selected = bool(predicate(nodal_values, value).all())
            else:
                selected = bool(predicate(float(nodal_values.mean()), value))
            if selected:
                matched_cell_indexes.append(cell_index)

    return {
        "action": "filter",
        "field": field,
        "operator": comparison,
        "value": value,
        "association": association,
        "selectionMode": selection_mode if association == "point" else None,
        "matchedCount": len(matched_cell_indexes),
        "matchedPointCount": len(matched_point_indexes),
        "matchedCellCount": len(matched_cell_indexes),
        # Indexes are positions in the exact serialized mesh arrays. Original
        # COMSOL IDs are returned beside them so consumers can verify provenance.
        "matchedPointIndexes": matched_point_indexes,
        "matchedPointIds": [mesh.node_ids[index] for index in matched_point_indexes],
        "matchedCellIndexes": matched_cell_indexes,
        "matchedCellIds": [mesh.elements[index].element_id for index in matched_cell_indexes],
        "bounds": _selection_bounds(record, matched_cell_indexes),
    }


def filter_rows(record: DatasetRecord, params: dict[str, Any]) -> dict[str, object]:
    if record.mesh is not None:
        return filter_mesh(record, params)
    field, comparison, value = _filter_parameters(record, params)

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
