import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Users, UserMinus, BarChart2, Send, Clock, Download, Eye, X } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { templateShipping, templateFollowup, templateUpsell, templateWaitlistLaunch } from '../utils/emailTemplates';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

const EMAIL_TYPE_LABELS = {
  order_confirmation: 'Confirmación de orden',
  shipping: 'Despacho',
  followup: 'Seguimiento',
  upsell: 'Upsell',
  campaign: 'Campaña',
  waitlist_launch: 'Lanzamiento waitlist',
};

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-zinc-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-black text-zinc-950">{value}</p>
        <p className="text-sm font-medium text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

export default function EmailDashboard() {
  const [activeTab, setActiveTab] = useState('stats');
  const [recipientTab, setRecipientTab] = useState('clientes');

  // Data
  const [emailLog, setEmailLog] = useState([]);
  const [unsubscribes, setUnsubscribes] = useState([]);
  const [clientEmails, setClientEmails] = useState([]);
  const [waitlistEmails, setWaitlistEmails] = useState([]);

  // Campaign form
  const [audience, setAudience] = useState('clientes');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Filters
  const [logTypeFilter, setLogTypeFilter] = useState('all');

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logRes, unsubRes, ordersRes, waitlistRes] = await Promise.all([
        supabase.from('email_log').select('*').order('sent_at', { ascending: false }).limit(50),
        supabase.from('email_unsubscribe').select('email'),
        supabase.from('orders').select('customer_email').not('customer_email', 'is', null),
        supabase.from('waitlist').select('email').not('email', 'is', null),
      ]);

      const unsubEmails = new Set((unsubRes.data || []).map(u => u.email.toLowerCase()));

      setEmailLog(logRes.data || []);
      setUnsubscribes(unsubRes.data || []);

      const uniqueClients = [...new Set((ordersRes.data || []).map(o => o.customer_email?.toLowerCase()).filter(Boolean))];
      setClientEmails(uniqueClients.filter(e => !unsubEmails.has(e)));

      const uniqueWaitlist = [...new Set((waitlistRes.data || []).map(w => w.email?.toLowerCase()).filter(Boolean))];
      setWaitlistEmails(uniqueWaitlist.filter(e => !unsubEmails.has(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getRecipientList = () => {
    if (audience === 'clientes') return clientEmails;
    if (audience === 'waitlist') return waitlistEmails;
    return [...new Set([...clientEmails, ...waitlistEmails])];
  };

  const recipientCount = getRecipientList().length;

  const exportCSV = (emails, filename) => {
    const csv = 'email\n' + emails.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendCampaign = async () => {
    if (!subject.trim() || !body.trim()) {
      setSendResult({ error: 'Completa el asunto y el cuerpo del email.' });
      return;
    }
    const recipients = getRecipientList();
    if (recipients.length === 0) {
      setSendResult({ error: 'No hay destinatarios activos para esta audiencia.' });
      return;
    }

    const confirmed = window.confirm(`¿Enviar a ${recipients.length} destinatarios?`);
    if (!confirmed) return;

    setSending(true);
    setSendResult(null);
    let sent = 0;
    let skipped = 0;
    let errors = 0;
    let rateLimited = 0;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const sendOne = async (email, attempt = 1) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-campaign-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ to: email, subject, html: body, email_type: 'campaign' }),
      });
      // Rate limit: esperar y reintentar hasta 3 veces con backoff
      if (res.status === 429 && attempt <= 3) {
        const backoff = attempt * 2000;
        await new Promise(r => setTimeout(r, backoff));
        return sendOne(email, attempt + 1);
      }
      return res;
    };

    for (const email of recipients) {
      try {
        const res = await sendOne(email);
        if (res.status === 429) {
          rateLimited++;
        } else {
          const data = await res.json();
          if (data.success) sent++;
          else if (data.skipped_reason) skipped++;
          else errors++;
        }
      } catch {
        errors++;
      }
      // Delay 100ms entre envíos para no superar rate limit de Resend
      await new Promise(r => setTimeout(r, 100));
    }

    setSending(false);
    setSendResult({ sent, skipped, errors, rateLimited });
    load();
  };

  // Stats
  const totalSent = emailLog.length;
  const totalUnsub = unsubscribes.length;
  const byType = emailLog.reduce((acc, e) => {
    acc[e.email_type] = (acc[e.email_type] || 0) + 1;
    return acc;
  }, {});

  const filteredLog = logTypeFilter === 'all'
    ? emailLog
    : emailLog.filter(e => e.email_type === logTypeFilter);

  const TABS = [
    { id: 'stats', label: 'Estadísticas', icon: BarChart2 },
    { id: 'recipients', label: 'Destinatarios', icon: Users },
    { id: 'campaign', label: 'Enviar campaña', icon: Send },
    { id: 'history', label: 'Historial', icon: Clock },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">Email Marketing</h1>
            <p className="text-zinc-500 font-medium">Campañas, historial y bajas — Ley 19.628</p>
          </div>
          <a href="/admin" className="px-4 py-2 bg-zinc-200 text-zinc-700 rounded-xl font-bold text-sm hover:bg-zinc-300 transition-colors">
            ← Admin
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white border border-zinc-100 rounded-2xl p-1.5 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-zinc-950 text-white'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ==================== ESTADÍSTICAS ==================== */}
        {activeTab === 'stats' && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <StatCard icon={Mail} label="Emails enviados" value={totalSent} color="bg-emerald-500" />
              <StatCard icon={UserMinus} label="Bajas totales" value={totalUnsub} color="bg-red-500" />
              <StatCard icon={Users} label="Destinatarios activos" value={clientEmails.length + waitlistEmails.length} color="bg-blue-500" />
            </div>

            <div className="bg-white rounded-2xl border border-zinc-100 p-6">
              <h2 className="text-lg font-black text-zinc-950 mb-4">Emails por tipo</h2>
              {Object.keys(byType).length === 0 ? (
                <p className="text-zinc-400 text-sm">Sin registros aún.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left text-xs font-black uppercase tracking-widest text-zinc-400 pb-3">Tipo</th>
                      <th className="text-right text-xs font-black uppercase tracking-widest text-zinc-400 pb-3">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byType).map(([type, count]) => (
                      <tr key={type} className="border-b border-zinc-50 last:border-0">
                        <td className="py-3 text-sm font-medium text-zinc-700">{EMAIL_TYPE_LABELS[type] || type}</td>
                        <td className="py-3 text-right font-black text-zinc-950">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ==================== DESTINATARIOS ==================== */}
        {activeTab === 'recipients' && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-6">
            <div className="flex gap-2 mb-6">
              {[
                { id: 'clientes', label: `Clientes (${clientEmails.length})` },
                { id: 'waitlist', label: `Waitlist (${waitlistEmails.length})` },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setRecipientTab(t.id)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                    recipientTab === t.id ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-zinc-500 font-medium">
                {recipientTab === 'clientes' ? clientEmails.length : waitlistEmails.length} emails activos (excluye bajas)
              </p>
              <button
                onClick={() => {
                  const list = recipientTab === 'clientes' ? clientEmails : waitlistEmails;
                  exportCSV(list, `nexcard-${recipientTab}-${Date.now()}.csv`);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl font-bold text-sm transition-colors"
              >
                <Download size={14} />
                Exportar CSV
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-1">
              {(recipientTab === 'clientes' ? clientEmails : waitlistEmails).map(email => (
                <div key={email} className="px-4 py-2.5 bg-zinc-50 rounded-xl text-sm font-medium text-zinc-700">
                  {email}
                </div>
              ))}
              {(recipientTab === 'clientes' ? clientEmails : waitlistEmails).length === 0 && (
                <p className="text-zinc-400 text-sm py-4 text-center">Sin destinatarios activos.</p>
              )}
            </div>
          </div>
        )}

        {/* ==================== CAMPAÑA ==================== */}
        {activeTab === 'campaign' && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-6">
            <h2 className="text-lg font-black text-zinc-950 mb-6">Enviar campaña</h2>

            <div className="space-y-5">
              {/* Audiencia */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Audiencia</label>
                <div className="flex gap-2">
                  {[
                    { id: 'clientes', label: `Clientes (${clientEmails.length})` },
                    { id: 'waitlist', label: `Waitlist (${waitlistEmails.length})` },
                    { id: 'ambos', label: `Ambos (${[...new Set([...clientEmails, ...waitlistEmails])].length})` },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setAudience(opt.id)}
                      className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                        audience === opt.id ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asunto */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Asunto del email..."
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-900 outline-none focus:border-emerald-400 transition-colors"
                />
              </div>

              {/* Cuerpo */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Cuerpo (HTML básico)</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={8}
                  placeholder="<p>Hola, ...</p>"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 outline-none focus:border-emerald-400 transition-colors resize-y font-mono"
                />
              </div>

              {/* Templates rápidos */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Templates rápidos</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Despacho', fn: () => { setSubject('Tu pedido NexCard fue despachado 🚀'); setBody(templateShipping({ customer_email: '{email}', customer_name: '{nombre}', id: '{order_id}' }, '{tracking}')); } },
                    { label: 'Seguimiento', fn: () => { setSubject('¿Cómo va tu NexCard? 💬'); setBody(templateFollowup({ customer_email: '{email}', customer_name: '{nombre}' })); } },
                    { label: 'Upsell', fn: () => { setSubject('10% OFF en tu próxima NexCard 🎁'); setBody(templateUpsell({ customer_email: '{email}', customer_name: '{nombre}' })); } },
                    { label: 'Lanzamiento waitlist', fn: () => { setSubject('¡NexCard ya está disponible! 🎉'); setBody(templateWaitlistLaunch('{email}')); } },
                  ].map(t => (
                    <button
                      key={t.label}
                      onClick={t.fn}
                      className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg font-bold text-xs hover:bg-emerald-100 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview + Enviar */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={!body.trim()}
                  className="flex items-center gap-2 px-4 py-3 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-700 rounded-xl font-bold text-sm transition-colors"
                >
                  <Eye size={15} />
                  Preview
                </button>
                <button
                  onClick={handleSendCampaign}
                  disabled={sending || !subject.trim() || !body.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-sm transition-colors"
                >
                  <Send size={15} />
                  {sending ? 'Enviando...' : `Enviar a ${recipientCount} destinatarios`}
                </button>
              </div>

              {sendResult && (
                <div className={`rounded-2xl p-4 text-sm font-medium ${sendResult.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {sendResult.error ? sendResult.error : (
                    <>Campaña enviada: <strong>{sendResult.sent}</strong> enviados · <strong>{sendResult.skipped}</strong> bajas · <strong>{sendResult.errors}</strong> errores{sendResult.rateLimited > 0 && <> · <strong>{sendResult.rateLimited}</strong> límite de tasa (reintentos agotados)</>}</>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== HISTORIAL ==================== */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-zinc-950">Últimos 50 emails</h2>
              <select
                value={logTypeFilter}
                onChange={e => setLogTypeFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 outline-none"
              >
                <option value="all">Todos los tipos</option>
                {Object.entries(EMAIL_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {filteredLog.length === 0 ? (
              <p className="text-zinc-400 text-sm py-4 text-center">Sin registros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left text-xs font-black uppercase tracking-widest text-zinc-400 pb-3 pr-4">Fecha</th>
                      <th className="text-left text-xs font-black uppercase tracking-widest text-zinc-400 pb-3 pr-4">Destinatario</th>
                      <th className="text-left text-xs font-black uppercase tracking-widest text-zinc-400 pb-3 pr-4">Tipo</th>
                      <th className="text-left text-xs font-black uppercase tracking-widest text-zinc-400 pb-3 pr-4">Asunto</th>
                      <th className="text-left text-xs font-black uppercase tracking-widest text-zinc-400 pb-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLog.map(row => (
                      <tr key={row.id} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50">
                        <td className="py-3 pr-4 text-zinc-400 whitespace-nowrap">{formatDate(row.sent_at)}</td>
                        <td className="py-3 pr-4 font-medium text-zinc-700 max-w-[180px] truncate">{row.recipient_email}</td>
                        <td className="py-3 pr-4">
                          <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded-lg text-xs font-bold">
                            {EMAIL_TYPE_LABELS[row.email_type] || row.email_type}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-zinc-600 max-w-[220px] truncate">{row.subject || '—'}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-100">
              <h3 className="font-black text-zinc-950">Preview del email</h3>
              <button onClick={() => setShowPreview(false)} className="text-zinc-400 hover:text-zinc-700">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <div className="mb-3 bg-zinc-50 rounded-xl px-4 py-2 text-sm">
                <span className="text-zinc-400 font-medium">Asunto: </span>
                <span className="font-bold text-zinc-900">{subject}</span>
              </div>
              <iframe
                srcDoc={body}
                title="Preview email"
                className="w-full h-96 border border-zinc-100 rounded-xl"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
