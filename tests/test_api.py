from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_health_check():
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


def test_matching_route_returns_compatible_carrier():
    payload = {
        'load': {
            'id': 'L-1001',
            'origin': {'city': 'Miami', 'state': 'FL'},
            'destination': {'city': 'Orlando', 'state': 'FL'},
            'equipment_type': 'Dry Van',
            'status': 'available',
        },
        'carriers': [
            {
                'id': 'C-2001',
                'legal_name': 'Atlas Logistics',
                'equipment_types': ['Dry Van', 'Reefer'],
                'active': True,
            },
            {
                'id': 'C-2002',
                'legal_name': 'Blue Route Transport',
                'equipment_types': ['Flatbed'],
                'active': True,
            },
            {
                'id': 'C-2003',
                'legal_name': 'Inactive Carrier',
                'equipment_types': ['Dry Van'],
                'active': False,
            },
        ],
    }

    response = client.post('/matching/carriers', json=payload)

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['carrier_id'] == 'C-2001'
    assert data[0]['score'] == 100
    assert 'Compatible equipment: Dry Van' in data[0]['reasons'][0]


def test_contact_request_creates_record():
    payload = {
        'name': 'Ana García',
        'company': 'FreightOps',
        'email': 'ana@freightops.com',
        'need': 'Necesito mover una carga urgente'
    }

    response = client.post('/contact', json=payload)

    assert response.status_code == 201
    assert response.json()['status'] == 'received'


def test_load_search_endpoint_returns_no_results_until_a_source_is_connected():
    response = client.post('/loads/search', json={
        'origin_state': 'FL',
        'equipment_type': 'Dry Van',
    })

    assert response.status_code == 200
    assert response.json() == []


def test_assistant_turns_whatsapp_request_into_search_criteria():
    response = client.post('/assistant/search', json={
        'message': 'Busca un reefer de Miami a Dallas para mañana'
    })

    assert response.status_code == 200
    assert response.json()['criteria'] == {
        'origin_city': 'Miami',
        'origin_state': None,
        'destination_city': 'Dallas',
        'destination_state': None,
        'equipment_type': 'Reefer',
        'pickup_date': None,
        'minimum_rate': None,
    }
    assert response.json()['loads'] == []


def test_whatsapp_webhook_receives_text_message(monkeypatch):
    monkeypatch.setenv('WHATSAPP_VERIFY_TOKEN', 'test-token')
    verification = client.get('/webhooks/whatsapp', params={
        'hub.mode': 'subscribe',
        'hub.verify_token': 'test-token',
        'hub.challenge': 'challenge-123',
    })
    assert verification.status_code == 200
    assert verification.text == 'challenge-123'

    response = client.post('/webhooks/whatsapp', json={
        'entry': [{'changes': [{'value': {'messages': [{
            'id': 'wamid.test',
            'from': '17868365612',
            'text': {'body': 'Busca dry van de Miami a Dallas'},
        }]}}]}]
    })

    assert response.status_code == 200
    assert response.json()['status'] == 'received'


def test_whatsapp_webhook_validates_meta_signature(monkeypatch):
    import hashlib
    import hmac
    import json

    secret = 'app-secret'
    monkeypatch.setenv('WHATSAPP_APP_SECRET', secret)
    payload = {'entry': []}
    raw_body = json.dumps(payload).encode()
    signature = 'sha256=' + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()

    valid = client.post('/webhooks/whatsapp', content=raw_body, headers={
        'X-Hub-Signature-256': signature,
        'Content-Type': 'application/json',
    })
    invalid = client.post('/webhooks/whatsapp', content=raw_body, headers={
        'X-Hub-Signature-256': 'sha256=invalid',
        'Content-Type': 'application/json',
    })

    assert valid.status_code == 200
    assert invalid.status_code == 403
