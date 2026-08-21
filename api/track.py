import sqlite3
from datetime import datetime
from api.db import get_db_connection, get_db_cursor

def log_audit(txn_id: str, stage: str, actor: str, reason: str, action: str, outcome: str):
    """
    Appends a record to the central audit log.
    actor should be one of: 'rule', 'ai', 'human'.
    """
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    cursor.execute("""
    INSERT INTO audit_log (txn_id, stage, actor, reason, action, outcome, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (txn_id, stage, actor, reason, action, outcome, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    
    # Also log to stdout for easy CLI monitoring
    log_line = f"[{datetime.utcnow().isoformat()}] [{stage}] Actor: {actor} | Txn: {txn_id} | Reason: {reason} | Action: {action} | Outcome: {outcome}"
    try:
        print(log_line)
    except UnicodeEncodeError:
        print(log_line.encode("ascii", "replace").decode("ascii"))
