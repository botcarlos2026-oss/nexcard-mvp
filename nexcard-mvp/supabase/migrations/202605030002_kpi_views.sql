BEGIN;

-- Revenue mensual (usa amount_cents según schema real de orders)
CREATE OR REPLACE VIEW kpi_monthly_revenue AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  count(*)                         AS orders_count,
  sum(amount_cents)                AS revenue_cents,
  avg(amount_cents)                AS avg_ticket_cents
FROM orders
WHERE payment_status = 'paid'
  AND deleted_at IS NULL
GROUP BY 1
ORDER BY 1 DESC;

-- Funnel de conversión (snapshot en tiempo real)
CREATE OR REPLACE VIEW kpi_funnel AS
SELECT
  (SELECT count(DISTINCT email)
     FROM waitlist)                                                                          AS waitlist_signups,
  (SELECT count(*)
     FROM abandoned_carts
    WHERE created_at > NOW() - INTERVAL '30 days')                                          AS abandoned_carts_30d,
  (SELECT count(*)
     FROM orders
    WHERE payment_status = 'paid'
      AND created_at > NOW() - INTERVAL '30 days')                                          AS paid_orders_30d,
  (SELECT count(*)
     FROM orders
    WHERE fulfillment_status = 'delivered'
      AND created_at > NOW() - INTERVAL '30 days')                                          AS delivered_orders_30d;

-- Productos top (usa unit_price_cents según schema real de order_items)
CREATE OR REPLACE VIEW kpi_top_products AS
SELECT
  p.id,
  p.sku,
  p.name,
  count(oi.id)                                         AS times_ordered,
  coalesce(sum(oi.quantity), 0)                        AS units_sold,
  coalesce(sum(oi.quantity * oi.unit_price_cents), 0)  AS revenue_cents
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o
       ON o.id = oi.order_id
      AND o.payment_status = 'paid'
      AND o.deleted_at IS NULL
GROUP BY p.id, p.sku, p.name
ORDER BY revenue_cents DESC NULLS LAST;

-- Cohort analysis: retención por mes de adquisición
CREATE OR REPLACE VIEW kpi_cohorts AS
SELECT
  DATE_TRUNC('month', fo.first_purchase)          AS cohort_month,
  count(DISTINCT fo.customer_email)               AS new_customers,
  count(DISTINCT
    CASE
      WHEN o.created_at > fo.first_purchase
       AND o.payment_status = 'paid'
      THEN o.customer_email
    END
  )                                               AS repeat_customers
FROM (
  SELECT customer_email, MIN(created_at) AS first_purchase
  FROM orders
  WHERE payment_status = 'paid'
    AND deleted_at IS NULL
  GROUP BY customer_email
) fo
LEFT JOIN orders o
       ON o.customer_email = fo.customer_email
      AND o.payment_status = 'paid'
GROUP BY 1
ORDER BY 1 DESC;

COMMIT;
