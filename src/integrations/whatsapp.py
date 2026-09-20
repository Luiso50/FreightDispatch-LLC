from dataclasses import dataclass


@dataclass(frozen=True)
class IncomingWhatsAppMessage:
    message_id: str
    sender: str
    text: str


def extract_text_messages(payload: dict) -> list[IncomingWhatsAppMessage]:
    messages: list[IncomingWhatsAppMessage] = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for message in value.get("messages", []):
                text = message.get("text", {}).get("body")
                if not text:
                    continue
                messages.append(
                    IncomingWhatsAppMessage(
                        message_id=message.get("id", ""),
                        sender=message.get("from", ""),
                        text=text,
                    )
                )
    return messages