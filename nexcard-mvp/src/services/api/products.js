export function createProductsApi({ supabase, hasSupabase }) {
  const getProducts = async () => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('price_cents', { ascending: true });
    if (error) throw new Error(error.message || 'Error al cargar productos');
    return data || [];
  };

  return {
    getProducts,
  };
}
