import hashlib
import hmac
import json
import os

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from src.agent.matching import CarrierMatch, rank_carriers_for_load
from src.agent.request_parser import parse_load_request
from src.database.models import Carrier, Load
from src.integrations.load_sources import LoadSearchCriteria, LoadSourceRegistry
from src.integrations.whatsapp import IncomingWhatsAppMessage, extract_text_messages


class MatchingRequest(BaseModel):
    load: Load
    carriers: list[Carrier]


class ContactRequest(BaseModel):
    name: str
    company: str | None = None
    email: EmailStr
    need: str


class LoadSearchRequest(BaseModel):
    origin_city: str | None = None
    origin_state: str | None = None
    destination_city: str | None = None
    destination_state: str | None = None
    equipment_type: str | None = None
    pickup_date: str | None = None
    minimum_rate: float | None = None


app = FastAPI(
    title="FreightDispatch API",
    version="0.1.0",
    description="API inicial para operaciones de despacho y matching de cargas.",
)

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:8080,http://localhost:8080,https://luiso50.github.io",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

contact_requests: list[ContactRequest] = []
load_sources = LoadSourceRegistry()
incoming_whatsapp_messages: list[IncomingWhatsAppMessage] = []


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/matching/carriers", response_model=list[CarrierMatch])
def match_carriers(request: MatchingRequest) -> list[CarrierMatch]:
    return rank_carriers_for_load(request.load, request.carriers)


@app.post("/loads/search", response_model=list[Load])
def search_loads(request: LoadSearchRequest) -> list[Load]:
    criteria = LoadSearchCriteria(**request.model_dump())
    return load_sources.search(criteria)


@app.post("/assistant/search")
def search_from_message(request: dict[str, str]) -> dict[str, object]:
    message = request.get("message", "")
    criteria = parse_load_request(message)
    return {
        "message": message,
        "criteria": criteria.__dict__,
        "loads": load_sources.search(criteria),
    }


@app.get("/webhooks/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> PlainTextResponse:
    expected_token = os.getenv("WHATSAPP_VERIFY_TOKEN")
    if hub_mode != "subscribe" or not expected_token or verify_token != expected_token:
        raise HTTPException(status_code=403, detail="Webhook verification failed")
    return PlainTextResponse(challenge or "")


@app.post("/webhooks/whatsapp")
async def receive_whatsapp_webhook(request: Request) -> dict[str, int | str]:
    raw_body = await request.body()
    app_secret = os.getenv("WHATSAPP_APP_SECRET")
    signature = request.headers.get("X-Hub-Signature-256", "")
    if app_secret:
        expected_signature = "sha256=" + hmac.new(
            app_secret.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            raise HTTPException(status_code=403, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from error

    messages = extract_text_messages(payload)
    incoming_whatsapp_messages.extend(messages)
    return {"status": "received", "messages": len(messages)}


@app.post("/contact", status_code=201)
def create_contact_request(request: ContactRequest) -> dict[str, str]:
    contact_requests.append(request)
    return {"status": "received", "message": "Contact request received"}