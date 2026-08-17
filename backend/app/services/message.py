from app.schemas.message import MessageRequest, MessageResponse


def echo_message(payload: MessageRequest) -> MessageResponse:
    return MessageResponse(response=payload.message)

