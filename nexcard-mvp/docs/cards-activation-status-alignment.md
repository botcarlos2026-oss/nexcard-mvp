# NexCard — Alignment of `cards.activation_status`

## Context
During validation of `revoke_card()` in Route 2.3, the original constraint on `cards.activation_status` blocked the new lifecycle state.

Original allowed values:
- `unassigned`
- `assigned`
- `activated`
- `disabled`

But the new lifecycle helpers and NFC model already require:
- `revoked`
- eventually `lost`

---

# Why this change was necessary
If `status` can move to `revoked` but `activation_status` cannot, the model becomes semantically inconsistent.

That would create two problems:
1. helpers such as `revoke_card()` fail at runtime
2. `status` and `activation_status` start describing different realities

---

# Decision
The constraint was expanded to allow:
- `unassigned`
- `assigned`
- `activated`
- `disabled`
- `revoked`
- `lost`

This aligns the legacy activation field with the more mature lifecycle model now used by NFC/cards.

---

# Operational impact
After this change:
- `revoke_card()` validated successfully
- `card_events` captured `revoked`
- `audit_log` captured `card_revoke`
- card lifecycle is now more consistent with real operational needs

---

# Recommendation
In future iterations, consider whether `activation_status` should continue to exist as a separate concept or whether `status` becomes the single source of truth.

For now, keeping both is acceptable as long as they remain aligned.
