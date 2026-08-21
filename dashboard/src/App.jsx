import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { 
  Activity, AlertCircle, CheckCircle, RefreshCw, MessageSquare, ShieldAlert, DollarSign, ArrowRightLeft, Users
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('home');
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
    { name: 'Escalated', value: metrics.escalated_transactions, color: '#f43f5e' },
    { name: 'Pending', value: Math.max(0, metrics.total_transactions - metrics.recovered_transactions - metrics.escalated_transactions), color: '#2563eb' }
  ];

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  return (
    <div class="h-screen max-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-500 selection:text-white overflow-hidden">
      {/* Header */}
      <header class="border-b border-slate-200 bg-white sticky top-0 z-30 px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0 shadow-sm">
        <div class="flex items-center space-x-3">
          <img src="/logo.png" alt="Recoup Logo" class="h-11 w-auto object-contain rounded-lg shadow-sm border border-slate-100" />
          <div>
            <h1 class="text-xl font-bold tracking-tight text-slate-900">Recoup</h1>
            <p class="text-xs text-slate-500">Razorpay Revenue Recovery Pipeline</p>
          </div>
        </div>

        {/* Header Navbar Pages */}
        <div class="flex items-center space-x-5 text-sm font-bold overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
          <button 
            onClick={() => setActiveTab('home')}
            class={`pb-1 lg:pb-0 transition relative shrink-0 ${activeTab === 'home' ? 'text-blue-600 font-black' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <span>Home</span>
            {activeTab === 'home' && <span class="hidden lg:block absolute -bottom-5.5 left-0 right-0 h-0.5 bg-blue-600"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            class={`pb-1 lg:pb-0 transition relative shrink-0 ${activeTab === 'logs' ? 'text-blue-600 font-black' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <span>Audit Log Trail</span>
            {activeTab === 'logs' && <span class="hidden lg:block absolute -bottom-5.5 left-0 right-0 h-0.5 bg-blue-600"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('txns')}
            class={`pb-1 lg:pb-0 transition relative shrink-0 ${activeTab === 'txns' ? 'text-blue-600 font-black' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <span>All Transactions ({transactions.length})</span>
            {activeTab === 'txns' && <span class="hidden lg:block absolute -bottom-5.5 left-0 right-0 h-0.5 bg-blue-600"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('outbox')}
            class={`pb-1 lg:pb-0 transition relative shrink-0 ${activeTab === 'outbox' ? 'text-blue-600 font-black' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <span>WhatsApp Outbox ({outbox.length})</span>
            {activeTab === 'outbox' && <span class="hidden lg:block absolute -bottom-5.5 left-0 right-0 h-0.5 bg-blue-600"></span>}
          </button>
          <button 
            onClick={() => setActiveTab('human')}
            class={`pb-1 lg:pb-0 transition relative shrink-0 ${activeTab === 'human' ? 'text-blue-600 font-black' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <span>Human Queue ({escalations.length})</span>
            {activeTab === 'human' && <span class="hidden lg:block absolute -bottom-5.5 left-0 right-0 h-0.5 bg-blue-600"></span>}
          </button>
        </div>

        <div class="flex items-center justify-between lg:justify-end space-x-4">
          <button 
            onClick={fetchData} 
            disabled={loading}
            class="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border border-transparent px-4.5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 shadow-sm"
          >
            <RefreshCw class={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <div class="flex items-center text-xs text-slate-500" title="API Connected">
            <span class="inline-block w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse"></span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main class="flex-grow p-6 space-y-4 max-w-7xl mx-auto w-full flex flex-col overflow-hidden min-h-0">
        {error && (
          <div class="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start space-x-3 text-sm shrink-0 shadow-sm">
            <AlertCircle class="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <span class="font-bold">Connection Error:</span> {error}
              <p class="mt-1 text-xs text-red-600">
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
          <div class="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Total At-Risk</span>
              <DollarSign class="h-4 w-4 text-slate-400" />
            </div>
            <div class="mt-2">
              <div class="text-xl font-bold tracking-tight text-slate-900">{formatCurrency(metrics.total_revenue)}</div>
              <p class="text-[10px] text-slate-400 mt-0.5">{metrics.total_transactions} transactions failed</p>
            </div>
          </div>

          {/* Card 2 */}
          <div class="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-600">Recovered Revenue</span>
              <CheckCircle class="h-4 w-4 text-emerald-500" />
            </div>
            <div class="mt-2">
              <div class="text-xl font-bold tracking-tight text-emerald-600">{formatCurrency(metrics.recovered_revenue)}</div>
              <p class="text-[10px] text-slate-400 mt-0.5">{metrics.recovered_transactions} cases resolved successfully</p>
            </div>
          </div>

          {/* Card 3 */}
          <div class="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Recovery Rate</span>
              <Activity class="h-4 w-4 text-blue-600" />
            </div>
            <div class="mt-2">
              <div class="text-xl font-bold tracking-tight text-slate-900">{metrics.recovery_rate}%</div>
              <div class="w-full bg-slate-100 rounded-full h-1 mt-1.5">
                <div class="bg-blue-600 h-1 rounded-full" style={{ width: `${metrics.recovery_rate}%` }}></div>
              </div>
            </div>
          </div>

          {/* Card 4 */}
          <div class="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
            <div class="flex items-center justify-between text-slate-400">
              <span class="text-xs font-bold uppercase tracking-wider text-rose-600">Escalated to Human</span>
              <ShieldAlert class="h-4 w-4 text-rose-500" />
            </div>
            <div class="mt-2">
              <div class="text-xl font-bold tracking-tight text-rose-600">{metrics.escalated_transactions}</div>
              <p class="text-[10px] text-slate-400 mt-0.5">Requires manual intervention</p>
            </div>
          </div>
        </div>

        {/* HOME VIEW: Charts + Webhook Simulator Form */}
        {activeTab === 'home' && (
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow overflow-hidden">
            {/* Left Column: Charts */}
            <div class="lg:col-span-5 flex flex-col space-y-4 overflow-hidden h-full">
              {/* Chart 1: Recovery Overview */}
              <div class="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between flex-grow overflow-hidden shadow-sm">
                <div>
                  <h2 class="text-sm font-bold text-slate-800">Recovery Performance Overview</h2>
                  <p class="text-[10px] text-slate-500 mt-0.5">Status of failed payments ingested by Recoup</p>
                </div>
                <div class="h-36 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#0f172a' }}
                        labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                        itemStyle={{ color: '#0f172a' }}
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
              <div class="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col justify-between shrink-0 h-44 shadow-sm">
                <div>
                  <h2 class="text-sm font-bold text-slate-800">AI vs Rule Operations</h2>
                  <p class="text-[10px] text-slate-500 mt-0.5">Determining the decision maker for interventions</p>
                </div>
                <div class="flex-grow flex items-center justify-center py-2">
                  <div class="text-center">
                    <span class="text-2xl font-extrabold tracking-tight text-slate-800">{metrics.average_touches}</span>
                    <p class="text-[10px] text-slate-500 mt-0.5">Average Touches to Recovery</p>
                  </div>
                </div>
                <div class="border-t border-slate-100 pt-3 space-y-1.5 text-[11px]">
                  <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-1.5">
                      <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span class="text-slate-500">Rule Engine (Caps, States)</span>
                    </div>
                    <span class="font-bold text-slate-700">100% Deterministic</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-1.5">
                      <span class="w-2 h-2 rounded-full bg-violet-600"></span>
                      <span class="text-slate-500">AI Fallback Classifications</span>
                    </div>
                    <span class="font-bold text-slate-700">Groq LLM Guard</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Webhook Simulator Form */}
            <div class="lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-full shadow-sm">
              <div class="p-5 max-w-2xl mx-auto overflow-y-auto flex-grow max-h-full">
                <h3 class="text-lg font-bold mb-2 text-slate-800 flex items-center space-x-2">
                  <span class="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse border border-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.8)]"></span>
                  <span>Simulate Razorpay Webhook Failure</span>
                </h3>
                <p class="text-xs text-slate-500 mb-6">
                  Fill in the details below to simulate a live `payment.failed` webhook event. 
                  Recoup will run it instantly through the recovery pipeline.
                </p>

                {simSuccess && (
                  <div class="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center space-x-3 text-xs shrink-0 shadow-sm">
                    <CheckCircle class="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <span class="font-bold">Success!</span> Webhook simulated successfully. Go to the <strong>Audit Log Trail</strong> or <strong>All Transactions</strong> pages in the header to see the live results!
                    </div>
                  </div>
                )}

                <form onSubmit={handleSimulate} class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Name</label>
                      <input 
                        type="text" 
                        value={simName}
                        onChange={(e) => setSimName(e.target.value)}
                        required
                        class="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none transition shadow-sm"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Email</label>
                      <input 
                        type="email" 
                        value={simEmail}
                        onChange={(e) => setSimEmail(e.target.value)}
                        required
                        class="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none transition shadow-sm"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="md:col-span-2">
                      <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                      <input 
                        type="text" 
                        value={simPhone}
                        onChange={(e) => setSimPhone(e.target.value)}
                        required
                        class="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none transition shadow-sm"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Segment</label>
                      <select 
                        value={simSegment}
                        onChange={(e) => setSimSegment(e.target.value)}
                        class="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none transition shadow-sm"
                      >
                        <option value="retail">Retail (Hinglish Nudges)</option>
                        <option value="business">Business (English Nudges)</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount (INR)</label>
                      <input 
                        type="number" 
                        value={simAmount}
                        onChange={(e) => setSimAmount(e.target.value)}
                        required
                        min="1"
                        class="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none transition shadow-sm"
                      />
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Failure Reason</label>
                      <input 
                        type="text" 
                        value={simReason}
                        onChange={(e) => setSimReason(e.target.value)}
                        required
                        placeholder="e.g. Card expired or bank server timed out"
                        class="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none transition shadow-sm"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={simulating}
                    class="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 rounded-xl text-sm font-bold transition shadow-sm mt-4 shrink-0"
                  >
                    <RefreshCw class={`h-4 w-4 ${simulating ? 'animate-spin' : ''}`} />
                    <span>{simulating ? 'Processing Webhook Recovery...' : 'Send Simulation Webhook'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* DATA PAGES: Fullscreen Tables */}
        {activeTab !== 'home' && (
          <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden flex-grow flex flex-col shadow-sm min-h-0">
            {activeTab === 'logs' && (
              <div class="overflow-y-auto flex-grow min-h-0">
                <table class="w-full text-left border-collapse text-sm text-slate-700">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      <th class="py-3 px-4">Timestamp</th>
                      <th class="py-3 px-4">Txn ID</th>
                      <th class="py-3 px-4">Stage</th>
                      <th class="py-3 px-4">Actor</th>
                      <th class="py-3 px-4">Reason</th>
                      <th class="py-3 px-4">Action Taken</th>
                      <th class="py-3 px-4">Outcome</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan="7" class="py-8 text-center text-slate-400">No logs generated yet. Use the Webhook Simulator on the Home page.</td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} class="hover:bg-slate-50/50 transition">
                          <td class="py-3 px-4 text-xs font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                          <td class="py-3 px-4 font-mono font-bold text-slate-800">{log.txn_id}</td>
                          <td class="py-3 px-4">
                            <span class={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              log.stage === 'INGEST' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                              log.stage === 'DIAGNOSE' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                              log.stage === 'DECIDE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                              log.stage === 'ACT' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              log.stage === 'ESCALATE' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>{log.stage}</span>
                          </td>
                          <td class="py-3 px-4 font-semibold">
                            <span class={`${
                              log.actor === 'rule' ? 'text-slate-600' :
                              log.actor === 'ai' ? 'text-violet-600' : 'text-emerald-600'
                            }`}>{log.actor.toUpperCase()}</span>
                          </td>
                          <td class="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.reason}>{log.reason}</td>
                          <td class="py-3 px-4 font-mono text-xs text-slate-500">{log.action || '-'}</td>
                          <td class="py-3 px-4 font-semibold text-slate-700">{log.outcome}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'txns' && (
              <div class="overflow-y-auto flex-grow min-h-0">
                <table class="w-full text-left border-collapse text-sm text-slate-700">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
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
                  <tbody class="divide-y divide-slate-100">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan="8" class="py-8 text-center text-slate-400">No transactions recorded yet.</td>
                      </tr>
                    ) : (
                      transactions.map((t) => (
                        <tr key={t.id} class="hover:bg-slate-50/50 transition">
                          <td class="py-3 px-4 font-mono font-bold text-slate-800">{t.id}</td>
                          <td class="py-3 px-4">
                            <div class="font-semibold text-slate-800">{t.customer_name}</div>
                            <div class="text-xs text-slate-400">{t.customer_email} | {t.customer_phone}</div>
                          </td>
                          <td class="py-3 px-4 uppercase text-xs font-semibold text-slate-500">{t.customer_segment}</td>
                          <td class="py-3 px-4 font-bold text-slate-800">{formatCurrency(t.amount)}</td>
                          <td class="py-3 px-4">
                            <span class={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              t.status === 'recovered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              t.status === 'escalated' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              t.status === 'nudge_sent' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>{t.status}</span>
                          </td>
                          <td class="py-3 px-4 font-mono text-xs text-blue-600 font-semibold">{t.normalized_reason || 'UNRESOLVED'}</td>
                          <td class="py-3 px-4 font-semibold text-slate-600">{t.attempt_count}</td>
                          <td class="py-3 px-4 text-xs font-mono text-slate-400">{new Date(t.updated_at).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'outbox' && (
              <div class="overflow-y-auto flex-grow min-h-0">
                <table class="w-full text-left border-collapse text-sm text-slate-700">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      <th class="py-3 px-4">Sent At</th>
                      <th class="py-3 px-4">Txn ID</th>
                      <th class="py-3 px-4">Recipient Phone</th>
                      <th class="py-3 px-4">Message Content</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    {outbox.length === 0 ? (
                      <tr>
                        <td colSpan="4" class="py-8 text-center text-slate-400">WhatsApp outbox is empty.</td>
                      </tr>
                    ) : (
                      outbox.map((msg) => (
                        <tr key={msg.id} class="hover:bg-slate-50/50 transition">
                          <td class="py-3 px-4 text-xs font-mono text-slate-400">{new Date(msg.sent_at).toLocaleString()}</td>
                          <td class="py-3 px-4 font-mono text-slate-600">{msg.txn_id}</td>
                          <td class="py-3 px-4 text-slate-800">{msg.customer_phone}</td>
                          <td class="py-3 px-4 text-slate-600 whitespace-pre-line leading-relaxed max-w-lg font-sans py-4">{msg.message_body}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'human' && (
              <div class="overflow-y-auto flex-grow min-h-0">
                <table class="w-full text-left border-collapse text-sm text-slate-700">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      <th class="py-3 px-4">Escalated At</th>
                      <th class="py-3 px-4">Txn ID</th>
                      <th class="py-3 px-4">Escalation Reason</th>
                      <th class="py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    {escalations.length === 0 ? (
                      <tr>
                        <td colSpan="4" class="py-8 text-center text-slate-400">Human queue is empty. Clean sheet!</td>
                      </tr>
                    ) : (
                      escalations.map((esc) => (
                        <tr key={esc.id} class="hover:bg-slate-50/50 transition">
                          <td class="py-3 px-4 text-xs font-mono text-slate-400">{new Date(esc.escalated_at).toLocaleString()}</td>
                          <td class="py-3 px-4 font-mono font-bold text-rose-600">{esc.txn_id}</td>
                          <td class="py-3 px-4 font-mono text-xs text-slate-600">{esc.reason}</td>
                          <td class="py-3 px-4">
                            <button class="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white hover:text-white border-transparent text-xs px-3 py-1.5 rounded-lg transition font-semibold shadow-sm">
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
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
