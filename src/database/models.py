from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Optional

from pydantic import BaseModel, Field


class LoadStatus(StrEnum):
    AVAILABLE = "available"
    MATCHED = "matched"
    BOOKED = "booked"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class TripStatus(StrEnum):
    PENDING = "pending"
    OFFERED = "offered"
    ACCEPTED = "accepted"
    IN_TRANSIT = "in_transit"
    DELAYED = "delayed"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class InvoiceStatus(StrEnum):
    DRAFT = "draft"
    ISSUED = "issued"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    VOID = "void"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class StopStatus(StrEnum):
    PENDING = "pending"
    ARRIVED = "arrived"
    LOADED = "loaded"
    UNLOADED = "unloaded"
    SKIPPED = "skipped"


class Address(BaseModel):
    city: str
    state: str
    postal_code: Optional[str] = None
    address_line: Optional[str] = None


class Load(BaseModel):
    id: str
    origin: Address
    destination: Address
    equipment_type: str
    weight_lbs: Optional[int] = Field(default=None, ge=0)
    pickup_date: Optional[date] = None
    delivery_date: Optional[date] = None
    offered_rate: Optional[Decimal] = Field(default=None, ge=0)
    status: LoadStatus = LoadStatus.AVAILABLE
    source: Optional[str] = None
    external_reference: Optional[str] = None
    notes: Optional[str] = None


class Carrier(BaseModel):
    id: str
    legal_name: str
    mc_number: Optional[str] = None
    dot_number: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    equipment_types: list[str] = Field(default_factory=list)
    active: bool = True
    notes: Optional[str] = None


class Stop(BaseModel):
    id: str
    trip_id: str
    sequence: int = Field(ge=1)
    stop_type: str
    location: Address
    scheduled_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: StopStatus = StopStatus.PENDING
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class Trip(BaseModel):
    id: str
    load_id: str
    carrier_id: str
    status: TripStatus = TripStatus.PENDING
    agreed_rate: Decimal = Field(ge=0)
    dispatcher_fee: Optional[Decimal] = Field(default=None, ge=0)
    pickup_stop_ids: list[str] = Field(default_factory=list)
    delivery_stop_ids: list[str] = Field(default_factory=list)
    current_location: Optional[Address] = None
    eta: Optional[datetime] = None
    notes: Optional[str] = None


class Contract(BaseModel):
    id: str
    trip_id: str
    contract_number: str
    customer_name: str
    carrier_name: str
    agreed_rate: Decimal = Field(ge=0)
    signed_at: Optional[datetime] = None
    document_url: Optional[str] = None
    terms: Optional[str] = None


class Invoice(BaseModel):
    id: str
    invoice_number: str
    trip_id: str
    customer_name: str
    amount: Decimal = Field(gt=0)
    issued_at: Optional[date] = None
    due_date: Optional[date] = None
    status: InvoiceStatus = InvoiceStatus.DRAFT
    document_url: Optional[str] = None
    notes: Optional[str] = None


class Payment(BaseModel):
    id: str
    invoice_id: str
    amount: Decimal = Field(gt=0)
    status: PaymentStatus = PaymentStatus.PENDING
    method: Optional[str] = None
    provider_reference: Optional[str] = None
    initiated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
