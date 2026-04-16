// ============================================================
// Email templates NexCard
// Diseño: fondo #09090B, verde esmeralda #10B981
// Cumplimiento Ley 19.628 Chile — footer legal en todos
// ============================================================

const BASE_STYLES = `
  font-family:sans-serif;
  background:#09090B;
  margin:0;
  padding:20px;
`;

const legalFooter = (email) => `
  <div style="margin-top:40px;padding-top:20px;border-top:1px solid #27272a;text-align:center">
    <p style="margin:0 0 6px;color:#71717a;font-size:12px">
      Este email fue enviado por <strong style="color:#a1a1aa">NexCard</strong> ·
      <a href="https://nexcard.cl" style="color:#10B981;text-decoration:none">nexcard.cl</a>
    </p>
    <p style="margin:0 0 6px;color:#71717a;font-size:12px">
      Lo recibes porque compraste o te registraste en NexCard.
    </p>
    <p style="margin:0;font-size:12px">
      <a href="https://nexcard.cl/baja?email=${encodeURIComponent(email)}"
         style="color:#52525b;text-decoration:underline">
        Cancelar suscripción
      </a>
    </p>
  </div>
`;

const wrapper = (content, email) => `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BASE_STYLES}">
  <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:20px;overflow:hidden;border:1px solid #27272a">
    <div style="background:#09090B;padding:28px 32px;border-bottom:1px solid #27272a">
      <h1 style="color:white;margin:0;font-size:26px;font-weight:900;letter-spacing:-0.5px">
        Nex<span style="color:#10B981">Card</span>
      </h1>
    </div>
    <div style="padding:32px">
      ${content}
      ${legalFooter(email)}
    </div>
  </div>
</body>
</html>`;

// ============================================================
// 1. templateShipping — "Tu pedido fue despachado"
// ============================================================
export function templateShipping(order, trackingNumber) {
  const email = order?.customer_email || '';
  const content = `
    <h2 style="color:white;font-size:22px;font-weight:900;margin:0 0 8px">
      ¡Tu pedido está en camino! 🚀
    </h2>
    <p style="color:#a1a1aa;margin:0 0 24px;font-size:15px">
      Hola ${order?.customer_name || 'Cliente'}, tu NexCard fue despachada y pronto llegará a ti.
    </p>

    ${trackingNumber ? `
    <div style="background:#09090B;border-radius:14px;padding:20px;margin-bottom:24px;border:1px solid #27272a">
      <p style="margin:0 0 4px;font-size:11px;color:#71717a;font-weight:700;text-transform:uppercase;letter-spacing:1px">
        Número de seguimiento
      </p>
      <p style="margin:0;font-size:18px;font-weight:900;color:#10B981;font-family:monospace">
        ${trackingNumber}
      </p>
    </div>` : ''}

    <div style="background:#052e16;border-radius:14px;padding:20px;margin-bottom:24px;border:1px solid #166534">
      <p style="margin:0;color:#bbf7d0;font-size:14px">
        <strong>¿Qué sigue?</strong><br>
        En 24–72 horas hábiles recibirás tu NexCard. Puedes rastrear tu pedido en cualquier momento.
      </p>
    </div>

    ${order?.id ? `
    <div style="text-align:center;margin-top:24px">
      <a href="https://nexcard.cl/seguimiento/${order.id}"
         style="display:inline-block;background:#10B981;color:white;font-weight:900;font-size:14px;padding:14px 28px;border-radius:14px;text-decoration:none">
        Rastrear pedido →
      </a>
    </div>` : ''}
  `;
  return wrapper(content, email);
}

