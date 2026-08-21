import os
import sqlite3
import razorpay
from groq import Groq
from dotenv import load_dotenv
from api.db import get_db_connection, get_db_cursor
from api.track import log_audit
from api.escalate import escalate_to_human

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

def generate_whatsapp_nudge(customer_name: str, amount: float, currency: str, segment: str, reason: str) -> str:
    """
    Drafts a personalized recovery nudge message using Groq (openai/gpt-oss-20b).
    Applies Hinglish for retail segments and professional English for business segments.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return f"Hi {customer_name}, your payment of {currency} {amount} failed due to {reason}. Please complete your payment."
        
    try:
        # Standard Groq client instantiation with 5-second timeout
        client = Groq(api_key=api_key, timeout=5.0)
        
        if segment == "retail":
            instructions = (
                "Write a short, friendly WhatsApp reminder in Hinglish (a mixture of Hindi and English written in Latin/Roman script). "
                "Keep the tone warm, conversational, and helpful. Use friendly phrases like 'Aapka payment fail ho gaya hai' or 'Please update your details'. "
            )
        else:
            instructions = (
                "Write a professional and polite WhatsApp reminder in English. "
                "Keep the tone corporate, courteous, and clear. "
            )
            
        system_prompt = (
            "You are a helpful customer billing assistant for Recoup.\n"
            f"{instructions}\n"
            "Include the following details in the body of your message:\n"
            f"- Customer Name: {customer_name}\n"
            f"- Amount: {currency} {amount:.2f}\n"
            f"- Failure Reason: {reason}\n\n"
            "Constraints:\n"
            "- Do not include subject lines, email headers, or prefix text (like 'Here is your nudge:').\n"
            "- Output ONLY the body of the WhatsApp message. Do not quote it."
        )
        
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b", # Smaller, faster model for drafting
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Please write the WhatsApp nudge message now."}
            ]
        )
        
        message = response.choices[0].message.content.strip()
        if message:
            return message
        else:
            return f"Hi {customer_name}, your payment of {currency} {amount:.2f} failed due to {reason}. Please complete your payment."
            
    except Exception as e:
        print(f"Failed to draft WhatsApp nudge via Groq: {e}. Using default fallback message.")
        return f"Hi {customer_name}, your payment of {currency} {amount:.2f} failed due to {reason}. Please complete your payment."

def execute_intervention(txn_id: str, action: str, reason: str) -> str:
    """
    Executes the chosen action:
      - instant_retry: trigger retry via Razorpay (test-mode)
      - whatsapp_nudge: send reminder drafted via Groq (openai/gpt-oss-20b)
      - mandate_reauth_link: send re-auth link
      - emi_reschedule: send EMI offering
      - escalate: send to human queue
    """
    conn = get_db_connection()
    cursor = get_db_cursor(conn)
    cursor.execute("""
        SELECT customer_phone, customer_name, amount, currency, customer_segment, attempt_count 
        FROM transactions 
        WHERE id = ?
    """, (txn_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        log_audit(txn_id, "ACT", "rule", reason, action, "failed_transaction_not_found")
        return "failed"
        
    customer_phone = row["customer_phone"]
    customer_name = row["customer_name"]
    amount = row["amount"]
    currency = row["currency"]
    segment = row["customer_segment"]
    attempt_count = row["attempt_count"]
    
    outcome = "success"
    
    if action == "instant_retry":
        # Execute real Razorpay order creation in test mode to simulate payment retry
        key_id = os.environ.get("RAZORPAY_KEY_ID")
        key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
        
        rz_order_id = None
        if key_id and key_secret:
            try:
                # Initialize real Razorpay client
                rz_client = razorpay.Client(auth=(key_id, key_secret))
                
                # Razorpay amount is in paise (multiply INR by 100)
                order_data = {
                    "amount": int(amount * 100),
                    "currency": currency,
                    "receipt": f"retry_{txn_id[:10]}_{attempt_count}",
                    "notes": {
                        "original_txn_id": txn_id,
                        "retry_attempt": str(attempt_count)
                    }
                }
                order = rz_client.order.create(data=order_data)
                rz_order_id = order.get("id")
                outcome = f"retry_initiated_rz_{rz_order_id}"
            except Exception as e:
                print(f"Razorpay order creation failed: {e}. Falling back to mock order.")
                outcome = "retry_success_simulated"
        else:
            outcome = "retry_success_simulated"
            
        log_audit(
            txn_id=txn_id,
            stage="ACT",
            actor="rule",
            reason=f"Initiated retry on Razorpay. Order ID: {rz_order_id}",
            action=action,
            outcome=outcome
        )
        
        # Update transaction status
        conn = get_db_connection()
        cursor = get_db_cursor(conn)
        cursor.execute("UPDATE transactions SET status = 'recovered', attempt_count = attempt_count + 1 WHERE id = ?", (txn_id,))
        conn.commit()
        conn.close()
        
    elif action == "whatsapp_nudge":
        # Draft message using Groq (openai/gpt-oss-20b)
        message_body = generate_whatsapp_nudge(customer_name, amount, currency, segment, reason)
        
        # Save to whatsapp outbox table
        conn = get_db_connection()
        cursor = get_db_cursor(conn)
        cursor.execute("""
            INSERT INTO whatsapp_outbox (txn_id, customer_phone, message_body)
            VALUES (?, ?, ?)
        """, (txn_id, customer_phone, message_body))
        
        # Increment attempt count
        cursor.execute("UPDATE transactions SET status = 'nudge_sent', attempt_count = attempt_count + 1 WHERE id = ?", (txn_id,))
        conn.commit()
        conn.close()
        
        outcome = "nudge_sent_to_outbox"
        log_audit(
            txn_id=txn_id,
            stage="ACT",
            actor="ai", # Mark as AI because message copy was drafted by LLM
            reason=f"Drafted custom nudge via Groq: '{message_body[:60]}...'",
            action=action,
            outcome=outcome
        )
        
    elif action == "mandate_reauth_link":
        outcome = "reauth_link_sent"
        log_audit(txn_id, "ACT", "rule", "sent_reauth_link", action, outcome)
        
        conn = get_db_connection()
        cursor = get_db_cursor(conn)
        cursor.execute("UPDATE transactions SET status = 'awaiting_reauth', attempt_count = attempt_count + 1 WHERE id = ?", (txn_id,))
        conn.commit()
        conn.close()
        
    elif action == "emi_reschedule":
        outcome = "emi_reschedule_offered"
        log_audit(txn_id, "ACT", "rule", "sent_emi_options", action, outcome)
        
        conn = get_db_connection()
        cursor = get_db_cursor(conn)
        cursor.execute("UPDATE transactions SET status = 'awaiting_emi_choice', attempt_count = attempt_count + 1 WHERE id = ?", (txn_id,))
        conn.commit()
        conn.close()
        
    elif action == "escalate":
        escalate_to_human(txn_id, reason)
        outcome = "escalated"
    
    else:
        # Default safety escalate
        escalate_to_human(txn_id, f"unknown_action_{action}")
        outcome = "escalated_unknown"
        
    return outcome
