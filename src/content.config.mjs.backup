import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articleSchema = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  readingTime: z.number().optional(),
  featured: z.boolean().default(false),
});

const categories = [
  'history', 'geography', 'culture', 'food', 'art', 'music',
  'technology', 'nature', 'people', 'society', 'economy', 'lifestyle'
];

const collections = {};

// Generate collections for each language + category
for (const lang of ['zh-TW', 'en']) {
  const prefix = lang === 'zh-TW' ? 'zh-tw' : 'en';
  for (const cat of categories) {
    collections[`${prefix}-${cat}`] = defineCollection({
      loader: glob({ pattern: '**/*.md', base: `./src/content/${lang}/${cat}` }),
      schema: articleSchema,
    });
  }
}

export { collections };
