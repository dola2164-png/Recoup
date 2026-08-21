import pytest
import os
import sys

# Force local unit tests to use SQLite
os.environ["DATABASE_URL"] = "sqlite:///recoup.db"

# Add project root to Python search path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from unittest.mock import patch
from api.db import get_db_connection, init_db
from api.diagnose import diagnose_transaction, classify_with_groq

@pytest.fixture(autouse=True)
def setup_database():
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions")
    cursor.execute("DELETE FROM audit_log")
    conn.commit()
    conn.close()

def test_diagnose_rule_match():
    # Insert transaction with standard Razorpay error code
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO transactions (id, status, raw_reason, customer_segment, amount)
        VALUES ('pay_rule_001', 'failed', 'BAD_REQUEST_PAYMENT_CARD_INSUFFICIENT_BALANCE', 'retail', 100.0)
    """)
    conn.commit()
    conn.close()
    
    diagnosis = diagnose_transaction('pay_rule_001')
    assert diagnosis == "insufficient_funds"
    
    # Verify audit log shows 'rule' as the actor
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT actor, outcome FROM audit_log WHERE txn_id = 'pay_rule_001' AND stage = 'DIAGNOSE'")
    log = cursor.fetchone()
    assert log is not None
    assert log["actor"] == "rule"
    assert log["outcome"] == "insufficient_funds"
    conn.close()

def test_diagnose_groq_success():
    # Insert transaction with ambiguous text that requires LLM
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO transactions (id, status, raw_reason, customer_segment, amount)
        VALUES ('pay_ai_001', 'failed', 'the customer account has not enough money left to complete this transaction', 'retail', 100.0)
    """)
    conn.commit()
    conn.close()
    
    # Run diagnosis
    diagnosis = diagnose_transaction('pay_ai_001')
    
    # Llama 3.3 should classify this as insufficient_funds or needs_human_review (if it fails/times out, fallback is needs_human_review)
    assert diagnosis in ["insufficient_funds", "needs_human_review"]
    
    # Check that audit log records the path ('ai' if Groq was called, 'rule' if it fell back without key)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT actor, outcome FROM audit_log WHERE txn_id = 'pay_ai_001' AND stage = 'DIAGNOSE'")
    log = cursor.fetchone()
    assert log is not None
    assert log["actor"] in ["ai", "rule"]
    conn.close()

def test_diagnose_groq_fallback_on_error():
    # Insert transaction with ambiguous text
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO transactions (id, status, raw_reason, customer_segment, amount)
        VALUES ('pay_fallback_001', 'failed', 'something went wrong in the bank API', 'retail', 100.0)
    """)
    conn.commit()
    conn.close()
    
    # Mock classify_with_groq to raise an exception (simulating timeout or API limit)
    with patch('api.diagnose.Groq') as mock_groq:
        mock_groq.side_effect = Exception("API Connection Timeout")
        
        diagnosis = diagnose_transaction('pay_fallback_001')
        assert diagnosis == "needs_human_review"
        
        # Verify database was updated to needs_human_review
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT normalized_reason FROM transactions WHERE id = 'pay_fallback_001'")
        txn = cursor.fetchone()
        assert txn["normalized_reason"] == "needs_human_review"
        conn.close()
