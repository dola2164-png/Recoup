import os
from groq import Groq
from dotenv import load_dotenv
from api.db import get_db_connection, get_db_cursor
from api.track import log_audit

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

# Rule-based lookup table for known Razorpay error/bank codes
KNOWN_CODES = {
    "BAD_REQUEST_PAYMENT_CARD_INSUFFICIENT_BALANCE": "insufficient_funds",
    "BAD_REQUEST_PAYMENT_TIMED_OUT": "network_error",
    "GATEWAY_ERROR": "bank_down",
    "BAD_REQUEST_PAYMENT_CARD_EXPIRED": "expired_card",
    "BAD_REQUEST_PAYMENT_CARD_HOLDER_NAME_INVALID": "invalid_card",
    "BAD_REQUEST_PAYMENT_OTP_INCORRECT": "authentication_failed",
    "BAD_REQUEST_PAYMENT_3DS_OTP_VERIFICATION_FAILED": "authentication_failed",
    "BAD_REQUEST_PAYMENT_SUBSCRIPTION_INSUFFICIENT_BALANCE": "insufficient_funds",
    "BAD_REQUEST_PAYMENT_CARD_DECLINED_BY_BANK": "insufficient_funds", # typical decline reason
}

def classify_with_groq(raw_reason: str) -> str:
    """
    Calls Groq to classify free-text or unknown failure reasons.
    Enforces a strict timeout and fallback mechanism.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("Warning: GROQ_API_KEY not found in environment. Falling back to needs_human_review.")
        return "needs_human_review"
        
    try:
        # Standard Groq client instantiation with timeout parameter (supported in groq Python SDK)
        client = Groq(api_key=api_key, timeout=5.0)
        
        system_prompt = (
            "You are a transaction failure classifier for a payment gateway (Razorpay).\n"
            "Your task is to classify the raw, ambiguous, or free-text transaction failure message "
            "into exactly one of the following categories:\n"
            "- insufficient_funds\n"
            "- network_error\n"
            "- bank_down\n"
            "- expired_card\n"
            "- invalid_card\n"
            "- authentication_failed\n"
            "- overdue_receivables\n"
            "- needs_human_review\n\n"
            "Guidelines:\n"
            "- Use 'needs_human_review' if the failure reason is highly ambiguous, contains gibberish, "
            "refers to fraud/risk flags, or does not clearly fit other categories.\n"
            "- Output ONLY the category string. Do not include markdown code blocks, quotes, or explanatory text."
        )
        
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Raw failure message: {raw_reason}"}
            ]
        )
        
        category = response.choices[0].message.content.strip().lower()
        
        valid_categories = {
            "insufficient_funds",
            "network_error",
            "bank_down",
            "expired_card",
            "invalid_card",
            "authentication_failed",
            "overdue_receivables",
            "needs_human_review"
        }
        
        if category in valid_categories:
            return category
        else:
            # Check if it contains one of the categories as a substring
            for cat in valid_categories:
                if cat in category:
                    return cat
            print(f"Groq returned invalid category format: '{category}'. Falling back to needs_human_review.")
            return "needs_human_review"
            
    except Exception as e:
        print(f"Groq classification failed or timed out: {e}. Falling back to needs_human_review.")
        return "needs_human_review"

def diagnose_transaction(txn_id: str) -> str:
    """
    Diagnoses a transaction failure:
    1. First checks KNOWN_CODES table (deterministic rules).
    2. Calls GroqFallbackClassifier for ambiguous text.
    """
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    cursor.execute("SELECT raw_reason FROM transactions WHERE id = ?", (txn_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return "needs_human_review"
        
    raw_reason = row["raw_reason"]
    if not raw_reason:
        return "needs_human_review"
        
    # Standardize lookup key
    lookup_key = raw_reason.strip().upper()
    
    # 1. Rule-based lookup
    if lookup_key in KNOWN_CODES:
        diagnosis = KNOWN_CODES[lookup_key]
        log_audit(
            txn_id=txn_id,
            stage="DIAGNOSE",
            actor="rule",
            reason=f"Matched known code {raw_reason}",
            action="assign_root_cause",
            outcome=diagnosis
        )
        
        # Save to transaction record
        conn = get_db_connection()
        cursor = get_db_cursor(conn)
        cursor.execute("UPDATE transactions SET normalized_reason = ? WHERE id = ?", (diagnosis, txn_id))
        conn.commit()
        conn.close()
        
        return diagnosis

    # 2. Unknown code / free-text: Groq Classifier
    diagnosis = classify_with_groq(raw_reason)
    
    log_audit(
        txn_id=txn_id,
        stage="DIAGNOSE",
        actor="ai",
        reason=f"Groq classified raw reason: {raw_reason}",
        action="assign_root_cause",
        outcome=diagnosis
    )
    
    # Save to transaction record
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    cursor.execute("UPDATE transactions SET normalized_reason = ? WHERE id = ?", (diagnosis, txn_id))
    conn.commit()
    conn.close()
    
    return diagnosis
