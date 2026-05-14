const KPI_DISABLED_ERROR = 'KPIs requieren Supabase';

export const createKpisApi = ({ supabase, hasSupabase }) => ({
  getKpiMonthlyRevenue: async ({ months = 12 } = {}) => {
    if (!hasSupabase) throw new Error(KPI_DISABLED_ERROR);
    const { data, error } = await supabase
      .from('kpi_monthly_revenue')
      .select('*')
      .limit(months);
    if (error) throw new Error(error.message);
    return data || [];
  },

  getKpiFunnel: async () => {
    if (!hasSupabase) throw new Error(KPI_DISABLED_ERROR);
    const { data, error } = await supabase
      .from('kpi_funnel')
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  getKpiTopProducts: async ({ limit = 10 } = {}) => {
    if (!hasSupabase) throw new Error(KPI_DISABLED_ERROR);
    const { data, error } = await supabase
      .from('kpi_top_products')
      .select('*')
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  getKpiCohorts: async ({ months = 12 } = {}) => {
    if (!hasSupabase) throw new Error(KPI_DISABLED_ERROR);
    const { data, error } = await supabase
      .from('kpi_cohorts')
      .select('*')
      .limit(months);
    if (error) throw new Error(error.message);
    return data || [];
  },
});
