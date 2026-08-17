from typing import Any

from app.schemas.datasets import ActionRequest
from app.services.dataset_service import get_record
from app.services.exceptions import ActionValidationError
from app.services.filter_service import filter_rows
from app.services.profile_service import create_profile
from app.services.spatial_service import nearest_point
from app.services.statistics_service import find_extreme, statistics


def execute_action(dataset_id: str, request: ActionRequest) -> dict[str, Any]:
    record = get_record(dataset_id)
    if request.action == "find_max":
        return find_extreme(record, request.params.get("field"), "max")
    if request.action == "find_min":
        return find_extreme(record, request.params.get("field"), "min")
    if request.action == "statistics":
        return statistics(record, request.params.get("field"))
    if request.action == "filter":
        return filter_rows(record, request.params)
    if request.action == "profile":
        return create_profile(record, request.params)
    if request.action == "nearest_point":
        return nearest_point(record, request.params)
    raise ActionValidationError(f"Action '{request.action}' is not supported.")

