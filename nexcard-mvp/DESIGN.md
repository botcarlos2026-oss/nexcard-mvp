---
name: NexCard
description: Digital business cards linked to physical NFC — dark, confident, precise.
colors:
  brand: "#10B981"
  brand-hover: "#059669"
  brand-dim: "rgba(16, 185, 129, 0.12)"
  surface-0: "#09090B"
  surface-1: "#18181B"
  surface-2: "#27272A"
  surface-3: "#3F3F46"
  text-1: "#FAFAFA"
  text-2: "#A1A1AA"
  text-3: "#71717A"
typography:
  heading:
    fontFamily: "Syne, sans-serif"
    fontWeight: 800
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontWeight: 400
  mono:
    fontFamily: "JetBrains Mono, monospace"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  sm: "0.75rem"
  md: "1.25rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#052e23"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-secondary:
    backgroundColor: "#27272a"
    textColor: "{colors.text-1}"
    rounded: "{rounded.lg}"
  card:
    backgroundColor: "{colors.surface-1}"
    rounded: "{rounded.xl}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.md}"
---

# Design System: NexCard

## Overview

**Creative North Star: "The Studio Ledger"**

NexCard's visual system reads like a professional studio ledger held at night: a dark, precise working surface where every entry is legible and every action is deliberate. Zinc-scale surfaces (near-black to charcoal) provide a calm, low-noise backdrop; a single emerald signal marks what is live, actionable, or confirmed. Syne's geometric weight gives headings authority without decoration; DM Sans carries the working text with clarity. The system does not perform craft through ornament — it earns trust through consistency, restraint, and legible state.

This applies equally to the commercial surface (landing, checkout, public profile) and the admin backoffice (dashboard, orders, inventory, CRM): both are studio tools, not separate visual worlds. The card-to-profile product idea — a physical trigger pointing at an editable digital record — is echoed in the system's own posture: static dark surfaces, one living signal color.

**Key Characteristics:**
- Near-black zinc surfaces with a single emerald accent, never decorative
- Syne for headings (weight, geometry), DM Sans for body (clarity, neutrality)
- Generous rounded corners (lg/xl/2xl) read as confident, not playful
- Motion is fast and purposeful (150–300ms), never ornamental
- Same visual discipline applies to public-facing and internal/admin surfaces alike

## Colors

A near-monochrome dark palette (zinc scale) with exactly one living accent color.

### Primary
- **Studio Emerald** (`#10B981` / `--color-brand`): the one signal color in the system. Used only for primary actions (buttons, active/selected states, success states, focus rings, links). Never used decoratively, in large fills, or as a background wash.
- **Studio Emerald, Hover** (`#059669` / `--color-brand-hover`): hover/pressed state of the primary signal.
- **Studio Emerald, Dim** (`rgba(16, 185, 129, 0.12)` / `--color-brand-dim`): the accent at rest-adjacent intensity — subtle backgrounds behind active/selected rows, badges, or tags where the accent must register without commanding the eye.

### Neutral
- **Ledger Black** (`#09090B` / `--color-surface-0`): base page background, the darkest surface.
- **Ledger Charcoal** (`#18181B` / `--color-surface-1`): primary card/panel surface, one step up from the page.
- **Ledger Slate** (`#27272A` / `--color-surface-2`): secondary surface — nested panels, secondary buttons, input fields on darker contexts.
- **Ledger Ash** (`#3F3F46` / `--color-surface-3`): borders, dividers, and the highest-contrast neutral surface (hover states on secondary buttons).
- **Ledger White** (`#FAFAFA` / `--color-text-1`): primary text, headings, high-emphasis labels.
- **Ledger Grey** (`#A1A1AA` / `--color-text-2`): secondary text, supporting copy, placeholders.
- **Ledger Dust** (`#71717A` / `--color-text-3`): tertiary text — timestamps, metadata, disabled-adjacent labels.

### Profile Light Mode (scoped exception)

