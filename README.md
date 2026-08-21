
<h1 align="center">Recoup</h1>
<p align="center"><b>Root-Cause Revenue Recovery Agent for failed payments</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Groq-Orange?style=for-the-badge&logo=groq&logoColor=white" alt="Groq">
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel">
  <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render">
</p>

<p align="center">
  <a href="https://recoup-seven-omega.vercel.app"><img src="https://img.shields.io/badge/Live_Demo-Online-17A673?style=flat-square" alt="Live Demo"></a>
  <a href="https://recoup-9wrh.onrender.com"><img src="https://img.shields.io/badge/API-Deployed-2F6FED?style=flat-square" alt="API Deployed"></a>
  <img src="https://img.shields.io/badge/Razorpay_Buildathon-AI_Revenue_Recovery_Track-0A1F44?style=flat-square" alt="Razorpay Buildathon">
</p>

Submission for the **Razorpay Buildathon — AI Revenue Recovery Track**.

Recoup is an autonomous revenue recovery agent pipeline that detects failed or at-risk transactions, **diagnoses the root cause of failure** (not just the failure code), executes bounded recovery interventions (retries, localized WhatsApp reminders), tracks every step in a central append-only audit trail, and escalates unresolved cases to a human review queue.

---

## Table of Contents

- [The Problem](#the-problem)
- [Live Deployments & Instant Testing](#live-deployments--instant-testing)
- [Screenshots](#screenshots)
- [Why Recoup](#why-recoup)
- [Pipeline Architecture](#pipeline-architecture)
- [Failure Recovery — A Staged Example](#failure-recovery--a-staged-example)
- [Repository Structure](#repository-structure)
- [Core Product Capabilities](#core-product-capabilities)
- [Evaluation Performance Metrics](#evaluation-performance-metrics)
- [Testing & Reliability](#testing--reliability)
- [Local Setup & Development](#local-setup--development)
- [Roadmap](#roadmap)

---

## The Problem

Most "revenue recovery" tooling reacts to a failed payment the same way every time: retry it, or fire off a generic reminder. But `insufficient_funds`, `bank_server_timeout`, and `card_expired` are not the same problem, and treating them the same way wastes retries, annoys customers, and leaves recoverable revenue on the table.

Recoup's core bet: **diagnose before you act.** A deterministic rules engine decides what happens next only after the true failure cause is known — and every action, spend cap, and escalation is logged so the whole decision trail can be audited after the fact.

**At a glance, from a 52-transaction evaluation batch:**

| | |
|---|---|
| 💰 **Recovered** | ₹5,61,850 of ₹23,58,150 at risk (23.8%) |
| ✅ **Recovery rate** | 61.54% of failed transactions recovered |
| 🎯 **Classifier accuracy** | 98.08% (rules + Groq fallback) |
| ⚡ **Avg. touches to recovery** | 1.06 |

**Where each judged dimension is covered:**

| Track criterion | Where it lives |
|---|---|
| Problem framing & root-cause thinking | This section, and the `Diagnose` stage below |
| Working, testable demo | [Live Deployments & Instant Testing](#live-deployments--instant-testing) |
| Judgment on where AI is/isn't used | [Why Recoup](#why-recoup) → *Strict AI-vs-Rules Design Split* |
| Graceful failure recovery | [Failure Recovery — A Staged Example](#failure-recovery--a-staged-example) |
| Honest, measured evaluation number | [Evaluation Performance Metrics](#evaluation-performance-metrics) |
| Repo structure / code quality | [Repository Structure](#repository-structure), `tests/` |

---

## Live Deployments & Instant Testing

### 🔗 Production Links
* 🌐 **Live Dashboard (Frontend)**: [https://recoup-seven-omega.vercel.app](https://recoup-seven-omega.vercel.app)
* ⚙️ **Production API (Backend)**: [https://recoup-9wrh.onrender.com](https://recoup-9wrh.onrender.com)
* 🗄️ **Production Database**: Neon Serverless Postgres Cloud
* 🐙 **GitHub Repository**: [https://github.com/dola2164-png/Recoup](https://github.com/dola2164-png/Recoup)

### 🧪 How Judges Can Test Live in 30 Seconds (No Code/Setup Required)
We built a **Live Webhook Simulator** directly into the home page:
1. Open the [Live Dashboard](https://recoup-seven-omega.vercel.app) (Razorpay-inspired light fintech theme).
2. On the **Home** tab, find the **Simulate Razorpay Webhook Failure** form.
3. Fill in the details (Customer Name, Amount, Failure Reason) and click **Send Simulation Webhook**.
4. Click **Audit Log Trail** in the header to watch the recovery pipeline execute in real time.
5. Click **WhatsApp Outbox** to see the personalized English/Hinglish copy drafted for that customer.
6. Click **All Transactions** to see overall metrics and recovery status across the batch.

> ⏱️ Note for judges: the API is hosted on Render's free tier, which spins down when idle. The **first** request after a period of inactivity may take 20–30 seconds to wake up — this is a hosting artifact, not pipeline latency.

---

## Screenshots

> Drop your captures from the flow above into `assets/screenshots/` (same file names as below) and they'll render here automatically — this keeps the four images in sync with the exact judging flow.

| Home — Webhook Simulator | Audit Log Trail |
|:---:|:---:|
| ![Home / Simulator](assets/screenshots/home-simulator.png) | ![Audit Log Trail](assets/screenshots/audit-log.png) |

| WhatsApp Outbox | All Transactions |
|:---:|:---:|
| ![WhatsApp Outbox](assets/screenshots/whatsapp-outbox.png) | ![All Transactions](assets/screenshots/all-transactions.png) |

---

## Why Recoup

- **Diagnosis-first, not blind retries.** Every failure is classified to a root cause before any action is chosen, so the intervention actually fits the problem (a retry for a `bank_server_timeout`, a payment link for `insufficient_funds`, escalation for repeated `card_expired`).
- **AI proposes, code decides.** Language models classify ambiguous failures and draft customer copy; a deterministic Python state machine — not the LLM — owns retry caps, spend limits, and escalation boundaries. No hallucinated discounts, no double-charges, no budget bypasses.
- **Built for the Indian market.** WhatsApp nudges are drafted in Hinglish for retail customers and professional English for business/SMB partners, matching how Indian merchants actually communicate with customers.
- **Fails safe.** Both Groq calls run under a 5-second timeout with automatic fallback to `needs_human_review` — a slow or unavailable model degrades the pipeline gracefully instead of blocking it.
- **Fully auditable.** Every rule check, AI call, and human action is appended to a central audit trail, tagged by actor (`RULE` / `AI` / `HUMAN`) — the kind of trail a finance or compliance team would actually want to see.
- **Evaluated, not just demoed.** A 52-transaction synthetic batch with unit tests on the decision engine and classifier back up the numbers in this README (see [Testing & Reliability](#testing--reliability)).

---

## Pipeline Architecture

Every stage writes to the same append-only audit log before the next stage reads from it. Only two nodes ever call an LLM — everything that touches money or limits (`Decide`) is plain, reproducible Python.

```mermaid
graph TD
    A[Razorpay Webhook Event] --> B(Ingest: Normalization & Save)
    B --> C{Diagnose: Known Code?}
    C -- Yes, Rule Match --> D[Root Cause Identified, e.g. insufficient_funds]
    C -- No / Ambiguous --> E["🤖 Groq Fallback Classifier — AI"]
    E --> D
    D --> F["Decide: Deterministic State Machine — Rules only, no LLM"]
    F --> G{Spend / Retry Caps OK?}
    G -- Limit Hit --> H["Escalate to Human Queue & Block — Hard stop"]
    G -- Under Limit --> I[Act: Execute Intervention]
    I -- instant_retry --> J[Razorpay Order API]
    I -- whatsapp_nudge --> K["🤖 Groq Copywriter: Hinglish / English — AI"]
    I -- other --> L[Mock Payment Link / EMI Reschedule]
    K --> M[WhatsApp Outbox]
    J --> N[Track: Append to Central Audit Log]
    L --> N
    K --> N

    classDef ai fill:#17A673,stroke:#0d5c40,color:#fff,stroke-width:1px;
    classDef rules fill:#F0A202,stroke:#8a5f00,color:#111,stroke-width:1px;
    classDef stop fill:#D9634A,stroke:#8a3624,color:#fff,stroke-width:1px;

    class E,K ai;
    class F rules;
    class H stop;
```

**Legend:** 🟩 AI / LLM call (Groq) · 🟧 deterministic rules only — no LLM in this step · 🟥 hard stop → human handoff

---

## Failure Recovery — A Staged Example

A revenue-recovery agent is only trustworthy if it also knows when to *stop*. This walkthrough (also in [`demo/staged_failure.md`](demo/staged_failure.md)) stages a transaction that has already exhausted its retry cap, to show the pipeline catching that itself instead of looping forever.

**Scenario:** a card payment has failed 3 times with `card_expired`, and the retry cap in `decide.py` is 3.

```text
[14:02:11] ingest.event     txn_id=TXN-0148  reason_raw="card declined - expired"
[14:02:11] diagnose.result  root_cause=card_expired  confidence=0.97  source=rule_match
[14:02:12] decide.check     retry_count=3  retry_cap=3  status=CAP_REACHED
[14:02:12] decide.block     action=instant_retry  reason="stopping rule: retry cap reached — will not re-attempt"  actor=RULE
[14:02:12] escalate.route   queue=human_review  note="card expired, 3/3 retries used — needs an updated-card link sent manually"  actor=RULE
[14:02:12] audit.write      outcome=stopped_safely  logged=true
```

What this demonstrates: the stop isn't an accident or an unhandled exception — it's a rule (`decide.py`) that anticipated this exact case, blocked the action *before* it fired, wrote down why, and handed the case to a human with context instead of silently failing. That reasoning trail, not just the outcome, is what `escalate.py` and the audit log in `track.py` exist to make provable.

---

## Repository Structure

```text
recoup/
├── api/                   # FastAPI backend services
│   ├── act.py             # Executes interventions (e.g. drafting Hinglish/English WhatsApp reminders)
│   ├── db.py               # Neon cloud PostgreSQL schema & connectivity
│   ├── decide.py           # Deterministic rules engine (limits, retry caps, escalation)
│   ├── diagnose.py         # Failure classification (rule-based lookup + Groq fallback)
│   ├── escalate.py         # Human review queue management
│   ├── ingest.py           # FastAPI routes & Razorpay webhook listener
│   └── track.py            # Appends steps to the central audit trail
├── dashboard/              # Vite + React frontend dashboard
│   ├── public/
│   │   └── logo.png        # Brand header logo
│   ├── src/
│   │   ├── App.jsx         # Fintech dashboard panel (KPIs, simulator, data tables)
│   │   ├── index.css        # Custom styling & scrollbar constraints
│   │   └── main.jsx         # App entrypoint
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── assets/                 # README images
│   ├── banner.svg
│   └── screenshots/         # Drop live dashboard captures here
├── eval/
│   └── run_eval.py          # Runs the 52-transaction batch evaluation
├── tests/
│   ├── test_decide.py       # Retry limits & deterministic state routing
│   └── test_diagnose.py     # Classification routing & fallback behavior
├── demo/
│   └── staged_failure.md    # Step-by-step API resilience walkthrough
├── .env.example
├── README.md
└── requirements.txt
```

---

## Core Product Capabilities

### 🛡️ Strict AI-vs-Rules Design Split
This project enforces a hard boundary between generative/heuristic AI decisions and deterministic execution rules:

| Used for AI | Kept 100% deterministic |
|---|---|
| **Fallback diagnosis** — classifying ambiguous, free-text failure logs (e.g. *"bank server timed out connecting to cardholder"* or *"declined by issuer due to no credit remaining"*) into standard operational codes. | **Retry & spend caps** — how many times, and how much, can be retried is a fixed limit in `decide.py`, never an LLM judgment call. |
| **Personalized copywriting** — drafting WhatsApp billing reminders in Hinglish for retail customers and professional English for business/SMB partners. | **Which intervention fires** — the (root cause × attempt count) → action mapping is a lookup table, so it's reproducible on replay and auditable line by line. |
| | **Escalation boundaries** — compliance-sensitive, so the rule can't drift between runs the way a model's output can. |

> **The one-line version:** AI decides what to say and how to read an ambiguous signal; rules decide what happens to money.

### ⚡ High-Performance Groq LLM Integration
* **Classifier model**: `openai/gpt-oss-120b` — larger, higher-reasoning model used for classification accuracy.
* **Drafting model**: `openai/gpt-oss-20b` — smaller, low-latency model for message copy generation.
* Both run under a **5.0-second timeout** with automatic fallback to `needs_human_review`, so a slow model call never blocks the pipeline.

---

## Evaluation Performance Metrics

Run against a synthetic batch of **52 transaction failures** spanning card declines, checkout abandonments, subscription failures, and overdue receivables (`eval/run_eval.py`).

| Metric | Value |
| :--- | :--- |
| **Total ingested transactions** | 52 |
| **Recovered transactions** | 32 (61.54%) |
| **Escalated transactions** | 20 (38.46%) |
| **Total at-risk revenue** | ₹23,58,150.00 |
| **Recovered revenue** | ₹5,61,850.00 (23.83%) |
| **Average touches to recovery** | 1.06 |
| **Classifier accuracy (rules + Groq)** | **98.08%** |

**Audit log actor breakdown**
* `RULE` — 216 invocations (state routing, spend caps, retry limits)
* `AI` — 72 invocations (Groq classification, Hinglish message drafting)
* `HUMAN` — 17 invocations (simulated customer payments in response to nudges)

---

## Testing & Reliability

* `tests/test_decide.py` — verifies retry caps, spend limits, and state transitions never bypass the rules engine.
* `tests/test_diagnose.py` — verifies rule-based classification routing and the Groq fallback path, including timeout behavior.
* `eval/run_eval.py` — replays the full 52-transaction batch end-to-end and produces the metrics above.

```bash
.venv\Scripts\python -m pytest tests/test_decide.py tests/test_diagnose.py   # Windows
python -m pytest tests/test_decide.py tests/test_diagnose.py                 # macOS/Linux
```

---

## Local Setup & Development

### Prerequisites
* Python 3.12+
* Node.js v18+ and npm v9+
* A valid Groq API key and Razorpay test key pair

### Environment Configuration
Create a `.env` file in the root directory (based on `.env.example`):
```env
GROQ_API_KEY=gsk_your_groq_key_here
RAZORPAY_KEY_ID=rzp_test_your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
DATABASE_URL=postgresql://user:pass@host:port/dbname  # or local sqlite:///recoup.db
```

### Installation

**1. Initialize the Python backend**
```bash
python -m venv .venv

# Activate the virtual environment
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
python api/db.py            # Initialize local DB tables
```

**2. Initialize the frontend dashboard**
```bash
cd dashboard
npm install
cd ..
```

### Running Locally

**1. Start the backend server** (with the virtual environment active)
```bash
uvicorn api.ingest:app --reload --port 8000
```

**2. Start the frontend dev server**
```bash
cd dashboard
npm run dev
```
Open `http://localhost:5173` in your browser.

**3. Run the pipeline evaluation** (populates your local DB with the 52-record batch)
```bash
python -m eval.run_eval
```

**4. Run unit tests**
```bash
python -m pytest tests/test_decide.py
python -m pytest tests/test_diagnose.py
```

---

## Roadmap

* Verified Razorpay production webhook signatures (HMAC) in place of the demo simulator.
* Additional recovery channels beyond WhatsApp: SMS and email nudges.
* Per-merchant configurable retry policies and spend caps.
* Multi-tenant dashboard auth for real merchant onboarding.

---

<p align="center"><sub>Built for the Razorpay Buildathon — AI Revenue Recovery Track.</sub></p>
