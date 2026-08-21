# Staged Failure Demos — Recoup

This document details the exact, step-by-step scripts to reproduce Recoup's failure handling and recovery mechanisms on localhost.

---

## Demo 1: Retry Cap Exceeded Scenario

This demo shows how a transaction with transient errors (e.g. `network_error`) is retried up to the deterministic retry cap (3 attempts), and then gracefully escalated to the human review queue.

### Steps to Reproduce

1. **Start the API Server**:
   Ensure you are in the project root directory and run:
   ```bash
   .venv\Scripts\uvicorn api.ingest:app --reload --port 8000
   ```

2. **Trigger First Failure (Attempt 0)**:
   Send a `payment.failed` webhook with a network error (`BAD_REQUEST_PAYMENT_TIMED_OUT`):
   ```bash
   curl -X POST http://localhost:8000/webhook/razorpay \
     -H "Content-Type: application/json" \
     -d '{
       "event": "payment.failed",
       "id": "pay_demo_retry_cap_001",
       "amount": 150000,
       "currency": "INR",
       "customer_phone": "+919999999901",
       "customer_email": "demo_user@gmail.com",
       "raw_reason": "BAD_REQUEST_PAYMENT_TIMED_OUT",
       "customer_segment": "retail",
       "customer_name": "Demo Client"
     }'
   ```
   **Expected Console Log**:
   ```
   [INGEST] Actor: rule | Txn: pay_demo_retry_cap_001 | Reason: Ingested payment.failed webhook event. Amount: INR 1500.0 | Action: normalize_payload | Outcome: success
   [DIAGNOSE] Actor: rule | Txn: pay_demo_retry_cap_001 | Reason: Matched known code BAD_REQUEST_PAYMENT_TIMED_OUT | Action: assign_root_cause | Outcome: network_error
   [DECIDE] Actor: rule | Txn: pay_demo_retry_cap_001 | Reason: Inputs: cause=network_error, attempt=0, segment=retail, amount=1500.0 | Action: instant_retry | Outcome: transient_retry_attempt_0
   [ACT] Actor: rule | Txn: pay_demo_retry_cap_001 | Reason: Initiated retry on Razorpay. Order ID: order_XXXXXX | Action: instant_retry | Outcome: retry_initiated_rz_order_XXXXXX
   ```

3. **Simulate Continued Network Downtime (Attempt 1)**:
   The transaction fails again. Re-send the exact same webhook payload to simulate the next attempt failing:
   ```bash
   # Re-run the same curl command
   ```
   **Expected Console Log**:
   ```
   [INGEST] ... Ingested payment.failed webhook event. Amount: INR 1500.0 ...
   [DIAGNOSE] ... Matched known code BAD_REQUEST_PAYMENT_TIMED_OUT ...
   [DECIDE] Actor: rule | Txn: pay_demo_retry_cap_001 | Reason: Inputs: cause=network_error, attempt=1, segment=retail, amount=1500.0 | Action: instant_retry | Outcome: transient_retry_attempt_1
   [ACT] Actor: rule | Txn: pay_demo_retry_cap_001 | Reason: Initiated retry on Razorpay. Order ID: order_YYYYYY | Action: instant_retry | Outcome: retry_initiated_rz_order_YYYYYY
   ```

4. **Simulate Continued Network Downtime (Attempt 2)**:
   Re-send the same webhook payload a third time:
   **Expected Console Log**:
   ```
   [INGEST] ... Ingested payment.failed webhook event. Amount: INR 1500.0 ...
   [DIAGNOSE] ... Matched known code BAD_REQUEST_PAYMENT_TIMED_OUT ...
   [DECIDE] Actor: rule | Txn: pay_demo_retry_cap_001 | Reason: Inputs: cause=network_error, attempt=2, segment=retail, amount=1500.0 | Action: escalate | Outcome: persistent_network_error
   [ESCALATE] Actor: rule | Txn: pay_demo_retry_cap_001 | Reason: persistent_network_error | Action: route_to_human_queue | Outcome: escalated
   ```

5. **Simulate Post-Escalation Webhook Safety Check**:
   Re-send the webhook payload one more time. The pipeline should recognize it is already escalated and refuse to retry:
   **Expected Console Log**:
   ```
   [INGEST] ... Ingested payment.failed webhook event ...
   # (Pipeline stops and returns terminal state status immediately without changing DB or executing interventions)
   ```

6. **Verify SQLite Database States**:
   Check the `human_queue` table:
   ```bash
   sqlite3 recoup.db "SELECT * FROM human_queue WHERE txn_id='pay_demo_retry_cap_001';"
   ```
   *Expected Output*: A row with `txn_id = 'pay_demo_retry_cap_001'` and `reason = 'persistent_network_error'`.

---

## Demo 2: Groq API Fallback Scenario

This demo showcases the pipeline's robustness when the Groq LLM API fails or times out. Instead of failing the transaction ingestion, the pipeline catches the exception, logs it, falls back to `'needs_human_review'`, and routes the transaction to the human review queue.

### Steps to Reproduce

1. **Break the Groq API Key**:
   Open `.env` in the recoup directory and temporarily modify the key to be invalid (e.g. append `_broken` to the key):
   ```env
   GROQ_API_KEY=gsk_your_key_here_broken
   ```

2. **Trigger Ingestion of an Ambiguous/Free-Text Failure**:
   Send a payment failed webhook with an unknown reason that requires AI classification (e.g. `"The system suffered a weird glitch on the card chip swipe."`):
   ```bash
   curl -X POST http://localhost:8000/webhook/razorpay \
     -H "Content-Type: application/json" \
     -d '{
       "event": "payment.failed",
       "id": "pay_demo_ai_fallback_002",
       "amount": 250000,
       "currency": "INR",
       "customer_phone": "+919999999902",
       "customer_email": "demo_fallback@gmail.com",
       "raw_reason": "The system suffered a weird glitch on the card chip swipe.",
       "customer_segment": "retail",
       "customer_name": "Fallback Demo Client"
     }'
   ```

3. **Verify the Safe Fallback Logs**:
   In the FastAPI terminal, you should see the Groq error caught and logged:
   ```
   [INGEST] Actor: rule | Txn: pay_demo_ai_fallback_002 | Reason: Ingested payment.failed webhook event. Amount: INR 2500.0 | Action: normalize_payload | Outcome: success
   Groq classification failed or timed out: Error code: 401 - {'error': {'message': 'Invalid API Key', 'type': 'invalid_request_error', 'code': 'invalid_api_key'}}. Falling back to needs_human_review.
   [DIAGNOSE] Actor: ai | Txn: pay_demo_ai_fallback_002 | Reason: Groq classified raw reason: The system suffered a weird glitch on the card chip swipe. | Action: assign_root_cause | Outcome: needs_human_review
   [DECIDE] Actor: rule | Txn: pay_demo_ai_fallback_002 | Reason: Inputs: cause=needs_human_review, attempt=0, segment=retail, amount=2500.0 | Action: escalate | Outcome: needs_human_review_flagged
   [ESCALATE] Actor: rule | Txn: pay_demo_ai_fallback_002 | Reason: needs_human_review_flagged | Action: route_to_human_queue | Outcome: escalated
   ```
   **Verification**: The transaction did not crash the system. It was successfully caught, resolved to `'needs_human_review'`, and safely escalated.

4. **Restore the API Key**:
   Revert `.env` to the original working key once the demo is completed:
   ```env
   GROQ_API_KEY=gsk_your_key_here
   ```
