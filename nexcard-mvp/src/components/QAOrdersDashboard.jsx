import React from 'react';
import { FlaskConical, ShieldAlert, ArrowRight } from 'lucide-react';
import OrdersDashboard from './OrdersDashboard';
import AdminShell from './AdminShell';
import AdminCard from './ui/AdminCard';
import AdminBadge from './ui/AdminBadge';

export default function QAOrdersDashboard({ orders = [] }) {
  return (
    <AdminShell
      active="qa-orders"
      title="QA / Internal Orders"
      subtitle="Vista dedicada para revisar pedidos internos, pruebas y smoke flows sin contaminar la operación real."
    >
      <div className="mb-6 grid gap-4 xl:grid-cols-[1.4fr,1fr]">
        <AdminCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical size={16} className="text-sky-400" />
                <p className="text-xs uppercase tracking-widest font-bold text-zinc-400">Superficie QA intencional</p>
              </div>
              <p className="text-sm text-zinc-300 max-w-2xl">
                Esta vista arranca filtrada solo a órdenes marcadas como QA/internas. Sirve para validar checkout, pagos,
                fulfillment y activación sin mezclar esas señales con revenue ni embudo comercial real.
              </p>
            </div>
            <AdminBadge variant="info">Solo QA/internas</AdminBadge>
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-white text-sm">Guardrail operativo</p>
              <p className="text-sm text-zinc-400 mt-1">
                El dashboard comercial sigue mirando órdenes reales por defecto. Cuando necesites auditar pruebas, entra aquí.
              </p>
              <a href="/admin" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-300 underline underline-offset-2 hover:text-amber-200">
                Volver al dashboard real <ArrowRight size={12} />
              </a>
            </div>
          </div>
        </AdminCard>
      </div>

      <OrdersDashboard orders={orders} forceAuditFilter="excluded" embedded />
    </AdminShell>
  );
}
