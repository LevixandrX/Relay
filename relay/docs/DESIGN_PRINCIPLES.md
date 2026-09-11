# Relay — Design Principles

## Core Principle

Relay should feel like a real, human-designed product — not an AI-generated interface.

The interface should feel:
- intentional
- calm
- familiar
- slightly opinionated
- functional
- native to its platform
- visually coherent

It should NOT feel:
- AI-generated
- template-driven
- overly polished for the sake of polish
- like an AI SaaS dashboard
- like a collection of popular Dribbble patterns

---

## 1. Avoid "AI-ness"

Do not introduce UI elements simply because they are common in modern AI products.

Before adding any visual element, ask:

> Does this element communicate something useful to the user,
> or does it merely make the interface look more "designed"?

Prefer removing unnecessary visual signals over adding more decoration.

### Common AI-generated patterns to avoid

- unnecessary status badges
- excessive pills
- decorative gradients
- excessive rounded corners
- card-on-card layouts
- excessive glassmorphism
- glowing accents
- generic purple/blue AI aesthetics
- overly prominent active states
- excessive borders and separators
- repetitive icon + label combinations
- unnecessary metadata
- UI elements that exist only to demonstrate a state
- excessive visual hierarchy
- "dashboard-like" layouts where they are not needed

---

## 2. Desktop-Native Behavior

Relay is a desktop application.

The interface should feel like a desktop tool rather than a web-based AI dashboard.

Prefer:
- subtle active states
- restrained navigation
- predictable interaction patterns
- compact controls
- clear hierarchy
- spatial consistency
- platform-familiar behavior

Avoid:
- oversized navigation
- giant buttons
- web/SaaS-style navigation patterns
- overly expressive tabs
- excessive floating UI
- unnecessary badges and status indicators

---

## 3. Navigation

Navigation should be quiet and functional.

Active states should be recognizable without dominating the interface.

Do not use strong background containers, pills, gradients, or excessive contrast merely to indicate the selected item.

The selected state should feel integrated into the navigation rather than placed on top of it.

---

## 4. Information Density

Relay is a workspace, not a marketing page.

Prioritize the user's content over the interface itself.

The UI should recede when the user is working.

Avoid filling empty space with decorative UI.

Empty space is allowed.

---

## 5. Visual Restraint

Do not solve every design problem by adding another component.

When something feels unclear, first consider:

1. Can the hierarchy be improved?
2. Can an existing element communicate this?
3. Can spacing solve the problem?
4. Can typography solve the problem?
5. Does this element need to exist at all?

Only add a new visual element when it provides meaningful interaction or information.

---

## 6. Product Character

Relay should have its own visual character.

Do not blindly reproduce:
- Linear
- Notion
- Arc
- Raycast
- ChatGPT
- Claude
- generic AI SaaS interfaces

These products can be references for interaction quality, but not templates to copy.

---

## 7. Decision Rule

When choosing between two valid designs:

Prefer the one that is:

- simpler
- quieter
- more intentional
- less decorative
- more native
- easier to understand
- less visually trendy

The goal is not to make Relay look impressive.

The goal is to make Relay feel obvious, comfortable and trustworthy.