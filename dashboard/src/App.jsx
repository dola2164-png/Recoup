import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { 
  Activity, AlertCircle, CheckCircle, RefreshCw, MessageSquare, ShieldAlert, DollarSign, ArrowRightLeft, Users
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('logs');
  const [metrics, setMetrics] = useState({
    total_transactions: 0,
    recovered_transactions: 0,
    escalated_transactions: 0,
    total_revenue: 0.0,
    recovered_revenue: 0.0,
    recovery_rate: 0.0,
    average_touches: 0.0
  });
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulator Form States
  const [simName, setSimName] = useState('Buildathon Judge');
  const [simEmail, setSimEmail] = useState('judge@razorpay.com');
  const [simPhone, setSimPhone] = useState('+919876543210');
  const [simAmount, setSimAmount] = useState('1500');
  const [simSegment, setSimSegment] = useState('retail');
  const [simReason, setSimReason] = useState('the customer swiped the card but the bank didn\'t respond');
  const [simulating, setSimulating] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);

  const handleSimulate = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setSimSuccess(false);
    try {
      const response = await fetch(`${API_BASE_URL}/webhook/razorpay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'payment.failed',
          id: `sim_${Math.random().toString(36).substring(2, 11)}`,
          amount: parseFloat(simAmount) * 100, // convert INR to paise
          currency: 'INR',
          customer_phone: simPhone,
          customer_email: simEmail,
          raw_reason: simReason,
          customer_segment: simSegment,
          customer_name: simName
        })
      });
      if (response.ok) {
        setSimSuccess(true);
        fetchData(); // reload dashboard metrics & tables instantly!
      } else {
        throw new Error('Simulation failed. Server returned an error.');
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSimulating(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, tRes, aRes, oRes, eRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/metrics`),
        fetch(`${API_BASE_URL}/api/transactions`),
        fetch(`${API_BASE_URL}/api/audit-logs`),
        fetch(`${API_BASE_URL}/api/outbox`),
        fetch(`${API_BASE_URL}/api/escalations`)
      ]);

      if (!mRes.ok || !tRes.ok || !aRes.ok || !oRes.ok || !eRes.ok) {
        throw new Error(`Failed to fetch data from ${API_BASE_URL}. Ensure the FastAPI server is running.`);
      }

      const mData = await mRes.json();
      const tData = await tRes.json();
      const aData = await aRes.json();
      const oData = await oRes.json();
      const eData = await eRes.json();

      setMetrics(mData);
      setTransactions(tData);
      setAuditLogs(aData);
      setOutbox(oData);
      setEscalations(eData);
    } catch (err) {
      console.error(err);
      setError(`Failed to fetch data from ${API_BASE_URL}. Ensure the FastAPI server is running.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const chartData = [
    { name: 'Recovered', value: metrics.recovered_transactions, color: '#10b981' },
    { name: 'Escalated', value: metrics.escalated_transactions, color: '#ef4444' },
    { name: 'Pending', value: Math.max(0, metrics.total_transactions - metrics.recovered_transactions - metrics.escalated_transactions), color: '#3f3f46' }
  ];

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  return (
    <div class="h-screen max-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black overflow-hidden">
      {/* Header */}
      <header class="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-30 px-6 py-3 flex items-center justify-between shrink-0">
        <div class="flex items-center space-x-3">
          <div class="bg-emerald-500 text-black p-2 rounded-lg font-bold text-lg tracking-wider">
            RE
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight flex items-center space-x-2">
              <span>Recoup</span>
              <span class="text-zinc-600 font-normal">/</span>
              <span class="text-emerald-400 font-bold text-sm bg-emerald-950/40 border border-emerald-800 px-2 py-0.5 rounded-md">Home</span>
            </h1>
            <p class="text-xs text-zinc-400">Razorpay Revenue Recovery Pipeline</p>
          </div>
        </div>
        
        <div class="flex items-center space-x-4">
          <button 
            onClick={fetchData} 
            disabled={loading}
            class="flex items-center space-x-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 border border-zinc-700 px-4.5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw class={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <div class="flex items-center space-x-2 text-xs text-zinc-400">
            <span class="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>API Online</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main class="flex-grow p-6 space-y-4 max-w-7xl mx-auto w-full flex flex-col overflow-hidden">
        {error && (
          <div class="bg-red-950/40 border border-red-800 text-red-200 p-4 rounded-xl flex items-start space-x-3 text-sm shrink-0">
            <AlertCircle class="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <span class="font-bold">Connection Error:</span> {error}
              <p class="mt-1 text-xs text-red-300">
                {API_BASE_URL.includes('localhost') 
                  ? "Run '.venv\\Scripts\\uvicorn api.ingest:app --reload' to start the local API server on port 8000."
                  : "If you just deployed to Render, the Free tier spins down after inactivity. Please wait 1–2 minutes for the service to spin back up, or check your Render logs."}
              </p>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          {/* Card 1 */}
          <div class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-zinc-400">
              <span class="text-xs font-semibold uppercase tracking-wider">Total At-Risk</span>
              <DollarSign class="h-4 w-4 text-zinc-500" />
            </div>
            <div class="mt-2">
              <div class="text-xl font-bold tracking-tight">{formatCurrency(metrics.total_revenue)}</div>
              <p class="text-[10px] text-zinc-400 mt-0.5">{metrics.total_transactions} transactions failed</p>
            </div>
          </div>

          {/* Card 2 */}
          <div class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-zinc-400">
              <span class="text-xs font-semibold uppercase tracking-wider text-emerald-400">Recovered Revenue</span>
              <CheckCircle class="h-4 w-4 text-emerald-500" />
            </div>
            <div class="mt-2">
              <div class="text-xl font-bold tracking-tight text-emerald-400">{formatCurrency(metrics.recovered_revenue)}</div>
              <p class="text-[10px] text-zinc-400 mt-0.5">{metrics.recovered_transactions} cases resolved successfully</p>
            </div>
          </div>

          {/* Card 3 */}
          <div class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-zinc-400">
              <span class="text-xs font-semibold uppercase tracking-wider">Recovery Rate</span>
              <Activity class="h-4 w-4 text-emerald-400" />
            </div>
            <div class="mt-2">
              <div class="text-xl font-bold tracking-tight">{metrics.recovery_rate}%</div>
              <div class="w-full bg-zinc-800 rounded-full h-1 mt-1.5">
                <div class="bg-emerald-500 h-1 rounded-full" style={{ width: `${metrics.recovery_rate}%` }}></div>
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div class="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-zinc-400">
              <span class="text-xs font-semibold uppercase tracking-wider text-red-400">Escalated to Human</span>
              <ShieldAlert class="h-4 w-4 text-red-500" />
            </div>
            <div class="mt-2">
              <div class="text-xl font-bold tracking-tight text-red-400">{metrics.escalated_transactions}</div>
              <p class="text-[10px] text-zinc-400 mt-0.5">Requires manual intervention</p>
            </div>
          </div>
        </div>

        {/* Dynamic Workspace (Charts on Left, Logs/Simulator on Right) */}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow overflow-hidden">
          {/* Left Column: Charts */}
          <div class="lg:col-span-5 flex flex-col space-y-4 overflow-hidden h-full">
            {/* Chart 1: Recovery Overview */}
            <div class="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between flex-grow overflow-hidden">
              <div>
                <h2 class="text-sm font-bold">Recovery Performance Overview</h2>
                <p class="text-[10px] text-zinc-400 mt-0.5">Status of failed payments ingested by Recoup</p>
              </div>
              <div class="h-36 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                    <XAxis type="number" stroke="#52525b" fontSize={10} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#52525b" fontSize={10} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '11px' }}
                      labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
                      itemStyle={{ color: '#f4f4f5' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: AI vs Rule */}
            <div class="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between shrink-0 h-44">
              <div>
                <h2 class="text-sm font-bold">AI vs Rule Operations</h2>
                <p class="text-[10px] text-zinc-400 mt-0.5">Determining the decision maker for interventions</p>
              </div>
              <div class="flex-grow flex items-center justify-center py-2">
                <div class="text-center">
                  <span class="text-2xl font-extrabold tracking-tight text-zinc-300">{metrics.average_touches}</span>
                  <p class="text-[10px] text-zinc-400 mt-0.5">Average Touches to Recovery</p>
                </div>
              </div>
              <div class="border-t border-zinc-800 pt-3 space-y-1.5 text-[11px]">
                <div class="flex justify-between items-center">
                  <div class="flex items-center space-x-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span class="text-zinc-400">Rule Engine (Caps, States)</span>
                  </div>
                  <span class="font-bold text-zinc-200">100% Deterministic</span>
                </div>
                <div class="flex justify-between items-center">
                  <div class="flex items-center space-x-1.5">
                    <span class="w-2 h-2 rounded-full bg-violet-500"></span>
                    <span class="text-zinc-400">AI Fallback Classifications</span>
                  </div>
                  <span class="font-bold text-zinc-200">Groq LLM Guard</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Workspace (Tabs & Form) */}
          <div class="lg:col-span-7 flex flex-col overflow-hidden h-full">
            {/* Tab Selection */}
            <div class="border-b border-zinc-800 flex space-x-4 text-xs font-semibold shrink-0 overflow-x-auto pb-1 no-scrollbar">
              <button 
                onClick={() => setActiveTab('logs')}
                class={`pb-2 transition relative shrink-0 ${activeTab === 'logs' ? 'text-emerald-400 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <span>Audit Log Trail</span>
                {activeTab === 'logs' && <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></span>}
              </button>
              <button 
                onClick={() => setActiveTab('txns')}
                class={`pb-2 transition relative shrink-0 ${activeTab === 'txns' ? 'text-emerald-400 font-extrabold' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <span>All Transactions ({transactions.length})</span>
                {activeTab === 'txns' && <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></span>}
              </button>
              <button 
                onClick={() => setActiveTab('outbox')}
                class={`pb-2 transition relative shrink-0 ${activeTab === 'outbox' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <span>WhatsApp Outbox ({outbox.length})</span>
                {activeTab === 'outbox' && <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></span>}
              </button>
              <button 
                onClick={() => setActiveTab('human')}
                class={`pb-2 transition relative shrink-0 ${activeTab === 'human' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <span>Human Queue ({escalations.length})</span>
                {activeTab === 'human' && <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></span>}
              </button>
              <button 
                onClick={() => setActiveTab('simulator')}
                class={`pb-2 transition relative shrink-0 font-extrabold ${activeTab === 'simulator' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <span class="flex items-center space-x-1.5">
                  <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse border border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  <span>Webhook Simulator (Live Test)</span>
                </span>
                {activeTab === 'simulator' && <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"></span>}
              </button>
            </div>

            {/* Tabs Contents */}
            <div class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex-grow flex flex-col mt-4">
          {activeTab === 'logs' && (
            <div class="overflow-auto flex-grow max-h-full">
              <table class="w-full text-left border-collapse text-sm">
                <thead>
                  <tr class="bg-zinc-800/40 border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    <th class="py-3 px-4">Timestamp</th>
                    <th class="py-3 px-4">Txn ID</th>
                    <th class="py-3 px-4">Stage</th>
                    <th class="py-3 px-4">Actor</th>
                    <th class="py-3 px-4">Reason</th>
                    <th class="py-3 px-4">Action Taken</th>
                    <th class="py-3 px-4">Outcome</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="7" class="py-8 text-center text-zinc-500">No logs generated yet. Trigger some webhooks or run the evaluation script.</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} class="hover:bg-zinc-800/20 transition">
                        <td class="py-3 px-4 text-xs font-mono text-zinc-400">{new Date(log.timestamp).toLocaleString()}</td>
                        <td class="py-3 px-4 font-mono font-bold text-zinc-200">{log.txn_id}</td>
                        <td class="py-3 px-4">
                          <span class={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            log.stage === 'INGEST' ? 'bg-zinc-800 text-zinc-300' :
                            log.stage === 'DIAGNOSE' ? 'bg-sky-950 text-sky-400 border border-sky-900' :
                            log.stage === 'DECIDE' ? 'bg-violet-950 text-violet-400 border border-violet-900' :
                            log.stage === 'ACT' ? 'bg-amber-950 text-amber-400 border border-amber-900' :
                            log.stage === 'ESCALATE' ? 'bg-red-950 text-red-400 border border-red-900' :
                            'bg-emerald-950 text-emerald-400 border border-emerald-900'
                          }`}>{log.stage}</span>
                        </td>
                        <td class="py-3 px-4 font-semibold">
                          <span class={`${
                            log.actor === 'rule' ? 'text-zinc-300' :
                            log.actor === 'ai' ? 'text-violet-400' : 'text-emerald-400'
                          }`}>{log.actor.toUpperCase()}</span>
                        </td>
                        <td class="py-3 px-4 text-zinc-300 max-w-xs truncate" title={log.reason}>{log.reason}</td>
                        <td class="py-3 px-4 font-mono text-xs text-zinc-400">{log.action || '-'}</td>
                        <td class="py-3 px-4 font-semibold text-zinc-200">{log.outcome}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'txns' && (
            <div class="overflow-auto flex-grow max-h-full">
              <table class="w-full text-left border-collapse text-sm">
                <thead>
                  <tr class="bg-zinc-800/40 border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    <th class="py-3 px-4">Txn ID</th>
                    <th class="py-3 px-4">Customer</th>
                    <th class="py-3 px-4">Segment</th>
                    <th class="py-3 px-4">Amount</th>
                    <th class="py-3 px-4">Status</th>
                    <th class="py-3 px-4">Diagnosis</th>
                    <th class="py-3 px-4">Attempts</th>
                    <th class="py-3 px-4">Last Update</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="8" class="py-8 text-center text-zinc-500">No transactions recorded yet.</td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id} class="hover:bg-zinc-800/20 transition">
                        <td class="py-3 px-4 font-mono font-bold text-zinc-200">{t.id}</td>
                        <td class="py-3 px-4">
                          <div>{t.customer_name}</div>
                          <div class="text-xs text-zinc-500">{t.customer_email} | {t.customer_phone}</div>
                        </td>
                        <td class="py-3 px-4 uppercase text-xs font-semibold text-zinc-400">{t.customer_segment}</td>
                        <td class="py-3 px-4 font-bold text-zinc-200">{formatCurrency(t.amount)}</td>
                        <td class="py-3 px-4">
                          <span class={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            t.status === 'recovered' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                            t.status === 'escalated' ? 'bg-red-950 text-red-400 border border-red-900' :
                            t.status === 'nudge_sent' ? 'bg-amber-950 text-amber-400 border border-amber-900' :
                            'bg-zinc-800 text-zinc-300'
                          }`}>{t.status}</span>
                        </td>
                        <td class="py-3 px-4 font-mono text-xs text-sky-400">{t.normalized_reason || 'UNRESOLVED'}</td>
                        <td class="py-3 px-4 font-semibold text-zinc-300">{t.attempt_count}</td>
                        <td class="py-3 px-4 text-xs font-mono text-zinc-500">{new Date(t.updated_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'outbox' && (
            <div class="overflow-auto flex-grow max-h-full">
              <table class="w-full text-left border-collapse text-sm">
                <thead>
                  <tr class="bg-zinc-800/40 border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    <th class="py-3 px-4">Sent At</th>
                    <th class="py-3 px-4">Txn ID</th>
                    <th class="py-3 px-4">Recipient Phone</th>
                    <th class="py-3 px-4">Message Content</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800">
                  {outbox.length === 0 ? (
                    <tr>
                      <td colSpan="4" class="py-8 text-center text-zinc-500">WhatsApp outbox is empty.</td>
                    </tr>
                  ) : (
                    outbox.map((msg) => (
                      <tr key={msg.id} class="hover:bg-zinc-800/20 transition">
                        <td class="py-3 px-4 text-xs font-mono text-zinc-500">{new Date(msg.sent_at).toLocaleString()}</td>
                        <td class="py-3 px-4 font-mono text-zinc-300">{msg.txn_id}</td>
                        <td class="py-3 px-4 text-zinc-200">{msg.customer_phone}</td>
                        <td class="py-3 px-4 text-zinc-300 whitespace-pre-line leading-relaxed max-w-lg font-sans py-4">{msg.message_body}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'human' && (
            <div class="overflow-auto flex-grow max-h-full">
              <table class="w-full text-left border-collapse text-sm">
                <thead>
                  <tr class="bg-zinc-800/40 border-b border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    <th class="py-3 px-4">Escalated At</th>
                    <th class="py-3 px-4">Txn ID</th>
                    <th class="py-3 px-4">Escalation Reason</th>
                    <th class="py-3 px-4">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800">
                  {escalations.length === 0 ? (
                    <tr>
                      <td colSpan="4" class="py-8 text-center text-zinc-500">Human queue is empty. Clean sheet!</td>
                    </tr>
                  ) : (
                    escalations.map((esc) => (
                      <tr key={esc.id} class="hover:bg-zinc-800/20 transition">
                        <td class="py-3 px-4 text-xs font-mono text-zinc-500">{new Date(esc.escalated_at).toLocaleString()}</td>
                        <td class="py-3 px-4 font-mono font-bold text-red-400">{esc.txn_id}</td>
                        <td class="py-3 px-4 font-mono text-xs text-zinc-300">{esc.reason}</td>
                        <td class="py-3 px-4">
                          <button class="bg-zinc-800 hover:bg-emerald-500 hover:text-black border border-zinc-700 hover:border-emerald-600 text-xs px-3 py-1.5 rounded-lg transition font-medium">
                            Resolve Manually
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'simulator' && (
            <div class="p-5 max-w-2xl mx-auto overflow-y-auto flex-grow max-h-full">
              <h3 class="text-lg font-bold mb-2 text-zinc-100">Simulate Razorpay Webhook Failure</h3>
              <p class="text-sm text-zinc-400 mb-6">
                Fill in the details below to simulate a live `payment.failed` webhook event. 
                Recoup will run it instantly through the recovery pipeline (Diagnose -> Decide -> Act -> Track).
              </p>

              {simSuccess && (
                <div class="mb-6 bg-emerald-950/40 border border-emerald-800 text-emerald-200 p-4 rounded-xl flex items-center space-x-3 text-sm">
                  <CheckCircle class="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <span class="font-bold">Success!</span> Webhook simulated successfully. Check the <strong>Audit Log Trail</strong> or <strong>All Transactions</strong> tabs to see the live results!
                  </div>
                </div>
              )}

              <form onSubmit={handleSimulate} class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Customer Name</label>
                    <input 
                      type="text" 
                      value={simName}
                      onChange={(e) => setSimName(e.target.value)}
                      required
                      class="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Customer Email</label>
                    <input 
                      type="email" 
                      value={simEmail}
                      onChange={(e) => setSimEmail(e.target.value)}
                      required
                      class="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="md:col-span-2">
                    <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Phone Number</label>
                    <input 
                      type="text" 
                      value={simPhone}
                      onChange={(e) => setSimPhone(e.target.value)}
                      required
                      class="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Customer Segment</label>
                    <select 
                      value={simSegment}
                      onChange={(e) => setSimSegment(e.target.value)}
                      class="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none transition"
                    >
                      <option value="retail">Retail (Hinglish Nudges)</option>
                      <option value="business">Business (English Nudges)</option>
                    </select>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Amount (INR)</label>
                    <input 
                      type="number" 
                      value={simAmount}
                      onChange={(e) => setSimAmount(e.target.value)}
                      required
                      min="1"
                      class="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none transition"
                    />
                  </div>
                  <div class="md:col-span-2">
                    <label class="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Failure Reason (Ambiguous Text / Known Code)</label>
                    <input 
                      type="text" 
                      value={simReason}
                      onChange={(e) => setSimReason(e.target.value)}
                      required
                      placeholder="e.g. Card expired or bank server timed out"
                      class="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none transition"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={simulating}
                  class="w-full flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black py-3 rounded-xl text-sm font-semibold transition disabled:opacity-50 mt-4"
                >
                  <RefreshCw class={`h-4 w-4 ${simulating ? 'animate-spin' : ''}`} />
                  <span>{simulating ? 'Processing Webhook Recovery...' : 'Send Simulation Webhook'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  </main>
    </div>
  );
}

export default App;
