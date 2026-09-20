from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from src.agent.matching import CarrierMatch, rank_carriers_for_load
from src.database.models import Carrier, Load


class MatchingRequest(BaseModel):
    load: Load
    carriers: list[Carrier]


class ContactRequest(BaseModel):
    name: str
    company: str | None = None
    email: EmailStr
    need: str


app = FastAPI(
    title="FreightDispatch API",
    version="0.1.0",
    description="API inicial para operaciones de despacho y matching de cargas.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8080", "http://localhost:8080"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

contact_requests: list[ContactRequest] = []


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/matching/carriers", response_model=list[CarrierMatch])
def match_carriers(request: MatchingRequest) -> list[CarrierMatch]:
    return rank_carriers_for_load(request.load, request.carriers)


@app.post("/contact", status_code=201)
def create_contact_request(request: ContactRequest) -> dict[str, str]:
    contact_requests.append(request)
    return {"status": "received", "message": "Contact request received"}