// ============================================================
// 2. templateFollowup — "¿Cómo te fue con tu NexCard?"
// ============================================================
export function templateFollowup(order) {
  const email = order?.customer_email || '';
  const content = `
    <h2 style="color:white;font-size:22px;font-weight:900;margin:0 0 8px">
      ¿Cómo va tu NexCard? 💬
    </h2>
    <p style="color:#a1a1aa;margin:0 0 24px;font-size:15px">
      Hola ${order?.customer_name || 'Cliente'}, ya pasaron 15 días desde que recibiste tu NexCard. Nos encantaría saber tu experiencia.
    </p>

    <div style="background:#09090B;border-radius:14px;padding:20px;margin-bottom:24px;border:1px solid #27272a">
      <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.6">
        ¿Estás compartiendo tu perfil? ¿Has recibido contactos nuevos?<br>
        Tu feedback nos ayuda a mejorar NexCard para todos.
      </p>
    </div>

    <div style="text-align:center;margin-top:24px">
      <a href="https://wa.me/56993183021?text=Hola%2C%20tengo%20feedback%20sobre%20mi%20NexCard"
         style="display:inline-block;background:#18181b;border:2px solid #10B981;color:#10B981;font-weight:900;font-size:14px;padding:14px 28px;border-radius:14px;text-decoration:none">
        Enviar feedback por WhatsApp
      </a>
    </div>
  `;
  return wrapper(content, email);
}

// ============================================================
// 3. templateUpsell — "Agrega más tarjetas con 10% descuento"
// ============================================================
export function templateUpsell(order) {
  const email = order?.customer_email || '';
  const content = `
    <h2 style="color:white;font-size:22px;font-weight:900;margin:0 0 8px">
      10% descuento en tu próxima NexCard 🎁
    </h2>
    <p style="color:#a1a1aa;margin:0 0 24px;font-size:15px">
      Hola ${order?.customer_name || 'Cliente'}, como cliente NexCard tienes un descuento exclusivo para agregar más tarjetas.
    </p>

    <div style="background:#09090B;border:2px solid #10B981;border-radius:14px;padding:24px;margin-bottom:24px;text-align:center">
      <p style="margin:0 0 4px;font-size:11px;color:#71717a;font-weight:700;text-transform:uppercase;letter-spacing:1px">
        Tu descuento exclusivo
      </p>
      <p style="margin:0;font-size:36px;font-weight:900;color:#10B981">10% OFF</p>
      <p style="margin:8px 0 0;color:#71717a;font-size:12px">Válido por 7 días</p>
    </div>

    <div style="background:#052e16;border-radius:14px;padding:16px;margin-bottom:24px;border:1px solid #166534">
      <p style="margin:0;color:#bbf7d0;font-size:13px">
        Ideal para equipos, socios de negocio o como regalo corporativo.
      </p>
    </div>

    <div style="text-align:center">
      <a href="https://nexcard.cl/preview"
         style="display:inline-block;background:#10B981;color:white;font-weight:900;font-size:14px;padding:14px 28px;border-radius:14px;text-decoration:none">
        Comprar otra NexCard →
      </a>
    </div>
  `;
  return wrapper(content, email);
}

// ============================================================
// 4. templateWaitlistLaunch — "¡NexCard ya está disponible!"
// ============================================================
export function templateWaitlistLaunch(email) {
  const content = `
    <h2 style="color:white;font-size:22px;font-weight:900;margin:0 0 8px">
      ¡NexCard ya está disponible! 🎉
    </h2>
    <p style="color:#a1a1aa;margin:0 0 24px;font-size:15px">
      Te registraste en nuestra lista de espera y el momento llegó. NexCard ya está disponible para todos.
    </p>

    <div style="background:#09090B;border-radius:14px;padding:20px;margin-bottom:24px;border:1px solid #27272a">
      <p style="margin:0 0 12px;color:white;font-weight:900;font-size:15px">¿Qué incluye tu NexCard?</p>
      <ul style="margin:0;padding-left:20px;color:#a1a1aa;font-size:14px;line-height:2">
        <li>Perfil digital personalizado</li>
        <li>Tecnología NFC — comparte con un toque</li>
        <li>QR incluido para compatibilidad total</li>
        <li>Links ilimitados a redes sociales</li>
      </ul>
    </div>

    <div style="background:#052e16;border:1px solid #166534;border-radius:14px;padding:16px;margin-bottom:24px;text-align:center">
      <p style="margin:0;color:#bbf7d0;font-size:14px;font-weight:700">
        Como persona en lista de espera, eres de las primeras en acceder.
      </p>
    </div>

    <div style="text-align:center">
      <a href="https://nexcard.cl/preview"
         style="display:inline-block;background:#10B981;color:white;font-weight:900;font-size:15px;padding:16px 32px;border-radius:14px;text-decoration:none">
        Conseguir mi NexCard →
      </a>
    </div>
  `;
  return wrapper(content, email);
}
