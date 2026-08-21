def decide_intervention(root_cause: str, attempt_count: int, customer_segment: str, amount: float) -> tuple[str, str]:
    """
    Deterministic State Machine for deciding the next recovery action.
    NO LLM imports or LLM calls are allowed in this module.
    
    Returns:
        tuple[str, str]: (action, reason)
        where action is one of: {instant_retry, mandate_reauth_link, whatsapp_nudge, emi_reschedule, escalate}
    """
    # Normalize inputs
    root_cause = (root_cause or "").lower().strip()
    customer_segment = (customer_segment or "retail").lower().strip()
    
    # 1. Enforce Retry Cap (Stop rule)
    MAX_ATTEMPTS = 3
    if attempt_count >= MAX_ATTEMPTS:
        return "escalate", f"retry_cap_exceeded (attempts: {attempt_count})"
        
    # 2. Enforce Spend Caps (Stop rule)
    GLOBAL_SPEND_CAP = 200000.0  # 2 Lakhs
    SMB_SPEND_CAP = 75000.0      # 75k
    RETAIL_SPEND_CAP = 15000.0   # 15k
    
    if amount > GLOBAL_SPEND_CAP:
        return "escalate", f"global_spend_cap_exceeded (amount: {amount})"
    
    if customer_segment == "retail" and amount > RETAIL_SPEND_CAP:
        return "escalate", f"retail_spend_cap_exceeded (amount: {amount})"
        
    if customer_segment == "smb" and amount > SMB_SPEND_CAP:
        return "escalate", f"smb_spend_cap_exceeded (amount: {amount})"

    # 3. Handle specific root causes
    if "needs human review" in root_cause or "needs_human_review" in root_cause:
        return "escalate", "needs_human_review_flagged"
        
    if root_cause == "insufficient_funds":
        # First attempt: nudge the customer to load funds
        if attempt_count == 0:
            return "whatsapp_nudge", "nudge_to_load_funds"
        # Second attempt: try again assuming they might have loaded funds
        elif attempt_count == 1:
            return "instant_retry", "retry_after_nudge"
        else:
            return "escalate", "max_insufficient_funds_retries_reached"
            
    elif root_cause == "network_error" or root_cause == "bank_down":
        # Transient errors: try retry first, then escalate
        if attempt_count < 2:
            return "instant_retry", f"transient_retry_attempt_{attempt_count}"
        else:
            return "escalate", "persistent_network_error"
            
    elif root_cause == "expired_card" or root_cause == "invalid_card":
        # Requires new card details or mandate re-auth
        if attempt_count == 0:
            return "mandate_reauth_link", "request_new_mandate_details"
        else:
            return "escalate", "failed_mandate_reauth"
            
    elif root_cause == "authentication_failed":
        # Incorrect OTP / 3DS drop-off
        if attempt_count == 0:
            return "whatsapp_nudge", "nudge_auth_retry"
        elif attempt_count == 1:
            return "mandate_reauth_link", "retry_auth_via_link"
        else:
            return "escalate", "authentication_failure_limit_reached"
            
    elif root_cause == "overdue_receivables":
        # Customer has overdue invoices/EMI
        if attempt_count == 0:
            return "whatsapp_nudge", "nudge_payment_due"
        elif attempt_count == 1:
            if customer_segment in ["retail", "smb"]:
                return "emi_reschedule", "offer_emi_reschedule"
            else:
                return "whatsapp_nudge", "escalated_nudge_enterprise"
        else:
            return "escalate", "unresponsive_overdue_debtor"
            
    # Default fallback rule if root cause is unhandled
    return "escalate", f"unhandled_root_cause: {root_cause}"
