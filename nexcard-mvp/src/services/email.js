import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.REACT_APP_SENDGRID_API_KEY;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export const sendOrderConfirmationEmail = async (email, orderData) => {
  if (!SENDGRID_API_KEY) {
    console.warn('SendGrid API key not configured, skipping email');
    return;
  }

  try {
    const msg = {
      to: email,
      from: 'noreply@nexcard.com',
      subject: `Orden Confirmada - NexCard #${orderData.id.slice(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10B981;">¡Orden Confirmada!</h1>
          <p>Gracias por tu compra en NexCard.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Detalles de tu Orden</h3>
            <p><strong>Número de Orden:</strong> ${orderData.id}</p>
            <p><strong>Fecha:</strong> ${new Date(orderData.created_at).toLocaleDateString('es-CL')}</p>
            <p><strong>Total:</strong> $${(orderData.amount_cents / 100).toLocaleString('es-CL')} CLP</p>
            <p><strong>Método de Pago:</strong> ${orderData.payment_method}</p>
            <p><strong>Estado de Pago:</strong> ${orderData.payment_status}</p>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Próximos Pasos</h3>
            <ol>
              <li>Recibirás confirmación del pago en las próximas 24 horas</li>
              <li>Nuestro equipo procesará tu orden inmediatamente</li>
              <li>Te enviaremos tracking de envío una vez despachado</li>
              <li>Recibirás tu NexCard en 5-7 días hábiles</li>
            </ol>
          </div>

          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
            Si tienes preguntas, contáctanos en soporte@nexcard.com
          </p>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log('Email enviado a:', email);
    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
};
