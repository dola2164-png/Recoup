from api.db import get_db_connection, get_db_cursor
from api.track import log_audit

def escalate_to_human(txn_id: str, reason: str):
    """
    Escalates a transaction to the human_queue and sets status to 'escalated'.
    """
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    
    # Check if already escalated to avoid duplicate entries
    cursor.execute("SELECT id FROM human_queue WHERE txn_id = ?", (txn_id,))
    already_escalated = cursor.fetchone()
    
    if not already_escalated:
        cursor.execute("""
        INSERT INTO human_queue (txn_id, reason)
        VALUES (?, ?)
        """, (txn_id, reason))
        
    # Update transaction status
    cursor.execute("""
    UPDATE transactions
    SET status = 'escalated'
    WHERE id = ?
    """, (txn_id,))
    
    conn.commit()
    conn.close()
    
    # Log to central audit trail
    log_audit(
        txn_id=txn_id,
        stage="ESCALATE",
        actor="rule",
        reason=reason,
        action="route_to_human_queue",
        outcome="escalated"
    )
    print(f"Transaction {txn_id} escalated to human queue. Reason: {reason}")
