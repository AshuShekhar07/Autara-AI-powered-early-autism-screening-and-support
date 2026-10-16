from fastapi import APIRouter

from app.assistant.ask import AskRequest, AskResponse, ask

router = APIRouter()


@router.post("/ask", response_model=AskResponse)
def ask_endpoint(req: AskRequest) -> AskResponse:
    return ask(req)
