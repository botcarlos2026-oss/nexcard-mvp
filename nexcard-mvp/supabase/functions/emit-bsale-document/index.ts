import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Si no hay token configurado, saltar silenciosamente
    const bsaleToken = Deno.env.get('BSALE_ACCESS_TOKEN');
    if (!bsaleToken) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'BSALE not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // TODO: implementar cuando se active la cuenta Bsale
    //
    // const { orderId, order } = await req.json();
    //
    // Determinar tipo de documento:
    //   documentTypeId = order.requires_invoice ? 33 : 39
    //   33 = Factura electrónica (requiere RUT + razón social)
    //   39 = Boleta electrónica (usa RUT genérico 66.666.666-6)
    //
    // const clientCode = order.invoice_rut || '66.666.666-6';
    // const totalAmount = order.amount_cents; // CLP directo (no centavos)
    // const netAmount  = Math.round(totalAmount / 1.19);
    // const taxAmount  = totalAmount - netAmount;
    //
    // POST https://api.bsale.io/v1/documents.json
    // Headers: { 'access_token': bsaleToken, 'Content-Type': 'application/json' }
    // Body: {
    //   documentTypeId,
    //   officeId: 1,
    //   emissionDate: Math.floor(Date.now() / 1000),
    //   declare: 1,
    //   client: {
    //     code: clientCode,
    //     name: order.invoice_razon_social || order.customer_name,
    //     email: order.customer_email,
    //   },
    //   details: order.items.map(item => ({
    //     variantId: item.bsale_variant_id,  // requiere bsale_variant_id en tabla products
    //     quantity: item.quantity,
    //     unitValue: Math.round(item.unit_price_cents / 1.19),
    //   })),
    //   payments: [{
    //     paymentTypeId: 1,  // efectivo/transferencia
    //     amount: totalAmount,
    //     recordDate: Math.floor(Date.now() / 1000),
    //   }],
    // }
    //
    // Si la emisión es exitosa, actualizar la orden en Supabase:
    // UPDATE orders SET
    //   bsale_document_id  = response.id,
    //   bsale_document_url = response.urlPdf,
    //   bsale_emitted_at   = NOW()
    // WHERE id = orderId;

    return new Response(
      JSON.stringify({ skipped: true, reason: 'TODO: implement Bsale' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('emit-bsale-document error:', err);
    return new Response(
      JSON.stringify({ skipped: true, reason: err.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
