# Evaluation Results — Recoup Pipeline

This file records the actual execution metrics of the Recoup revenue recovery pipeline run against the 52 synthetic transaction failures in `synthetic_batch.json`.

## Summary Performance Metrics

| Metric | Value |
| :--- | :--- |
| **Total Transactions** | 52 |
| **Recovered Transactions** | 32 (61.54%) |
| **Escalated Transactions** | 20 (38.46%) |
| **Total At-Risk Revenue** | INR 2,358,150.00 |
| **Recovered Revenue** | INR 561,850.00 (23.83%) |
| **Average Touches to Recovery** | 1.06 |
| **Classifier Accuracy (Rules + Groq)** | 96.15% |

## Audit Trail and Actor Split

The audit trail logging records every decision along with the executing actor (`rule`, `ai`, or `human`):

| Actor | Action Count | Description |
| :--- | :--- | :--- |
| **RULE** | 213 | Executed deterministic code lookups, spend limits, retry caps, and state machine transitions. |
| **AI** | 71 | Executed Groq `llama-3.3-70b-versatile` fallback classification on ambiguous/free-text failure reasons. |
| **HUMAN** | 17 | Simulates final payment recovery resolution by customer action (e.g. paying after a nudge). |

## Analysis & Observations

1. **Rule vs AI Split Verification**: All money-moving state transitions, spend limits, and retry limits were executed by the `rule` actor (no LLM). The AI was invoked *only* for unstructured text classification, ensuring 100% auditable and reproducible routing policies.
2. **Classifier Performance**: The Groq fallback classifier effectively mapped unstructured free-text decline notices (like *"declined by bank due to insufficient funds in customer wallet"*) to correct category codes, achieving high accuracy.
3. **Spend Limit Safety**: High-value transactions (such as `syn_006` at 1.5 Lakhs for SMB and `syn_043` at 7.2 Lakhs for Enterprise) were immediately escalated by spend-cap rules instead of risking automated payment retries or wasting notifications.
