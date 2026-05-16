import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { buildOrdersAuditQueryString } from './utils';

export function useOrdersDashboardRuntime({
  orders,
  auditFilter,
  testReasonFilter,
  overrideAgeFilter,
  reviewStatusFilter,
  riskFilter,
  setRows,
  setSelectedOrderId,
  setOrderHistory,
}) {
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const loadOrderHistory = useCallback(async (orderId) => {
    try {
      const { supabase } = await import('../../services/supabaseClient');
      const { data } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false })
        .limit(10);
      setOrderHistory((prev) => ({ ...prev, [orderId]: data || [] }));
    } catch (err) {
      console.warn('History error:', err);
    }
  }, [setOrderHistory]);

  useEffect(() => {
    const incoming = orders.filter((order) => new Date(order.created_at) > lastChecked);
    setNewOrdersCount(incoming.length);
    setRows(orders);
  }, [orders, lastChecked, setRows]);

  useEffect(() => {
    const interval = setInterval(async () => {
      setRefreshing(true);
      try {
        const response = await api.getOrders();
        const newOrders = response.orders || [];
        const newCount = newOrders.filter((order) => new Date(order.created_at) > lastChecked).length;
        setNewOrdersCount(newCount);
        setRows(newOrders);
      } catch (err) {
        console.warn('Auto-refresh error:', err);
      } finally {
        setRefreshing(false);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [lastChecked, setRows]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await api.getOrders();
      setRows(response.orders || []);
      setLastChecked(new Date());
      setNewOrdersCount(0);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [setRows]);

  const handleSelectOrder = useCallback((orderId) => {
    setSelectedOrderId(orderId);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', buildOrdersAuditQueryString({
        auditFilter,
        testReasonFilter,
        overrideAgeFilter,
        reviewStatusFilter,
        riskFilter,
        orderId,
      }));
    }
  }, [auditFilter, overrideAgeFilter, reviewStatusFilter, riskFilter, setSelectedOrderId, testReasonFilter]);

  return {
    newOrdersCount,
    lastChecked,
    refreshing,
    loadOrderHistory,
    handleRefresh,
    handleSelectOrder,
    setLastChecked,
    setNewOrdersCount,
  };
}
