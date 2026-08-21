# Recoup — Root-Cause Revenue Recovery Agent

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Orange?style=for-the-badge&logo=groq&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

Submission for the **Razorpay Buildathon — AI Revenue Recovery Track**.

Recoup is an autonomous revenue recovery agent pipeline that detects failed or at-risk transactions, diagnoses the failure root cause, executes bounded recovery interventions (retries, localized WhatsApp reminders), tracks outcomes in a central append-only audit trail, and escalates unresolved cases to a human review queue.

---

## ⚡ Live Deployments & Instant Testing

### 🔗 Production Links
* 🌐 **Live Dashboard (Frontend)**: [https://recoup-seven-omega.vercel.app](https://recoup-seven-omega.vercel.app)
* ⚙️ **Production API (Backend)**: [https://recoup-9wrh.onrender.com](https://recoup-9wrh.onrender.com)
* 🗄️ **Production Database**: Neon Serverless Postgres Cloud
* 🐙 **GitHub Repository**: [https://github.com/dola2164-png/Recoup](https://github.com/dola2164-png/Recoup)

### 🧪 How Judges Can Test Live in 30 Seconds (No Code/Setup Required)
We have built a **Live Webhook Simulator** directly into the home page of the website:
1. Open the [Live Dashboard](https://recoup-seven-omega.vercel.app) (runs in Razorpay-inspired light fintech theme).
2. On the **Home** tab, locate the **Simulate Razorpay Webhook Failure** form.
3. Fill out the details (e.g., Customer Name, Amount, Failure Reason) and click **Send Simulation Webhook**.
4. Click **Audit Log Trail** in the header to view the live execution logs of the recovery pipeline in real time.
5. Click **WhatsApp Outbox** in the header to see the personalized English/Hinglish copy drafted for the customer.
6. Click **All Transactions** to inspect the overall metrics and transaction recovery status.
---

## 📂 Repository Directory Structure

```text
recoup/
├── api/                   # FastAPI Backend Services
│   ├── act.py             # Executes interventions (e.g. drafting Hinglish/English WhatsApp reminders)
│   ├── db.py              # Neon cloud PostgreSQL database schema & connectivity
│   ├── decide.py          # Deterministic Rules Engine (rules, limits, retry caps, escalation)
│   ├── diagnose.py        # Failure classification (Rule-based lookup table + Groq fallback classification)
│   ├── escalate.py        # Human review queue management functions
│   ├── ingest.py          # FastAPI application routes & Razorpay Webhook listener
│   └── track.py           # Appends and saves steps to the Central Audit Trail
├── dashboard/             # Vite + React Frontend Dashboard
│   ├── public/            # Static assets
│   │   └── logo.png       # Custom brand header logo
│   ├── src/               # React components and styling
│   │   ├── App.jsx        # Complete Fintech Dashboard panel (KPIs, Simulator, Data Tables)
│   │   ├── index.css      # Custom styling & scrollbar constraints
│   │   └── main.jsx       # App entrypoint
│   ├── index.html         # Main HTML document
│   ├── package.json       # Node dependencies
│   ├── tailwind.config.js # Tailwind CSS customization
│   └── vite.config.js     # Vite builder configuration
├── eval/                  # Simulation & Evaluation Scripts
│   └── run_eval.py        # Runs batch tests against 52 transaction failures
├── tests/                 # Unit & Integration Tests
│   ├── test_decide.py     # Tests retry limits and deterministic state routing
│   └── test_diagnose.py   # Tests classification routing and fallback responses
├── demo/                  # Interactive demo scenarios
│   └── staged_failure.md  # Step-by-step API resilience documentation
├── .env.example           # Example configuration keys template
├── README.md              # Project documentation
└── requirements.txt       # Python library dependencies
```

---

## Pipeline Architecture Flow

```mermaid
graph TD
    A[Razorpay Webhook Event] --> B(Ingest: Normalization & Save)
    B --> C{Diagnose: Known Code?}
    C -- Yes (Rule) --> D[Root Cause: e.g. insufficient_funds]
    C -- No (AI) --> E[Groq Fallback Classifier]
    E --> D
    D --> F[Decide: State Machine - No LLM]
    F --> G{Enforce Spend/Retry Caps}
    G -- Limit Hit --> H[Escalate to Human Queue & Block]
    G -- Under Limit --> I[Act: Execute Intervention]
    I -- instant_retry --> J[Razorpay Order API]
    I -- whatsapp_nudge --> K[Groq Copywriter: Hinglish/English]
    I -- other --> L[Mock Link/EMI Reschedule]
    K --> M[WhatsApp Outbox]
    J --> N[Track: Write to Central Audit Log]
    K --> N
    L --> N
```

---

## Core Product Capabilities

### 🛡️ 1. Strict AI-vs-Rules Design Split
This project enforces a secure division between generative/heuristic AI decisions and deterministic execution rules:
* **Where AI is Leveraged**:
  * **Fallback Diagnosis**: Classifying highly ambiguous or free-text failure logs (e.g. *"bank server timed out connecting to cardholder"* or *"declined by issuer due to no credit remaining"*) into standard operational codes.
  * **Personalized Copywriting**: Drafting tailored WhatsApp billing reminders in **Hinglish** (for retail customers) and professional **English** (for business/SMB partners).
* **Where Code is 100% Deterministic (Rules Engine)**:
  * Budget routing, retry limits, payment options, intervention rules, and human escalation boundaries are written strictly in python (`decide.py`).
  * Prevents AI hallucination, accidental double-charges, budget bypasses, and security exploits.

### 2. High-Performance Groq LLM Invasions
Groq APIs are queried dynamically to deliver low-latency responses:
* **Classifier Model**: `openai/gpt-oss-120b` (Large, high-reasoning general-purpose model for classification accuracy).
* **Drafting Model**: `openai/gpt-oss-20b` (Smaller, low-latency model for message copy generation).
* Both models run under a **5.0-second timeout limit** with built-in fallbacks to `needs_human_review` to prevent pipeline blockages.

---

## 📈 Evaluation Performance Metrics

The pipeline was run against a synthetic batch of **52 transaction failures** spanning card declines, checkout abandonments, subscription failures, and overdue receivables.

| Metric | Value |
| :--- | :--- |
| **Total Ingested Transactions** | 52 |
| **Recovered Transactions** | 32 (61.54%) |
| **Escalated Transactions** | 20 (38.46%) |
| **Total At-Risk Revenue** | INR 2,358,150.00 |
| **Recovered Revenue** | INR 561,850.00 (23.83%) |
| **Average Touches to Recovery** | 1.06 |
| **Classifier Accuracy (Rules + Groq)** | **98.08%** |

### Audit Log Actor Counts
* **RULE**: 216 invocations (States, spend caps, retry limits)
* **AI**: 72 invocations (Groq text classification, Hinglish message drafting)
* **HUMAN**: 17 invocations (Simulated customer payments in response to nudges)

---

## 💻 Local Setup & Development

If you prefer to run the project locally on your machine, follow these steps:

### Prerequisites
* Python 3.12+
* Node.js v18+ and npm v9+
* A valid Groq API Key and Razorpay Test Key pair

### Environment Configuration
Create a `.env` file in the root directory (based on `.env.example`):
```env
GROQ_API_KEY=gsk_your_groq_key_here
RAZORPAY_KEY_ID=rzp_test_your_key_here
RAZORPAY_KEY_SECRET=your_secret_here
DATABASE_URL=postgresql://user:pass@host:port/dbname  # or local sqlite:///recoup.db
```

### Installation
1. **Initialize Python Backend**:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # On Windows (use source .venv/bin/activate on macOS/Linux)
   pip install -r requirements.txt
   python api/db.py          # Initialize local DB tables
   ```

2. **Initialize Frontend Dashboard**:
   ```bash
   cd dashboard
   npm install
   cd ..
   ```

### Running Locally
1. **Start Backend Server**:
   ```bash
   .venv\Scripts\uvicorn api.ingest:app --reload --port 8000
   ```
2. **Start Frontend Dev Server**:
   ```bash
   cd dashboard
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

3. **Run Pipeline Evaluations**:
   To populate your local DB and test the 52-record batch simulation run:
   ```bash
   .venv\Scripts\python -m eval.run_eval
   ```

4. **Run Unit Tests**:
   Ensure rules and classifiers behave predictably:
   ```bash
   .venv\Scripts\python -m pytest tests/test_decide.py
   .venv\Scripts\python -m pytest tests/test_diagnose.py
   ```
