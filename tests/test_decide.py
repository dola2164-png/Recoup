from api.decide import decide_intervention

def test_retry_cap_exceeded():
    # If attempt_count is >= 3, it must escalate regardless of amount/segment/reason
    action, reason = decide_intervention(
        root_cause="insufficient_funds",
        attempt_count=3,
        customer_segment="retail",
        amount=100.0
    )
    assert action == "escalate"
    assert "retry_cap_exceeded" in reason

def test_spend_caps():
    # Global spend cap (> 200,000 INR)
    action, reason = decide_intervention("insufficient_funds", 0, "enterprise", 250000.0)
    assert action == "escalate"
    assert "global_spend_cap_exceeded" in reason
    
    # SMB spend cap (> 75,000 INR)
    action, reason = decide_intervention("insufficient_funds", 0, "smb", 80000.0)
    assert action == "escalate"
    assert "smb_spend_cap_exceeded" in reason
    
    # Retail spend cap (> 15,000 INR)
    action, reason = decide_intervention("insufficient_funds", 0, "retail", 20000.0)
    assert action == "escalate"
    assert "retail_spend_cap_exceeded" in reason

def test_insufficient_funds_flow():
    # Attempt 0: WhatsApp nudge
    action, reason = decide_intervention("insufficient_funds", 0, "retail", 500.0)
    assert action == "whatsapp_nudge"
    
    # Attempt 1: Instant retry
    action, reason = decide_intervention("insufficient_funds", 1, "retail", 500.0)
    assert action == "instant_retry"
    
    # Attempt 2: Escalate
    action, reason = decide_intervention("insufficient_funds", 2, "retail", 500.0)
    assert action == "escalate"
    assert "max_insufficient_funds_retries" in reason

def test_network_error_flow():
    # Attempt 0: instant_retry
    action, reason = decide_intervention("network_error", 0, "retail", 500.0)
    assert action == "instant_retry"
    
    # Attempt 1: instant_retry
    action, reason = decide_intervention("network_error", 1, "retail", 500.0)
    assert action == "instant_retry"
    
    # Attempt 2: escalate
    action, reason = decide_intervention("network_error", 2, "retail", 500.0)
    assert action == "escalate"

def test_expired_card_flow():
    # Attempt 0: mandate_reauth_link
    action, reason = decide_intervention("expired_card", 0, "retail", 500.0)
    assert action == "mandate_reauth_link"
    
    # Attempt 1: escalate
    action, reason = decide_intervention("expired_card", 1, "retail", 500.0)
    assert action == "escalate"

def test_overdue_receivables_flow():
    # Attempt 0: whatsapp_nudge
    action, reason = decide_intervention("overdue_receivables", 0, "retail", 5000.0)
    assert action == "whatsapp_nudge"
    
    # Attempt 1 (retail/smb): emi_reschedule
    action, reason = decide_intervention("overdue_receivables", 1, "retail", 5000.0)
    assert action == "emi_reschedule"
    
    # Attempt 1 (enterprise): whatsapp_nudge
    action, reason = decide_intervention("overdue_receivables", 1, "enterprise", 5000.0)
    assert action == "whatsapp_nudge"
