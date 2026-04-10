-- NexCard - guardrails siguientes recomendados

-- 1. activate_card
-- bloquear doble activación explícitamente y devolver skipped si ya está activa.

-- 2. assign_card
-- bloquear reasignación implícita cuando la card ya tiene profile_id distinto.
-- derivar ese caso a reassign_card(...).

-- 3. revoke_card
-- registrar más contexto en audit_log:
-- previous_status, previous_activation_status, profile_id, linked order if exists.

-- 4. link_order_card
-- opcional siguiente: impedir vincular cards archived/revoked.
