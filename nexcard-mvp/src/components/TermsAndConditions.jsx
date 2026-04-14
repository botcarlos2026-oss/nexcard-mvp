import React from 'react';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white px-6 py-16">
      <div className="max-w-3xl mx-auto">

        <div className="mb-12">
          <a href="/" className="text-emerald-400 text-sm hover:underline">← Volver</a>
          <h1 className="text-4xl font-black mt-6 mb-2">Términos y Condiciones</h1>
          <p className="text-zinc-400 text-sm">Última actualización: Abril 2026</p>
        </div>

        <div className="space-y-8 text-zinc-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-black text-white mb-3">1. Aceptación de los términos</h2>
            <p>Al acceder y usar nexcard.cl, aceptas estos Términos y Condiciones en su totalidad. Si no estás de acuerdo con alguna parte, no uses nuestro servicio.</p>
            <p className="mt-2">NexCard es operado por Carlos Alvarez, con domicilio en Chile. Contacto: <a href="mailto:hola@nexcard.cl" className="text-emerald-400">hola@nexcard.cl</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">2. Descripción del servicio</h2>
            <p>NexCard ofrece:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong className="text-white">Tarjetas NFC de perfil digital:</strong> Tarjetas físicas programadas con NFC y QR que redirigen a un perfil digital personalizado.</li>
              <li><strong className="text-white">Google Reviews Card (NexReview):</strong> Tarjetas NFC y QR que redirigen a la página de reseñas de Google del negocio del cliente.</li>
              <li><strong className="text-white">Perfil digital:</strong> Página web personalizada accesible desde la tarjeta NFC.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">3. Proceso de compra</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Los precios están expresados en pesos chilenos (CLP) e incluyen IVA.</li>
              <li>La orden se confirma una vez recibido el pago.</li>
              <li>Recibirás un email de confirmación con el número de orden.</li>
              <li>NexCard se reserva el derecho de cancelar órdenes en casos de error de precio o stock insuficiente, con reembolso total.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">4. Despacho y entrega</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Despachamos a todo Chile mediante Starken o Chilexpress.</li>
              <li>El plazo estimado de entrega es de <strong className="text-white">5 a 10 días hábiles</strong> desde la confirmación del pago.</li>
              <li>El costo de despacho está incluido en el precio del producto.</li>
              <li>Te notificaremos por email con el número de seguimiento cuando tu pedido sea despachado.</li>
              <li>NexCard no se hace responsable por demoras causadas por la empresa de transporte.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">5. Devoluciones y reembolsos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Tienes <strong className="text-white">10 días hábiles</strong> desde la recepción del producto para solicitar una devolución, conforme a la Ley del Consumidor (Ley 19.496).</li>
              <li>El producto debe estar en su estado original, sin uso.</li>
              <li>Para iniciar una devolución escríbenos a <a href="mailto:hola@nexcard.cl" className="text-emerald-400">hola@nexcard.cl</a> o por <a href="https://wa.me/56993183021" className="text-emerald-400">WhatsApp</a>.</li>
              <li>El reembolso se realizará por el mismo medio de pago utilizado en un plazo de 5 días hábiles.</li>
              <li>No se aceptan devoluciones de productos personalizados con el logo del cliente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">6. Uso del perfil digital</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>El usuario es responsable del contenido que publica en su perfil digital.</li>
              <li>Está prohibido publicar contenido ilegal, ofensivo, engañoso o que infrinja derechos de terceros.</li>
              <li>NexCard se reserva el derecho de suspender perfiles que violen estas condiciones sin previo aviso.</li>
              <li>El perfil digital permanece activo mientras la cuenta esté vigente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">7. Propiedad intelectual</h2>
            <p>Todo el contenido de nexcard.cl (diseño, código, textos, imágenes) es propiedad de NexCard. No puedes reproducir, distribuir o modificar ningún contenido sin autorización expresa.</p>
            <p className="mt-2">El usuario mantiene la propiedad de los contenidos que sube a su perfil digital.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">8. Limitación de responsabilidad</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>NexCard no garantiza disponibilidad continua del servicio sin interrupciones.</li>
              <li>No somos responsables por pérdidas indirectas derivadas del uso o imposibilidad de uso del servicio.</li>
              <li>La responsabilidad máxima de NexCard se limita al valor pagado por el producto o servicio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">9. Modificaciones</h2>
            <p>NexCard puede modificar estos términos en cualquier momento. Los cambios se notificarán por email con al menos 7 días de anticipación. El uso continuado del servicio implica aceptación de los nuevos términos.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">10. Ley aplicable</h2>
            <p>Estos términos se rigen por las leyes de la República de Chile. Cualquier disputa se someterá a los tribunales competentes de Santiago de Chile.</p>
            <p className="mt-2">Como consumidor, tienes derecho a acudir al <strong className="text-white">SERNAC</strong> en caso de conflicto: <a href="https://www.sernac.cl" target="_blank" rel="noreferrer" className="text-emerald-400">www.sernac.cl</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-3">11. Contacto</h2>
            <ul className="list-none space-y-1">
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
