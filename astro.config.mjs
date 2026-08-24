import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// GitHub Pages project site: served at https://sumanthbhegde.github.io/Portfolio/
// VERIFY: swap `site` (and drop `base`) for a custom domain once one is bought via the
// GitHub Student Developer Pack and attached to this repo via a CNAME file.
const SITE = 'https://sumanthbhegde.github.io';
const BASE = '/Portfolio/';

// https://astro.build/config
export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  integrations: [mdx(), sitemap()],
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});
