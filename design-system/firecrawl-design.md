---
name: design-system-firecrawl
description: Creates implementation-ready design-system guidance with tokens, component behavior, and accessibility standards. Use when creating or updating UI rules, component specifications, or design-system documentation for Firecrawl.
---

<!-- TYPEUI_SH_MANAGED_START -->

# Firecrawl

## Mission
Deliver implementation-ready design-system guidance for Firecrawl that can be applied consistently across marketing site interfaces, with token-driven UI optimized for consistency, accessibility, and fast delivery.

## Brand
- Product/brand: Firecrawl
- URL: https://www.firecrawl.dev/
- Audience: developers and technical teams
- Product surface: marketing site

## Style Foundations
- Visual style: structured, tokenized, content-first, accessible, implementation-first
- Main font: `font.family.primary=suisse`, `font.family.stack=suisse, suisse Fallback, ui-sans-serif, system-ui, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji`, `font.size.base=16px`, `font.weight.base=400`, `font.lineHeight.base=24px`
- Typography scale: `font.size.xs=12px`, `font.size.sm=13px`, `font.size.md=14px`, `font.size.lg=15px`, `font.size.xl=16px`, `font.size.2xl=40px`, `font.size.3xl=52px`, `font.size.4xl=60px`

### Color Palette
| Token | Value |
|---|---|
| `color.text.primary` | `color(display-p3 0.14902 0.14902 0.14902)` |
| `color.text.secondary` | `color(display-p3 0.14902 0.14902 0.14902 / 0.721569)` |
| `color.text.tertiary` | `color(display-p3 0.980392 0.364706 0.098039)` |
| `color.text.inverse` | `color(display-p3 1 1 1)` |
| `color.surface.base` | `#000000` |
| `color.surface.muted` | `color(display-p3 0.9816 0.3634 0.0984)` |
| `color.surface.raised` | `color(display-p3 0.976471 0.976471 0.976471)` |
| `color.surface.strong` | `color(display-p3 0 0 0 / 0.039216)` |
| `color.border.default` | `#e5e7eb` |
| `color.border.muted` | `color(display-p3 0.929412 0.929412 0.929412)` |

### Spacing Scale
| Token | Value |
|---|---|
| `space.1` | `1px` |
| `space.2` | `4px` |
| `space.3` | `6px` |
| `space.4` | `8px` |
| `space.5` | `10px` |
| `space.6` | `12px` |
| `space.7` | `16px` |
| `space.8` | `20px` |

### Radius / Shadow / Motion
| Category | Token | Value |
|---|---|---|
| Radius | `radius.xs` | `6px` |
| Radius | `radius.sm` | `8px` |
| Radius | `radius.md` | `10px` |
| Radius | `radius.lg` | `20px` |
| Radius | `radius.xl` | `999px` |
| Shadow | `shadow.1` | `color(display-p3 0.9804 0.1127 0.098 / 0.2) 0px -6px 12px 0px inset, color(display-p3 0.9804 0.3647 0.098 / 0.12) 0px 2px 4px 0px, color(display-p3 0.9804 0.3647 0.098 / 0.12) 0px 1px 1px 0px, color(display-p3 0.9804 0.3647 0.098 / 0.16) 0px 0.5px 0.5px 0px, color(display-p3 0.9804 0.3647 0.098 / 0.2) 0px 0.25px 0.25px 0px` |
| Motion | `motion.duration.instant` | `50ms` |
| Motion | `motion.duration.fast` | `150ms` |
| Motion | `motion.duration.normal` | `200ms` |

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required
- Focus-visible rules required
- Contrast constraints required — no low-contrast text or hidden focus indicators
- Every accessibility rule must be testable in implementation

## Writing Tone
Concise, confident, implementation-focused.

## Rules: Do
- Use semantic tokens, not raw hex values, in component guidance.
- Every component must define states for default, hover, focus-visible, active, disabled, loading, and error.
- Component behavior must document responsive and edge-case handling.
- Interactive components must document keyboard, pointer, and touch behavior.
- Accessibility acceptance criteria must be testable in implementation.
- Prefer system consistency over local visual exceptions.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.
- Do not ship component guidance without explicit state rules.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and semantic tokens.
3. Define component anatomy, variants, interactions, and state behavior.
4. Add accessibility acceptance criteria with pass/fail checks.
5. Add anti-patterns, migration notes, and edge-case handling.
6. End with a QA checklist.

## Required Output Structure
- Context and goals
- Design tokens and foundations
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.
- Known page component density: links (91), buttons (73), navigation (3), inputs (1).

### Component States (Required for Every Component)
| State | Requirement |
|---|---|
| Default | Resting appearance using semantic tokens |
| Hover | Visual feedback on pointer hover |
| Focus-visible | Visible focus ring matching `color.text.tertiary` |
| Active | Pressed / activated appearance |
| Disabled | Reduced opacity, no pointer events |
| Loading | Spinner or skeleton placeholder |
| Error | Red border or error text with `color.text.tertiary` background |

## Accessibility Requirements (Testable)
| Criteria | Pass | Fail |
|---|---|---|
| Focus-visible ring visible on all interactive elements | All keyboard-focusable elements show a 2px+ ring | Ring is missing or clipped |
| Color contrast ≥ 4.5:1 for body text | Primary text on raised surface passes | Contrast ratio below threshold |
| Touch targets ≥ 44×44px | All interactive elements meet minimum size | Target is smaller than 44px |
| `aria-label` on icon-only buttons | Every icon button has a descriptive label | Button has no accessible name |

## Content And Tone Standards
- Use concrete, action-oriented language. "Scrape a page", "Extract structured data", "Monitor your crawl status".
- Avoid: "revolutionary data extraction", "next-gen crawling", "unlock limitless web data".
- Good: "Firecrawl turns websites into AI-ready data in one API call."
- Good: "Supports crawling, scraping, and extraction with a single endpoint."

## Anti-Patterns And Prohibited Implementations
- Do not use raw hex values when a semantic Firecrawl token exists.
- Do not ship interactive components without all required states (default, hover, focus-visible, active, disabled, loading, error).
- Do not use one-off border-radius or spacing values outside the token scale.
- Do not hide focus indicators — `outline: none` must be paired with `focus-visible: outline`.
- Do not mix font families across sections (primary stack only).
- Do not ship ambiguous icon-only buttons without `aria-label`.

## QA Checklist
- All surfaces use `color.surface.*` tokens — no raw whites or grays.
- All text colors use `color.text.*` tokens — contrast verified against surfaces.
- All spacing uses the defined `space.*` scale — no arbitrary pixel values.
- Every component documents all 7 states (default, hover, focus-visible, active, disabled, loading, error).
- All icon-only buttons have `aria-label`.
- Touch targets are ≥ 44×44px on mobile.
- Focus-visible ring is visible and ≥ 2px wide on all interactive elements.
- Motion durations use `motion.duration.*` tokens.

<!-- TYPEUI_SH_MANAGED_END -->
