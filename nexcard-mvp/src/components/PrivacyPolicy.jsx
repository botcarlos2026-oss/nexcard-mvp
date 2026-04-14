import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">

        <div className="mb-12">
          <a href="/" className="text-emerald-400 text-sm hover:underline">← Volver</a>
          <h1 className="text-4xl font-black mt-6 mb-2">Política de Privacidad</h1>
          <p className="text-zinc-400 text-sm">Última actualización: Abril 2026</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-zinc-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-black text-white mb-3">1. Quiénes somos</h2>
            <p>NexCard es un servicio de tarjetas de visita digitales NFC operado en Chile. Nuestra plataforma está disponible en <a href="https://nexcard.cl" className="text-emerald-400">nexcard.cl</a>.</p>
            <p className="mt-2">Para consultas sobre privacidad puedes contactarnos en <a href="mailto:hola@nexcard.cl" className="text-emerald-400">hola@nexcard.cl</a> o por <a href="https://wa.me/56993183021" className="text-emerald-400">WhatsApp</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">2. Qué datos recopilamos</h2>
            <p>Recopilamos los siguientes datos personales según el servicio que uses:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong className="text-white">Lista de espera:</strong> Email cuando te registras para ser notificado del lanzamiento.</li>
              <li><strong className="text-white">Órdenes de compra:</strong> Nombre completo, email, teléfono y dirección de despacho.</li>
              <li><strong className="text-white">Perfil digital:</strong> Información que tú mismo ingresas (nombre, cargo, empresa, redes sociales, etc.).</li>
              <li><strong className="text-white">Datos de uso:</strong> Cantidad de veces que se visualiza tu perfil (sin identificar a los visitantes).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">3. Para qué usamos tus datos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Procesar y despachar tu pedido.</li>
              <li>Enviarte confirmaciones y actualizaciones de tu orden.</li>
              <li>Notificarte sobre el lanzamiento de NexCard si te registraste en la lista de espera.</li>
              <li>Mejorar nuestro servicio.</li>
            </ul>
            <p className="mt-3">No vendemos ni compartimos tus datos personales con terceros con fines comerciales.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">4. Base legal (Ley 19.628)</h2>
            <p>El tratamiento de tus datos se realiza bajo las siguientes bases legales conforme a la Ley N° 19.628 sobre Protección de la Vida Privada de Chile:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong className="text-white">Consentimiento:</strong> Para el envío de comunicaciones de marketing y lista de espera.</li>
              <li><strong className="text-white">Ejecución de contrato:</strong> Para procesar pedidos y entregar el servicio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">5. Tus derechos</h2>
            <p>De acuerdo con la Ley 19.628, tienes derecho a:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong className="text-white">Acceder</strong> a los datos que tenemos sobre ti.</li>
              <li><strong className="text-white">Rectificar</strong> datos incorrectos o desactualizados.</li>
              <li><strong className="text-white">Eliminar</strong> tus datos de nuestra base.</li>
              <li><strong className="text-white">Oponerte</strong> al tratamiento de tus datos.</li>
            </ul>
            <p className="mt-3">Para ejercer cualquiera de estos derechos, escríbenos a <a href="mailto:hola@nexcard.cl" className="text-emerald-400">hola@nexcard.cl</a> o por <a href="https://wa.me/56993183021" className="text-emerald-400">WhatsApp</a> y responderemos en un plazo máximo de 5 días hábiles.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">6. Proveedores de servicio</h2>
            <p>Utilizamos los siguientes servicios de terceros para operar la plataforma:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong className="text-white">Supabase</strong> — Almacenamiento de datos (servidores en São Paulo, Brasil).</li>
              <li><strong className="text-white">Vercel</strong> — Hosting de la aplicación.</li>
              <li><strong className="text-white">Resend</strong> — Envío de emails transaccionales.</li>
            </ul>
            <p className="mt-3">Todos estos proveedores operan bajo sus propias políticas de privacidad y ofrecen garantías de seguridad adecuadas.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">7. Seguridad</h2>
            <p>Implementamos medidas técnicas y organizativas para proteger tus datos, incluyendo cifrado SSL/TLS, autenticación segura y control de acceso por roles. Sin embargo, ningún sistema es 100% seguro.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">8. Retención de datos</h2>
            <p>Conservamos tus datos mientras mantengas una relación activa con NexCard o mientras sea necesario para cumplir obligaciones legales. Puedes solicitar la eliminación de tus datos en cualquier momento.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">9. Cambios a esta política</h2>
            <p>Podemos actualizar esta política ocasionalmente. Te notificaremos por email si los cambios son significativos. La fecha de última actualización siempre aparece al inicio de este documento.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">10. Contacto</h2>
            <p>Para cualquier consulta sobre privacidad:</p>
            <ul className="list-none mt-3 space-y-1">
              <li>📧 <a href="mailto:hola@nexcard.cl" className="text-emerald-400">hola@nexcard.cl</a></li>
              <li>💬 <a href="https://wa.me/56993183021" className="text-emerald-400">WhatsApp +56 9 9318 3021</a></li>
              <li>🌐 <a href="https://nexcard.cl" className="text-emerald-400">nexcard.cl</a></li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
