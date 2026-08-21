# Recoup — Root-Cause Revenue Recovery Agent

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-Orange?style=for-the-badge&logo=groq&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

Submission for the **Razorpay Buildathon — AI Revenue Recovery Track**.

Recoup is an autonomous revenue recovery agent pipeline that detects failed or at-risk transactions, diagnoses the failure root cause, and executes bounded recovery interventions. By enforcing strict stopping rules and recording every action to an immutable audit trail, Recoup safely bridges the gap between payment degradation and successful settlement.

### 🎥 The Proof: 5-Minute Pitch & Demo Video
**[Watch the Pitch Video Here] (Insert YouTube/Drive Link)**

---

## ⚡ Live Deployments & Instant Testing

### 🔗 Production Links
* 🌐 **Live Dashboard (Frontend)**: [https://recoup-seven-omega.vercel.app](https://recoup-seven-omega.vercel.app)
* ⚙️ **Production API (Backend)**: [https://recoup-9wrh.onrender.com](https://recoup-9wrh.onrender.com)
* 🗄️ **Production Database**: Neon Serverless Postgres Cloud

### 🖥️ Dashboard Overview
![Recoup Dashboard All Transactions](image_08fbc9.jpg)
*Centralized view of the synthetic batch recovery metrics, tracking states from 'escalated' to 'recovered'.*

![Recoup Webhook Simulator](image_08fbf0.jpg)
*Built-in webhook simulator allowing judges to trigger live test-mode failures directly into the pipeline.*

### 🧪 How Judges Can Test Live in 30 Seconds
We have built a **Live Webhook Simulator** directly into the home page of the website:
1. Open the **Live Dashboard**.
2. Locate the **Simulate Razorpay Webhook Failure** form on the Home tab.
3. Fill out the details (e.g., Customer Name, Amount, Failure Reason) and click **Send Simulation Webhook**.
4. Click **Audit Log Trail** in the header to view the live, deterministic execution logs.
5. Click **WhatsApp Outbox** to see the personalized English, Hinglish, or Bengali copy drafted for the customer.

---

## 📂 Repository Directory Structure

```text
recoup/
├── api/                   # FastAPI Backend Services
│   ├── act.py             # Executes interventions (WhatsApp drafts)
│   ├── db.py              # Neon cloud PostgreSQL schema
│   ├── decide.py          # Deterministic Rules Engine (limits, retry caps)
│   ├── diagnose.py        # Failure classification (Rules + Groq fallback)
│   ├── escalate.py        # Human review queue management
│   ├── ingest.py          # Razorpay Webhook listener
│   └── track.py           # Central Audit Trail appender
├── dashboard/             # Vite + React Frontend Dashboard
│   ├── src/               # React components and styling
│   └── vite.config.js     # Vite builder configuration
├── eval/                  # Batch Evaluation Scripts
│   └── run_eval.py        # Runs batch tests against 52 synthetic failures
├── tests/                 # Unit & Integration Tests
└── README.md              # Project documentation
