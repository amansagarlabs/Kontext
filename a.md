# kontext — UI continuation notes

## Current direction

The homepage is moving toward a Fumadocs-style documentation product surface:

- paper-like light theme with a true black documentation theme
- compact sticky navigation with search, theme toggle, and mobile sheet
- orange/yellow dither canvases as the visual signature
- rounded 16–18px panels with thin neutral borders
- content-first typography using Geist and Geist Mono
- short, inspectable copy instead of dense marketing paragraphs

## Files changed so far

- `app/page.tsx` — homepage composition, hero canvas, dither showcase cards, section layout
- `components/ui/fumadocs-nav.tsx` — Fumadocs-inspired responsive navigation
- `app/layout.tsx` — Geist and Geist Mono font setup
- `app/globals.css` — light surface defaults and typography variables
- `components/ui/bento-grid.tsx` — responsive wide/reverse card layouts

## Remaining implementation work

### Completed in the current pass

- Added a keyboard-accessible search palette (`Ctrl/Cmd + K`, `Escape`, click-away close).
- Added `aria-current` to the primary Product link and focus states to search controls.
- Applied the neutral Fumadocs surface system to trust, platform, workflow, FAQ, CTA, and footer sections.
- Added reusable `DitherShowcase` tones: `orange`, `olive`, and `midnight`.

1. Finish the lower-page pass. Every remaining section should use the same surface system as the hero:
   - light: `#faf9f6` page, `#ffffff` cards, `#dedbd1` borders, `#595c50` text
   - dark: `#0b0b0b` page, `#141512` cards, `rgba(255,255,255,.10)` borders, `#f1f1e8` text
   - accent: `#e76f22` orange and `#f6e879` yellow
2. Convert the developer terminal, FAQ, and trust sections to neutral documentation panels. Keep terminal content dark, but make its outer card match the current theme.
3. Add one reusable `DitherShowcase` variant for orange, olive, and midnight canvases instead of repeating long utility strings.
4. Replace remaining encoding artifacts such as `â€”`, `Â·`, and `Â©` with real punctuation (`—`, `·`, `©`).
5. Add a real search command palette to the navigation button. The current search control is visual only.
6. Add `aria-current` to the active navigation link and preserve focus rings on every icon-only control.
7. Add `prefers-reduced-motion` handling to any new canvas animation and avoid hover effects on touch devices.
8. Test the page at 375px, 768px, 1024px, and 1440px widths in both themes.
9. Run the final checks before committing:

```powershell
npm run lint -- app/page.tsx components/ui/fumadocs-nav.tsx
npx tsc --noEmit
git diff --check
```

## How to keep the UI visually coherent

### Layout

- Use a centered content column between `1160px` and `1400px`.
- Use 20–24px horizontal padding on mobile and 32–40px on desktop.
- Keep section spacing on a 4px scale: `16, 24, 32, 48, 64, 96`.
- Use two-column cards at desktop and stack them at `lg` breakpoint.
- Keep one dominant canvas per visual group; do not add decorative grids behind it.

### Cards and canvases

- Outer radius: `16px` or `18px`.
- Inner radius: `10px` or `12px` so nested corners remain concentric.
- Use a 1px border and a soft, low-spread shadow.
- Dither artwork should be an atmospheric layer. Put readable content in a solid panel above it.
- Keep dither opacity low in light mode and slightly higher in dark mode.

### Typography

- Body: Geist, `14–16px`, line-height `1.5–1.7`.
- Large headings: Geist semibold, negative tracking, `0.95–1.1` line-height.
- Labels and commands: Geist Mono, `10–12px`, uppercase tracking around `.14em`.
- Limit paragraphs to roughly `60–65ch`.
- Use one `h1` per page and maintain sequential heading levels.

### Color behavior

- Never invert the whole page for dark mode.
- Light mode uses warm paper and orange accents.
- Dark mode uses near-black surfaces and yellow accents.
- Text must remain readable without relying on accent color alone.
- Pair status colors with labels, icons, or visible borders.

### Interaction rules

- Buttons need a minimum 44px hit area and visible `focus-visible` rings.
- Use 100–160ms transitions for hover/press states.
- Use `active:scale-[0.97]` only on pressable controls.
- Keep navigation links descriptive: `Product`, `Memory`, `Roadmap`, `Developers`.
- Every icon-only control needs an `aria-label`.

## Recommended next section pattern

```tsx
<section className="border-b border-[#dedbd1] bg-[#faf9f6] dark:border-white/10 dark:bg-[#0b0b0b]">
  <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
    <div className="grid gap-5 lg:grid-cols-2">
      <DitherShowcase className="min-h-[340px] lg:col-span-2">
        {/* one focused visual */}
      </DitherShowcase>
      <article className="rounded-[16px] border border-[#dedbd1] bg-white p-7 dark:border-white/10 dark:bg-[#141512]">
        {/* concise heading, one paragraph, one action */}
      </article>
    </div>
  </div>
</section>
```

The page should feel like a calm documentation system: every panel explains one idea, every visual has a job, and the orange dither texture is reserved for moments that deserve emphasis.
