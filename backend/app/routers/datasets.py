from typing import Any

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.schemas.datasets import ActionRequest, DatasetMetadata, MeshDataResponse, PointDataResponse
from app.services.action_dispatcher import execute_action
from app.services.dataset_service import get_mesh, get_points, register_dataset, register_dataset_files
from app.services.exceptions import DatasetError, DatasetNotFoundError

router = APIRouter(prefix="/datasets", tags=["datasets"])


def _http_error(error: DatasetError) -> HTTPException:
    status_code = (
        status.HTTP_404_NOT_FOUND
        if isinstance(error, DatasetNotFoundError)
        else status.HTTP_422_UNPROCESSABLE_CONTENT
    )
    return HTTPException(status_code=status_code, detail=str(error))


@router.post("/upload", response_model=DatasetMetadata, status_code=status.HTTP_201_CREATED)
async def upload_dataset(file: UploadFile = File(...)) -> DatasetMetadata:
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=400, detail="A CSV file is required.")
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail="Only .csv files are supported.")

    payload = await file.read(settings.max_upload_bytes + 1)
    await file.close()
    if not payload:
        raise HTTPException(status_code=400, detail="The uploaded CSV is empty.")
    if len(payload) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="The CSV exceeds the 50 MB upload limit.")

    try:
        return await run_in_threadpool(register_dataset, payload, filename)
    except DatasetError as error:
        raise _http_error(error) from error


@router.post("/upload-mesh", response_model=DatasetMetadata, status_code=status.HTTP_201_CREATED)
async def upload_mesh_dataset(files: list[UploadFile] = File(...)) -> DatasetMetadata:
    if not 1 <= len(files) <= 6:
        raise HTTPException(status_code=400, detail="Upload between one and six mesh CSV files.")
    received: list[tuple[str, bytes]] = []
    total_bytes = 0
    for file in files:
        filename = (file.filename or "").strip()
        if not filename or not filename.lower().endswith(".csv"):
            raise HTTPException(status_code=415, detail="Every mesh input must be a .csv file.")
        remaining = settings.max_mesh_upload_bytes - total_bytes
        payload = await file.read(remaining + 1)
        await file.close()
        if not payload:
            raise HTTPException(status_code=400, detail=f"{filename} is empty.")
        total_bytes += len(payload)
        if total_bytes > settings.max_mesh_upload_bytes:
            raise HTTPException(status_code=413, detail="The combined mesh CSV files exceed the configured mesh upload limit.")
        received.append((filename, payload))
    try:
        return await run_in_threadpool(register_dataset_files, received)
    except DatasetError as error:
        raise _http_error(error) from error


@router.get("/{dataset_id}/points", response_model=PointDataResponse)
async def dataset_points(
    dataset_id: str,
    max_points: int = Query(default=50_000, ge=100, le=100_000),
) -> PointDataResponse:
    try:
        return get_points(dataset_id, max_points)
    except DatasetError as error:
        raise _http_error(error) from error


@router.get("/{dataset_id}/mesh", response_model=MeshDataResponse)
async def dataset_mesh(dataset_id: str) -> MeshDataResponse:
    try:
        return get_mesh(dataset_id)
    except DatasetError as error:
        raise _http_error(error) from error


@router.post("/{dataset_id}/execute")
async def dataset_execute(dataset_id: str, request: ActionRequest) -> dict[str, Any]:
    try:
        return execute_action(dataset_id, request)
    except DatasetError as error:
        raise _http_error(error) from error
