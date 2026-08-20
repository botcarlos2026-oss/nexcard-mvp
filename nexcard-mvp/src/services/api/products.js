const CONTROLLED_TEST_SKUS = new Set(['NEXCARD-MP-TEST-1000']);

export const isPrelaunchTestProduct = (product = {}) => (
  CONTROLLED_TEST_SKUS.has(product.sku)
  || product.metadata?.test_product === true
  || product.metadata?.remove_after_validation === true
);

export const filterPublicProducts = (products = [], { includeTestProducts = false } = {}) => {
  if (includeTestProducts) return products || [];
  return (products || []).filter((product) => !isPrelaunchTestProduct(product));
};

export function createProductsApi({ supabase, hasSupabase, request }) {
  const getProducts = async (options = {}) => {
    if (!hasSupabase) {
      const products = await request('/products');
      return filterPublicProducts(products || [], options);
    }
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('price_cents', { ascending: true });
    if (error) throw new Error(error.message || 'Error al cargar productos');
    return filterPublicProducts(data || [], options);
  };

  return {
    getProducts,
  };
}
