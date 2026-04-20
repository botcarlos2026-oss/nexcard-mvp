import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Users, UserMinus, BarChart2, Send, Clock, Download, Eye, X, ShoppingCart } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { api } from '../services/api';
import { templateShipping, templateFollowup, templateUpsell, templateWaitlistLaunch } from '../utils/emailTemplates';
import AdminShell from './AdminShell';
import AdminStat from './ui/AdminStat';
import AdminCard from './ui/AdminCard';
import AdminBadge from './ui/AdminBadge';
import { Table, THead, TH, TR, TD } from './ui/AdminTable';

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

  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [sendingReminder, setSendingReminder] = useState(null);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logRes, unsubRes, ordersRes, waitlistRes, cartsData] = await Promise.all([
        supabase.from('email_log').select('*').order('sent_at', { ascending: false }).limit(50),
        supabase.from('email_unsubscribe').select('email'),
        supabase.from('orders').select('customer_email').not('customer_email', 'is', null),
        supabase.from('waitlist').select('email').not('email', 'is', null),
        api.getAbandonedCarts().catch(() => []),
      ]);

      const unsubEmails = new Set((unsubRes.data || []).map(u => u.email.toLowerCase()));

      setEmailLog(logRes.data || []);
      setUnsubscribes(unsubRes.data || []);
      setAbandonedCarts(cartsData || []);

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
    { id: 'abandoned', label: 'Carritos abandonados', icon: ShoppingCart },
  ];

  if (loading) {
    return (
      <AdminShell active="emails" title="Email Marketing" subtitle="Campañas, historial y bajas — Ley 19.628">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="emails" title="Email Marketing" subtitle="Campañas, historial y bajas — Ley 19.628">
      <div className="space-y-6">

        {/* Tabs */}
        <div className="flex gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 w-fit flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
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
              <AdminStat label="Emails enviados" value={totalSent} accent="emerald" />
              <AdminStat label="Bajas totales" value={totalUnsub} accent="red" />
              <AdminStat label="Destinatarios activos" value={clientEmails.length + waitlistEmails.length} />
            </div>

            <AdminCard>
              <h2 className="text-base font-bold text-white mb-4">Emails por tipo</h2>
              {Object.keys(byType).length === 0 ? (
                <p className="text-zinc-500 text-sm">Sin registros aún.</p>
              ) : (
                <Table>
                  <THead>
                    <TH>Tipo</TH>
                    <TH className="text-right">Cantidad</TH>
                  </THead>
                  <tbody>
                    {Object.entries(byType).map(([type, count]) => (
                      <TR key={type}>
                        <TD>{EMAIL_TYPE_LABELS[type] || type}</TD>
                        <TD className="text-right font-bold text-white">{count}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </AdminCard>
          </div>
        )}

        {/* ==================== DESTINATARIOS ==================== */}
        {activeTab === 'recipients' && (
          <AdminCard>
            <div className="flex gap-2 mb-6">
              {[
                { id: 'clientes', label: `Clientes (${clientEmails.length})` },
                { id: 'waitlist', label: `Waitlist (${waitlistEmails.length})` },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setRecipientTab(t.id)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    recipientTab === t.id
                      ? 'bg-emerald-500 text-white'
                      : 'px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-zinc-400 font-medium">
                {recipientTab === 'clientes' ? clientEmails.length : waitlistEmails.length} emails activos (excluye bajas)
              </p>
              <button
                onClick={() => {
                  const list = recipientTab === 'clientes' ? clientEmails : waitlistEmails;
                  exportCSV(list, `nexcard-${recipientTab}-${Date.now()}.csv`);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Download size={14} />
                Exportar CSV
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-1">
              {(recipientTab === 'clientes' ? clientEmails : waitlistEmails).map(email => (
                <div key={email} className="px-4 py-2.5 bg-zinc-800 rounded-lg text-sm font-medium text-zinc-300">
                  {email}
                </div>
              ))}
              {(recipientTab === 'clientes' ? clientEmails : waitlistEmails).length === 0 && (
                <p className="text-zinc-500 text-sm py-4 text-center">Sin destinatarios activos.</p>
              )}
            </div>
          </AdminCard>
        )}

        {/* ==================== CAMPAÑA ==================== */}
        {activeTab === 'campaign' && (
          <AdminCard>
            <h2 className="text-base font-bold text-white mb-6">Enviar campaña</h2>

            <div className="space-y-5">
              {/* Audiencia */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Audiencia</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'clientes', label: `Clientes (${clientEmails.length})` },
                    { id: 'waitlist', label: `Waitlist (${waitlistEmails.length})` },
                    { id: 'ambos', label: `Ambos (${[...new Set([...clientEmails, ...waitlistEmails])].length})` },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setAudience(opt.id)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                        audience === opt.id
                          ? 'bg-emerald-500 text-white'
                          : 'px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asunto */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Asunto del email..."
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                />
              </div>

              {/* Cuerpo */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Cuerpo (HTML básico)</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={8}
                  placeholder="<p>Hola, ...</p>"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-y font-mono"
                />
              </div>

              {/* Templates rápidos */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-zinc-500 font-medium mb-1.5">Templates rápidos</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Despacho', fn: () => { setSubject('Tu pedido NexCard fue despachado'); setBody(templateShipping({ customer_email: '{email}', customer_name: '{nombre}', id: '{order_id}' }, '{tracking}')); } },
                    { label: 'Seguimiento', fn: () => { setSubject('Como va tu NexCard?'); setBody(templateFollowup({ customer_email: '{email}', customer_name: '{nombre}' })); } },
                    { label: 'Upsell', fn: () => { setSubject('10% OFF en tu proxima NexCard'); setBody(templateUpsell({ customer_email: '{email}', customer_name: '{nombre}' })); } },
                    { label: 'Lanzamiento waitlist', fn: () => { setSubject('NexCard ya esta disponible!'); setBody(templateWaitlistLaunch('{email}')); } },
                  ].map(t => (
                    <button
                      key={t.label}
                      onClick={t.fn}
                      className="px-3 py-1.5 bg-emerald-950/50 border border-emerald-900 text-emerald-400 rounded-lg font-bold text-xs hover:bg-emerald-900/50 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview + Enviar */}
              <div className="flex gap-3 pt-2 flex-wrap">
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={!body.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye size={15} />
                  Preview
                </button>
                <button
                  onClick={handleSendCampaign}
                  disabled={sending || !subject.trim() || !body.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={15} />
                  {sending ? 'Enviando...' : `Enviar a ${recipientCount} destinatarios`}
                </button>
              </div>

              {sendResult && (
                <div className={`rounded-xl p-4 text-sm font-medium ${sendResult.error ? 'bg-red-950/50 text-red-400 border border-red-900' : 'bg-emerald-950/50 text-emerald-400 border border-emerald-900'}`}>
                  {sendResult.error ? sendResult.error : (
                    <>Campaña enviada: <strong>{sendResult.sent}</strong> enviados · <strong>{sendResult.skipped}</strong> bajas · <strong>{sendResult.errors}</strong> errores{sendResult.rateLimited > 0 && <> · <strong>{sendResult.rateLimited}</strong> límite de tasa (reintentos agotados)</>}</>
                  )}
                </div>
              )}
            </div>
          </AdminCard>
        )}

        {/* ==================== HISTORIAL ==================== */}
        {activeTab === 'history' && (
          <AdminCard>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">Últimos 50 emails</h2>
              <select
                value={logTypeFilter}
                onChange={e => setLogTypeFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              >
                <option value="all">Todos los tipos</option>
                {Object.entries(EMAIL_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {filteredLog.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4 text-center">Sin registros.</p>
            ) : (
              <Table>
                <THead>
                  <TH>Fecha</TH>
                  <TH>Destinatario</TH>
                  <TH>Tipo</TH>
                  <TH>Asunto</TH>
                  <TH>Estado</TH>
                </THead>
                <tbody>
                  {filteredLog.map(row => (
                    <TR key={row.id}>
                      <TD className="whitespace-nowrap">{formatDate(row.sent_at)}</TD>
                      <TD className="font-medium max-w-[180px] truncate">{row.recipient_email}</TD>
                      <TD>
                        <AdminBadge variant="default">
                          {EMAIL_TYPE_LABELS[row.email_type] || row.email_type}
                        </AdminBadge>
                      </TD>
                      <TD className="max-w-[220px] truncate">{row.subject || '—'}</TD>
                      <TD>
                        <AdminBadge variant="success">{row.status}</AdminBadge>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </AdminCard>
        )}

        {/* ==================== CARRITOS ABANDONADOS ==================== */}
        {activeTab === 'abandoned' && (() => {
          const abandoned = abandonedCarts.filter(c => c.status === 'abandoned' || c.status === 'email_sent');
          const converted = abandonedCarts.filter(c => c.status === 'converted');
          const total = abandoned.length + converted.length;
          const recoveryRate = total > 0 ? Math.round((converted.length / total) * 100) : 0;
          const recoveredRevenue = converted.reduce((sum, c) => sum + (c.total_cents || 0), 0);

          const handleSendReminder = async (cart) => {
            if (sendingReminder) return;
            setSendingReminder(cart.id);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
              const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
              const res = await fetch(`${SUPABASE_URL}/functions/v1/send-abandoned-cart`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
                  'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ cartId: cart.id }),
              });
              const data = await res.json();
              if (data.success || data.skipped) load();
            } catch {
              // silencioso
            } finally {
              setSendingReminder(null);
            }
          };

          const cartStatusVariant = (status) => {
            const map = {
              abandoned: 'warning',
              email_sent: 'info',
              converted: 'success',
              ignored: 'default',
            };
            return map[status] || 'default';
          };

          const cartStatusLabel = (status) => {
            const map = {
              abandoned: 'Pendiente',
              email_sent: 'Email enviado',
              converted: 'Recuperado',
              ignored: 'Ignorado',
            };
            return map[status] || status;
          };

          return (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <AdminStat label="Carritos (7 días)" value={abandoned.length} />
                <AdminStat label="Recuperados" value={converted.length} accent="emerald" />
                <AdminStat label="Tasa recuperación" value={`${recoveryRate}%`} />
                <AdminStat label="Revenue recuperado" value={`$${recoveredRevenue.toLocaleString('es-CL')}`} accent="emerald" />
              </div>

              {/* Tabla */}
              <AdminCard className="p-0 overflow-hidden">
                {abandonedCarts.length === 0 ? (
                  <p className="text-zinc-500 text-sm py-6 text-center">Sin carritos abandonados en los últimos 7 días.</p>
                ) : (
                  <Table>
                    <THead>
                      <TH>Cliente</TH>
                      <TH>Items</TH>
                      <TH>Total</TH>
                      <TH>Hace</TH>
                      <TH>Estado</TH>
                      <TH>Acción</TH>
                    </THead>
                    <tbody>
                      {abandonedCarts.map(cart => {
                        const items = cart.items || [];
                        const hoursAgo = Math.round((Date.now() - new Date(cart.created_at).getTime()) / 3600000);
                        const timeLabel = hoursAgo < 24 ? `${hoursAgo}h` : `${Math.round(hoursAgo / 24)}d`;
                        const canSend = cart.status === 'abandoned' && !cart.reminder_sent_at;
                        return (
                          <TR key={cart.id}>
                            <TD>
                              <p className="font-medium text-white truncate max-w-[150px]">{cart.customer_name || '—'}</p>
                              <p className="text-xs text-zinc-500 truncate max-w-[150px]">{cart.email}</p>
                            </TD>
                            <TD className="max-w-[180px]">
                              <p className="truncate">{items.map(i => i.product_name).join(', ')}</p>
                              <p className="text-xs text-zinc-500">{items.reduce((s, i) => s + i.quantity, 0)} unidad{items.reduce((s, i) => s + i.quantity, 0) !== 1 ? 'es' : ''}</p>
                            </TD>
                            <TD className="font-bold text-white">${cart.total_cents.toLocaleString('es-CL')}</TD>
                            <TD className="whitespace-nowrap">{timeLabel}</TD>
                            <TD>
                              <AdminBadge variant={cartStatusVariant(cart.status)}>
                                {cartStatusLabel(cart.status)}
                              </AdminBadge>
                            </TD>
                            <TD>
                              {canSend ? (
                                <button
                                  onClick={() => handleSendReminder(cart)}
                                  disabled={sendingReminder === cart.id}
                                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                >
                                  {sendingReminder === cart.id ? 'Enviando...' : 'Enviar recordatorio'}
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-500">—</span>
                              )}
                            </TD>
                          </TR>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </AdminCard>
            </div>
          );
        })()}

      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="font-bold text-white">Preview del email</h3>
              <button onClick={() => setShowPreview(false)} className="text-zinc-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <div className="mb-3 bg-zinc-800 rounded-xl px-4 py-2 text-sm">
                <span className="text-zinc-400 font-medium">Asunto: </span>
                <span className="font-bold text-white">{subject}</span>
              </div>
              <iframe
                srcDoc={body}
                title="Preview email"
                className="w-full h-96 border border-zinc-700 rounded-xl"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
