from src.database.models import (
    Broker,
    Commission,
    Contract,
    DocumentType,
    Driver,
    DriverDocument,
    DriverStatus,
    EvidenceEvent,
    Load,
    Message,
    OnboardingCase,
    OnboardingDocument,
    OnboardingStatus,
    utc_now,
)


class OperationsStore:
    """Adaptador temporal en memoria para validar los contratos de la fase 1."""

    def __init__(self) -> None:
        self.drivers: dict[str, Driver] = {}
        self.documents: dict[str, DriverDocument] = {}
        self.evidence: dict[str, EvidenceEvent] = {}
        self.brokers: dict[str, Broker] = {}
        self.contracts: dict[str, Contract] = {}
        self.commissions: dict[str, Commission] = {}
        self.messages: dict[str, Message] = {}
        self.onboarding_cases: dict[str, OnboardingCase] = {}
        self.loads: dict[str, Load] = {}

    def add_driver(self, driver: Driver) -> Driver:
        self.drivers[driver.id] = driver
        return driver

    def find_driver_by_phone(self, phone: str) -> Driver | None:
        return next((driver for driver in self.drivers.values() if driver.phone == phone), None)

    def add_document(self, document: DriverDocument) -> DriverDocument:
        self.documents[document.id] = document
        return document

    def documents_for_driver(self, driver_id: str) -> list[DriverDocument]:
        return [document for document in self.documents.values() if document.driver_id == driver_id]

    def add_evidence(self, event: EvidenceEvent) -> EvidenceEvent:
        self.evidence[event.id] = event
        return event

    def evidence_for_load(self, load_id: str) -> list[EvidenceEvent]:
        return [event for event in self.evidence.values() if event.load_id == load_id]

    def add_broker(self, broker: Broker) -> Broker:
        self.brokers[broker.id] = broker
        return broker

    def add_contract(self, contract: Contract) -> Contract:
        self.contracts[contract.id] = contract
        return contract

    def add_commission(self, commission: Commission) -> Commission:
        self.commissions[commission.id] = commission
        return commission

    def commissions_by_status(self, status: str | None = None) -> list[Commission]:
        if status is None:
            return list(self.commissions.values())
        return [commission for commission in self.commissions.values() if commission.status == status]

    def add_message(self, message: Message) -> Message:
        existing_message = self.messages.get(message.id)
        if existing_message:
            return existing_message
        self.messages[message.id] = message
        return message

    def list_messages(self, sender: str | None = None) -> list[Message]:
        messages = list(self.messages.values())
        if sender is not None:
            messages = [message for message in messages if message.sender == sender]
        return messages

    def start_onboarding(self, phone: str, message: str) -> OnboardingCase:
        existing_case = self.onboarding_cases.get(phone)
        if existing_case:
            updated_case = existing_case.model_copy(
                update={"last_message": message, "updated_at": utc_now()}
            )
            self.onboarding_cases[phone] = updated_case
            return updated_case
        case = OnboardingCase(phone=phone, last_message=message)
        self.onboarding_cases[phone] = case
        return case

    def add_onboarding_document(
        self, phone: str, document: OnboardingDocument
    ) -> OnboardingCase:
        case = self.onboarding_cases.get(phone)
        if case is None:
            raise KeyError(phone)
        documents = [
            existing
            for existing in case.documents
            if existing.document_type != document.document_type
        ]
        documents.append(document)
        verified_documents = list(case.verified_documents)
        if document.verified and document.document_type not in verified_documents:
            verified_documents.append(document.document_type)
        if not document.verified:
            verified_documents = [
                item for item in verified_documents if item != document.document_type
            ]
        updated_case = case.model_copy(
            update={
                "documents": documents,
                "verified_documents": verified_documents,
                "updated_at": utc_now(),
            }
        )
        self.onboarding_cases[phone] = updated_case
        return updated_case

    def complete_onboarding(
        self, phone: str, name: str, equipment_types: list[str]
    ) -> Driver:
        case = self.onboarding_cases.get(phone)
        if case is None:
            raise KeyError(phone)
        required = set(case.required_documents)
        verified = set(case.verified_documents)
        if required - verified:
            raise ValueError("All required documents must be verified")
        if self.find_driver_by_phone(phone):
            raise ValueError("A driver with this phone already exists")

        driver = Driver(
            name=name,
            phone=phone,
            equipment_types=equipment_types,
            status=DriverStatus.ACTIVE,
        )
        self.add_driver(driver)
        for document in case.documents:
            self.add_document(
                DriverDocument(
                    driver_id=driver.id,
                    document_type=document.document_type,
                    document_url=document.document_url,
                    expires_at=document.expires_at,
                    verified=document.verified,
                )
            )
        self.onboarding_cases[phone] = case.model_copy(
            update={
                "status": OnboardingStatus.COMPLETED,
                "driver_id": driver.id,
                "name": name,
                "equipment_types": equipment_types,
                "updated_at": utc_now(),
            }
        )
        return driver

    def add_load(self, load: Load) -> Load:
        self.loads[load.id] = load
        return load