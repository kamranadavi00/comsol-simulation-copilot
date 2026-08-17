from fastapi import APIRouter

from app.schemas.message import MessageRequest, MessageResponse
from app.services.message import echo_message

router = APIRouter(tags=["messages"])


@router.post("/message", response_model=MessageResponse)
async def create_message(payload: MessageRequest) -> MessageResponse:
    return echo_message(payload)

