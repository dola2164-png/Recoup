import pytest
from fastapi.testclient import TestClient
from api.ingest import app
from api.db import get_db_connection, init_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_database():
    # Re-initialize the database before each test
    init_db()
    
    # Clear tables to ensure fresh state
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions")
    cursor.execute("DELETE FROM audit_log")
    cursor.execute("DELETE FROM whatsapp_outbox")
    cursor.execute("DELETE FROM human_queue")
    conn.commit()
    conn.close()

def test_pipeline_insufficient_funds_retail():
    # Event 1: Payment card insufficient balance (Known code)
    payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_TEST_FUND_001",
                    "amount": 100000, # 1000 INR (in paise)
                    "currency": "INR",
                    "contact": "+919876543210",
                    "email": "customer1@example.com",
                    "error_code": "BAD_REQUEST_PAYMENT_CARD_INSUFFICIENT_BALANCE",
                    "notes": {
                        "name": "Arjun Kumar",
                        "segment": "retail"
                    }
                }
            }
        }
    }
    
    response = client.post("/webhook/razorpay", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    
    pipeline = data["pipeline_results"]
    assert pipeline["txn_id"] == "pay_TEST_FUND_001"
    assert pipeline["diagnosis"] == "insufficient_funds"
    assert pipeline["action"] == "whatsapp_nudge"
    assert pipeline["act_outcome"] == "nudge_sent_to_outbox"

    # Verify SQLite state
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check transaction row
    cursor.execute("SELECT status, attempt_count, normalized_reason FROM transactions WHERE id = ?", ("pay_TEST_FUND_001",))
    txn = cursor.fetchone()
    assert txn is not None
    assert txn["status"] == "nudge_sent"
    assert txn["attempt_count"] == 1
    assert txn["normalized_reason"] == "insufficient_funds"
    
    # Check audit log contains INGEST, DIAGNOSE, DECIDE, ACT
    cursor.execute("SELECT stage, actor, action, outcome FROM audit_log WHERE txn_id = ? ORDER BY id ASC", ("pay_TEST_FUND_001",))
    logs = cursor.fetchall()
    assert len(logs) >= 4
    stages = [log["stage"] for log in logs]
    assert "INGEST" in stages
    assert "DIAGNOSE" in stages
    assert "DECIDE" in stages
    assert "ACT" in stages
    
    # Check whatsapp outbox
    cursor.execute("SELECT customer_phone, message_body FROM whatsapp_outbox WHERE txn_id = ?", ("pay_TEST_FUND_001",))
    outbox = cursor.fetchone()
    assert outbox is not None
    assert outbox["customer_phone"] == "+919876543210"
    assert "Arjun Kumar" in outbox["message_body"]
    
    conn.close()

def test_pipeline_expired_card_smb():
    # Event 2: Payment expired card (Known code)
    payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_TEST_CARD_002",
                    "amount": 500000, # 5000 INR
                    "currency": "INR",
                    "contact": "+919876543211",
                    "email": "smb_client@example.com",
                    "error_code": "BAD_REQUEST_PAYMENT_CARD_EXPIRED",
                    "notes": {
                        "name": "Global Traders",
                        "segment": "smb"
                    }
                }
            }
        }
    }
    
    response = client.post("/webhook/razorpay", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    
    pipeline = data["pipeline_results"]
    assert pipeline["diagnosis"] == "expired_card"
    assert pipeline["action"] == "mandate_reauth_link"
    assert pipeline["act_outcome"] == "reauth_link_sent"

def test_pipeline_network_error_enterprise():
    # Event 3: Gateway error (Known code)
    payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_TEST_NET_003",
                    "amount": 1200000, # 12000 INR
                    "currency": "INR",
                    "contact": "+919876543212",
                    "email": "enterprise_client@example.com",
                    "error_code": "BAD_REQUEST_PAYMENT_TIMED_OUT",
                    "notes": {
                        "name": "Acme Corp",
                        "segment": "enterprise"
                    }
                }
            }
        }
    }
    
    response = client.post("/webhook/razorpay", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    
    pipeline = data["pipeline_results"]
    assert pipeline["diagnosis"] == "network_error"
    assert pipeline["action"] == "instant_retry"
    assert pipeline["act_outcome"] == "retry_success"
