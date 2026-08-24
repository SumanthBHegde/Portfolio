import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const work = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/work' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      tagline: z.string(),
      role: z.string(),
      year: z.string(),
      stack: z.array(z.string()),
      // Landing-card + case-study summary (Problem / Approach / Impact)
      problem: z.string(),
      approach: z.string(),
      impact: z.array(z.string()),
      links: z.object({
        live: z.string().url().optional(),
        github: z.string().url().optional(),
        docs: z.string().optional(), // may be a placeholder until real docs exist
      }),
      cover: image().optional(), // project screenshot, optimized by astro:assets
      accent: z.string().optional(), // per-card motif hue (falls back to --accent)
      featured: z.boolean().default(true),
      order: z.number(),
    }),
});

export const collections = { work };
