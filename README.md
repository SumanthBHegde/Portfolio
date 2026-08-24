# Sumanth B Hegde — Portfolio

A fast, minimal personal site. Static **Astro**, zero JavaScript by default, with a
single signature interaction ("Signal → Context") that renders as an interactive
`<canvas>` island in the hero.

## Stack

- **Astro** (static output) — ships ~0 KB JS except the hero canvas.
- **Plain CSS** with design tokens (`src/styles/tokens.css`) — dark/light themes, no framework.
- **MDX content collection** (`src/content/work/`) — each project is one file, powering
  both the landing cards and its case-study page.
- Self-hosted fonts (Inter + JetBrains Mono via `@fontsource`), `astro:assets` image
  optimization (AVIF/WebP). No external network calls at runtime.

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # -> dist/
npm run preview    # serve the production build
```

## Content

- Projects: add/edit an `.mdx` file in `src/content/work/` (schema in `src/content.config.ts`).
- Bio / skills / metrics: `src/pages/index.astro`.
- Theme colours: `src/styles/tokens.css`.
- The signature interaction: `src/components/signal.ts` + `Signal.astro`.

## Deploy

Push to GitHub and import into **Vercel** (zero-config for Astro). Update `site`
in `astro.config.mjs` to the production domain before deploy.

## Notes

- The previous static site is preserved in `_legacy/` (not part of the build).
- Per-project GitHub/live links in the MDX frontmatter currently point to the
  profile; swap in exact repo/demo URLs when confirmed.
