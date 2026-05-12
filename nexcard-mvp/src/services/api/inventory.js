export function createInventoryApi({ supabase, hasSupabase }) {
  const getInventorySnapshot = async () => {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('*')
      .order('created_at', { ascending: true });
    const { data: movements } = await supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    return { items: items || [], movements: movements || [] };
  };

  const getInventory = async () => {
    if (!hasSupabase) return { items: [], movements: [] };
    const { data: items, error: itemsError } = await supabase
      .from('inventory_items')
      .select('*')
      .order('created_at', { ascending: true });
    if (itemsError) throw new Error(itemsError.message);
    const { data: movements, error: movementsError } = await supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (movementsError) throw new Error(movementsError.message);
    return { items: items || [], movements: movements || [] };
  };

  const createInventoryMovement = async (payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error: movError } = await supabase
      .from('inventory_movements')
      .insert([payload]);
    if (movError) throw new Error(movError.message);

    const { data: item } = await supabase
      .from('inventory_items')
      .select('stock')
      .eq('id', payload.inventory_item_id)
      .single();
    if (item) {
      let newStock = item.stock;
      if (payload.movement_type === 'in') newStock += Number(payload.quantity);
      else if (payload.movement_type === 'out') newStock -= Number(payload.quantity);
      else if (payload.movement_type === 'adjust') newStock = Number(payload.quantity);
      await supabase
        .from('inventory_items')
        .update({ stock: Math.max(0, newStock) })
        .eq('id', payload.inventory_item_id);
    }

    return getInventorySnapshot();
  };

  const getDispatchConfig = async () => {
    if (!hasSupabase) return [];
    const { data, error } = await supabase
      .from('dispatch_config')
      .select('*, inventory_items(*)')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  };

  const addDispatchConfig = async ({ inventory_item_id, quantity_per_dispatch, description }) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('dispatch_config').insert([{
      inventory_item_id,
      quantity_per_dispatch: Number(quantity_per_dispatch),
      description: description || null,
      active: true,
    }]);
    if (error) throw new Error(error.message);
    const { data } = await supabase
      .from('dispatch_config')
      .select('*, inventory_items(*)')
      .order('created_at', { ascending: true });
    return data || [];
  };

  const deleteDispatchConfig = async (id) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('dispatch_config').delete().eq('id', id);
    if (error) throw new Error(error.message);
    const { data } = await supabase
      .from('dispatch_config')
      .select('*, inventory_items(*)')
      .order('created_at', { ascending: true });
    return data || [];
  };

  const updateInventoryItem = async (itemId, payload) => {
    if (!hasSupabase) throw new Error('Supabase no configurado');
    const { error } = await supabase.from('inventory_items').update(payload).eq('id', itemId);
    if (error) throw new Error(error.message);
    const { data: items } = await supabase.from('inventory_items').select('*').order('created_at', { ascending: true });
    return { items: items || [] };
  };

  const checkLowStock = async () => {
    if (!hasSupabase) return { lowStockItems: [] };
    const { data } = await supabase
      .from('inventory_items')
      .select('sku, name, item, stock, min_stock')
      .gt('min_stock', 0);
    const lowStockItems = (data || []).filter((i) => (i.stock || 0) <= (i.min_stock || 0));
    return { lowStockItems };
  };

  return {
    getInventory,
    createInventoryMovement,
    getDispatchConfig,
    addDispatchConfig,
    deleteDispatchConfig,
    updateInventoryItem,
    checkLowStock,
  };
}