The public profile surface (`NexCardProfile.jsx`, `/:slug`) is the one place in the product where the visitor sees a light theme: each profile owner can toggle `is_dark_mode`, and non-owner visitors see whatever the owner chose. This is a per-profile personalization setting, not a product-wide light/dark toggle — every other surface (landing, checkout, admin) stays dark-only per the Studio Ledger world above.

- **Light page background** (`#F9FAFB` / Tailwind `gray-50`): replaces Ledger Black as the page surface only in light mode.
- **Light card surface** (`#FFFFFF` / `white`): replaces Ledger Charcoal for cards/panels in light mode.
- **Light border** (`#F4F4F5` / `zinc-100`, `#E4E4E7` / `zinc-200`): replaces the dark borders.
- **Light text** (`#18181B` / `zinc-900` primary, `#A1A1AA` / `zinc-400` secondary): replaces Ledger White/Grey.
- The Studio Emerald accent, and the profile owner's own `theme_color` (used for the avatar ring, primary CTA, and header banner), stay identical in both modes — only the neutral scale flips.

### Named Rules
**The One Voice Rule.** Studio Emerald is the only accent in the system. It appears only on primary buttons, active/selected states, success confirmations, and focus rings — never as a decorative fill, gradient, icon-only flourish, or background wash. Its rarity is what makes it legible as "this is live" or "this is actionable."

## Typography

**Display/Heading Font:** Syne (with sans-serif fallback)
**Body Font:** DM Sans (with system-ui, sans-serif fallback)
**Label/Mono Font:** JetBrains Mono (with monospace fallback)

**Character:** Syne's geometric, high-weight forms give headings structural authority — confident, not decorative. DM Sans stays neutral and highly legible for the working text of forms, tables, and dense admin views. JetBrains Mono is reserved for values that are literally data: codes, tokens, order IDs, tracking numbers.

### Hierarchy
- **Heading** (weight 800, Syne): page titles, section headers, hero copy on public surfaces.
- **Body** (weight 400, DM Sans): default UI text, form labels, table content, paragraph copy.
- **Label** (DM Sans, small size, often `text-2`/`text-3`): metadata, captions, helper text under inputs.
- **Mono** (JetBrains Mono): order IDs, tracking codes, technical identifiers — anywhere a value must read as exact data, not prose.

## Layout

Dense, panel-based layout on admin surfaces (dashboard, orders, inventory, CRM): cards and tables sit on `surface-0`/`surface-1` with consistent internal padding (`p-5`/`p-6` observed). Public/commercial surfaces (landing, pricing, checkout) use wider vertical rhythm and staggered entrance animation (`fadeInUp`/`fadeInDown`, 80ms stepped delays) to sequence hero and pricing content on load. Responsive behavior favors stacking over hiding; hover-specific treatments are gated behind `@media (hover: hover) and (pointer: fine)` so touch devices never get a stuck hover state.

## Elevation & Depth

Primarily flat with tonal layering (zinc-0 → zinc-3) doing most of the depth work, not shadows. Shadows are used sparingly and only as a structural signal on the primary button and on hover states — never ambient decoration on static surfaces.

### Shadow Vocabulary
- **Primary button rest** (`box-shadow: 0 10px 24px rgba(4, 120, 87, 0.22)`): grounds the one interactive element that most needs to read as "press me."
- **Primary button hover** (`box-shadow: 0 12px 28px rgba(4, 120, 87, 0.28)`): slightly deepens on hover, paired with a 1px lift (`translateY(-1px)`).
- **Secondary button** (`box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18)`): neutral, low-emphasis shadow — present but quiet.

### Named Rules
**The Flat-By-Default Rule.** Cards, panels, and static surfaces carry no shadow; depth comes from surface tone (`surface-0` through `surface-3`) and borders. Shadow appears only on interactive elements as a response to state (rest/hover on buttons and pricing cards), never on a surface at rest.

## Shapes

