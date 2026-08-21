from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import uuid
from datetime import datetime
from api.db import get_db_connection, init_db, get_db_cursor
from api.diagnose import diagnose_transaction
from api.decide import decide_intervention
from api.act import execute_intervention
from api.track import log_audit

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Recoup Revenue Recovery Ingestion API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database tables on startup
@app.on_event("startup")
def startup_event():
    init_db()

def process_transaction_pipeline(txn_id: str) -> dict:
    """
    Coordinates the pipeline execution sequentially for a given transaction.
    1. DIAGNOSE
    2. DECIDE
    3. ACT
    """
    # 1. Diagnose
    diagnosis = diagnose_transaction(txn_id)
    
    # Reload transaction details
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    cursor.execute("""
        SELECT customer_segment, attempt_count, amount, normalized_reason, status 
        FROM transactions 
        WHERE id = ?
    """, (txn_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return {"status": "error", "message": "Transaction not found after diagnosis"}
        
    segment = row["customer_segment"]
    attempt_count = row["attempt_count"]
    amount = row["amount"]
    normalized_reason = row["normalized_reason"]
    status = row["status"]
    
    # If transaction is already resolved (e.g., escalated, recovered), stop pipeline
    if status in ["escalated", "recovered"]:
        return {"status": status, "message": f"Pipeline stopped. Transaction is in terminal state: {status}"}
        
    # 2. Decide
    action, reason = decide_intervention(normalized_reason, attempt_count, segment, amount)
    log_audit(
        txn_id=txn_id,
        stage="DECIDE",
        actor="rule",
        reason=f"Inputs: cause={normalized_reason}, attempt={attempt_count}, segment={segment}, amount={amount}",
        action=action,
        outcome=reason
    )
    
    # 3. Act
    outcome = execute_intervention(txn_id, action, reason)
    
    return {
        "txn_id": txn_id,
        "diagnosis": diagnosis,
        "action": action,
        "decision_reason": reason,
        "act_outcome": outcome
    }

@app.post("/webhook/razorpay")
async def razorpay_webhook(request: Request):
    """
    Ingests Razorpay test-mode webhooks and kicks off the recovery pipeline.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
        
    event_type = payload.get("event", "")
    
    # Extract fields from payload entity depending on event type
    pay_id = None
    amount_paise = 0
    currency = "INR"
    contact = ""
    email = ""
    error_code = ""
    notes = {}
    
    # Support payment.failed and custom formatted direct posts
    if "payment" in payload.get("payload", {}):
        payment_entity = payload["payload"]["payment"]["entity"]
        pay_id = payment_entity.get("id")
        amount_paise = payment_entity.get("amount", 0)
        currency = payment_entity.get("currency", "INR")
        contact = payment_entity.get("contact", "")
        email = payment_entity.get("email", "")
        error_code = payment_entity.get("error_code") or payment_entity.get("error_description") or "UNKNOWN_ERROR"
        notes = payment_entity.get("notes", {})
    else:
        # Fallback to direct normalization (useful for manual posting & synthetic testing)
        pay_id = payload.get("id") or f"pay_{uuid.uuid4().hex[:8]}"
        amount_paise = payload.get("amount", 0)
        currency = payload.get("currency", "INR")
        contact = payload.get("customer_phone", "")
        email = payload.get("customer_email", "")
        error_code = payload.get("raw_reason") or payload.get("error_code") or "UNKNOWN_ERROR"
        notes = payload.get("notes", {})
        
    if not pay_id:
        raise HTTPException(status_code=400, detail="Could not identify payment ID in webhook payload")
        
    amount = float(amount_paise) / 100.0 if amount_paise else 0.0
    customer_segment = notes.get("segment") or payload.get("customer_segment") or "retail"
    customer_name = notes.get("name") or payload.get("customer_name") or email.split("@")[0] or "Valued Customer"
    
    # Save/upsert to transactions table
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    
    # Check if transaction already exists
    cursor.execute("SELECT id, attempt_count, status FROM transactions WHERE id = ?", (pay_id,))
    existing = cursor.fetchone()
    
    if existing:
        attempt_count = existing["attempt_count"]
        # Update raw reason, keep count
        cursor.execute("""
            UPDATE transactions 
            SET raw_reason = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (error_code, pay_id))
    else:
        attempt_count = 0
        cursor.execute("""
            INSERT INTO transactions (
                id, razorpay_payment_id, amount, currency, status, 
                customer_name, customer_email, customer_phone, 
                raw_reason, customer_segment, attempt_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pay_id, pay_id, amount, currency, "failed",
            customer_name, email, contact, error_code, customer_segment, 0
        ))
        
    conn.commit()
    conn.close()
    
    # Log the INGEST stage to central audit log
    log_audit(
        txn_id=pay_id,
        stage="INGEST",
        actor="rule",
        reason=f"Ingested {event_type} webhook event. Amount: {currency} {amount}",
        action="normalize_payload",
        outcome="success"
    )
    
    # Trigger the recovery pipeline
    result = process_transaction_pipeline(pay_id)
    return {"status": "success", "pipeline_results": result}

@app.get("/api/metrics")
def get_metrics():
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    
    cursor.execute("SELECT COUNT(*) FROM transactions")
    total_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM transactions WHERE status = 'recovered'")
    recovered_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM transactions WHERE status = 'escalated'")
    escalated_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT SUM(amount) FROM transactions")
    total_revenue = cursor.fetchone()[0] or 0.0
    
    cursor.execute("SELECT SUM(amount) FROM transactions WHERE status = 'recovered'")
    recovered_revenue = cursor.fetchone()[0] or 0.0
    
    cursor.execute("SELECT AVG(attempt_count) FROM transactions WHERE status = 'recovered'")
    avg_touches = cursor.fetchone()[0] or 0.0
    
    conn.close()
    
    recovery_rate = (recovered_count / total_count * 100) if total_count > 0 else 0.0
    
    return {
        "total_transactions": total_count,
        "recovered_transactions": recovered_count,
        "escalated_transactions": escalated_count,
        "total_revenue": total_revenue,
        "recovered_revenue": recovered_revenue,
        "recovery_rate": round(recovery_rate, 2),
        "average_touches": round(avg_touches, 2)
    }

@app.get("/api/transactions")
def get_transactions():
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    cursor.execute("SELECT * FROM transactions ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/audit-logs")
def get_audit_logs():
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    cursor.execute("SELECT * FROM audit_log ORDER BY timestamp DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/outbox")
def get_outbox():
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    cursor.execute("SELECT * FROM whatsapp_outbox ORDER BY sent_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/escalations")
def get_escalations():
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    cursor.execute("SELECT * FROM human_queue ORDER BY escalated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