Corners are consistently rounded and generous rather than sharp or barely-rounded: `rounded-lg` (12px) and `rounded-xl`/`rounded-2xl` (16–24px) dominate across buttons, cards, and inputs, with `rounded-full` reserved for avatars, pills, and icon buttons. This reads as confident and modern rather than playful — the radius is large enough to soften the dark palette without softening the product's precision. Borders are thin (1px) and low-contrast (`zinc-800`/`zinc-700`), used to separate surfaces of similar tone rather than to decorate.

## Components

Buttons, cards, and inputs share one posture: confident and direct. Borders are deliberate, radii are generous, and the one accent color is reserved for what the user should act on next.

### Buttons
- **Shape:** `rounded-lg` to `rounded-xl` (12–16px), never sharp corners.
- **Primary:** Studio Emerald background (`#10B981`), dark text (`#052e23`) for contrast, thin light-emerald border (`rgba(167, 243, 208, 0.38)`), grounded shadow. This is the only button style carrying the accent as a fill.
- **Hover/Focus:** primary darkens to hover emerald (`#059669`), lifts 1px, deepens its shadow; all interactive elements get a 2px emerald outline on `:focus-visible` with 3px offset, independent of pointer hover.
- **Secondary:** `zinc-800`/`zinc-900` fill, `zinc-700`/`zinc-800` border, white text — reads as "available action," not "the action."
- **Ghost:** transparent at rest, emerald-tinted transparent background (`rgba(16, 185, 129, 0.08)`) on hover — used for tertiary/dismissive actions.
- **Link:** no fill, emerald text, underline on hover only.
- **Press feedback:** every interactive button scales to `0.97`–`0.985` on `:active` — a consistent tactile confirmation across the whole button family.

### Cards / Containers
- **Corner Style:** `rounded-2xl` (24px) is the standard for admin cards and panels.
- **Background:** `surface-1`/`zinc-900` on a `surface-0`/near-black page — one clear tonal step, never a shadow-only separation.
- **Shadow Strategy:** none at rest (see Flat-By-Default Rule); pricing cards on the public surface lift on hover (`translateY(-4px)`, emerald border) as their one piece of interactive depth.
- **Border:** 1px, `zinc-800`, low-contrast — present to define edges, not to decorate.
- **Internal Padding:** `p-5` to `p-6` (20–24px) is standard for admin cards.

### Inputs / Fields
- **Style:** `surface-1`/`surface-2` background, 1px `zinc-800`/`zinc-700` border, `rounded-lg` to `rounded-2xl` depending on context (dense admin forms use `lg`; prominent single-field flows like checkout use `2xl`).
- **Focus:** border shifts to Studio Emerald (`#10B981`), often paired with a 1px emerald ring — no glow, no shadow bloom.
- **Placeholder:** `zinc-500`/`text-3`, clearly de-emphasized from entered text.

### Navigation
- Admin navigation (`AdminNav`) runs on the same dark surface scale as the rest of the backoffice — no separate "chrome" treatment. Active/current items get the emerald signal (text or underline), inactive items sit at `text-2`.

## Do's and Don'ts

### Do:
- **Do** treat public and admin surfaces as one visual system — same tokens, same discipline, no "internal tools get less polish" exception.
- **Do** reserve Studio Emerald for primary actions, active/selected states, and success confirmations only (The One Voice Rule).
- **Do** use tonal layering (`surface-0` → `surface-3`) for depth on static elements; reach for shadow only on interactive state changes.
- **Do** use generous, consistent radii (`lg`/`xl`/`2xl`) — the softness is part of the system's confidence.
- **Do** gate hover-only treatments behind `(hover: hover) and (pointer: fine)` so touch devices don't get stuck hover states.

### Don't:
- **Don't** use Studio Emerald as a decorative fill, gradient, background wash, or icon-only accent — it must always mean "act here" or "this succeeded."
- **Don't** add shadows to static/resting surfaces — depth comes from tone and borders, not ambient shadow.
- **Don't** introduce a second accent color; the system is deliberately one-signal.
- **Don't** downgrade admin/backoffice visual quality relative to public-facing surfaces — they share one design system, not a "good enough for internal" fallback.
