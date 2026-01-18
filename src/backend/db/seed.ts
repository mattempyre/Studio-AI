/**
 * Database Seed Script
 *
 * Seeds the generation_models and visual_styles tables with initial data.
 * Run with: npx tsx src/backend/db/seed.ts
 */

import { db, generationModels, visualStyles } from './index.js';
import { sql } from 'drizzle-orm';

// Initial models to seed
const SEED_MODELS = [
  // Image models
  {
    id: 'z-image-turbo',
    name: 'Z-Image Turbo',
    description: 'Fast 4-step turbo model for quick high-quality cinematic images',
    workflowFile: 'workflows/image/text-to-image-image_z_image_turbo.json',
    workflowCategory: 'image' as const,
    workflowType: 'text-to-image' as const,
    defaultSteps: 4,
    defaultCfg: 1.0,
    isActive: true,
  },
  {
    id: 'flux-2-klein',
    name: 'Flux 2 Klein',
    description: 'Image-to-image model using reference images for character consistency',
    workflowFile: 'workflows/image/image_flux2_klein_image_edit_4b_base.json',
    workflowCategory: 'image' as const,
    workflowType: 'image-to-image' as const,
    defaultSteps: 20,
    defaultCfg: 5.0,
    isActive: true,
  },
  // Video models
  {
    id: 'wan-2-2-14b-i2v',
    name: 'WAN 2.2 14B I2V',
    description: 'High-quality image-to-video model with LightX2V 4-step fast generation',
    workflowFile: 'workflows/video/video_wan2_2_14B_i2v.json',
    workflowCategory: 'video' as const,
    workflowType: 'image-to-video' as const,
    defaultSteps: 4,
    defaultCfg: 1.0,
    defaultFrames: 81,
    defaultFps: 16,
    isActive: true,
  },
];

// Initial styles to seed (from existing VISUAL_STYLES config)
const SEED_STYLES = [
  // Text-to-image prompt styles
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'High-fidelity photorealistic style with dramatic lighting',
    styleType: 'prompt' as const,
    promptPrefix:
      'Cinematic photograph, dramatic lighting, shallow depth of field, 8k resolution, professional color grading, film grain.',
    compatibleModels: ['z-image-turbo'],
    requiresCharacterRef: false,
    isActive: true,
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon-lit futuristic aesthetic with high-tech elements',
    styleType: 'prompt' as const,
    promptPrefix:
      'Cyberpunk aesthetic, neon lights, rain-soaked streets, holographic displays, purple and blue color palette, futuristic technology.',
    compatibleModels: ['z-image-turbo'],
    requiresCharacterRef: false,
    isActive: true,
  },
  {
    id: 'documentary',
    name: 'Documentary',
    description: 'Realistic documentary-style imagery',
    styleType: 'prompt' as const,
    promptPrefix: 'Documentary photograph, natural lighting, authentic setting, photojournalistic style, high detail.',
    compatibleModels: ['z-image-turbo'],
    requiresCharacterRef: false,
    isActive: true,
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional business-appropriate imagery',
    styleType: 'prompt' as const,
    promptPrefix:
      'Professional corporate photography, clean modern office environment, business attire, neutral color palette, well-lit.',
    compatibleModels: ['z-image-turbo'],
    requiresCharacterRef: false,
    isActive: true,
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    description: 'Soft, artistic watercolor painting style',
    styleType: 'prompt' as const,
    promptPrefix:
      'Watercolor painting, soft edges, flowing colors, artistic brushstrokes, gentle gradients, traditional art style.',
    compatibleModels: ['z-image-turbo'],
    requiresCharacterRef: false,
    isActive: true,
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Japanese anime-inspired illustration style',
    styleType: 'prompt' as const,
    promptPrefix:
      'Anime style illustration, vibrant colors, expressive characters, dynamic composition, clean linework, Studio Ghibli inspired.',
    compatibleModels: ['z-image-turbo'],
    requiresCharacterRef: false,
    isActive: true,
  },
  // Image-to-image prompt styles (require character reference, use Flux 2 Klein)
  {
    id: 'financial-explainer',
    name: 'Financial Explainer',
    description: 'Clean illustrated style with white backgrounds, ideal for financial and business explainers',
    styleType: 'prompt' as const,
    promptPrefix:
      "Match the graphic style. White background. Keep only essential items that make it look like a location but otherwise keep the background white. Its important that he looks like the man especially the facial features",
    compatibleModels: ['flux-2-klein'],
    requiresCharacterRef: true,
    isActive: true,
  },
  {
    id: 'cartoon-explainer',
    name: 'Cartoon Explainer',
    description: 'Friendly cartoon style with colorful backgrounds for casual educational content',
    styleType: 'prompt' as const,
    promptPrefix:
      'Match the cartoon style. Colorful, friendly illustration. Keep the character recognizable with accurate facial features. Simple clean background appropriate to the scene.',
    compatibleModels: ['flux-2-klein'],
    requiresCharacterRef: true,
    isActive: true,
  },
  {
    id: 'minimalist-sketch',
    name: 'Minimalist Sketch',
    description: 'Clean line-art aesthetic perfect for educational explainers',
    styleType: 'prompt' as const,
    promptPrefix:
      'Minimalist line art illustration. Clean black lines on white background. Simple, elegant sketch style. Focus on the essential elements.',
    compatibleModels: ['flux-2-klein'],
    requiresCharacterRef: true,
    isActive: true,
  },
  // LoRA-based style
  {
    id: 'ms-paint-style',
    name: 'MS Paint Style',
    description: 'Retro MS Paint aesthetic with nostalgic pixelated look',
    styleType: 'lora' as const,
    loraFile: 'ms_paint_lora_v1.safetensors',
    loraStrength: 1.0,
    compatibleModels: ['z-image-turbo'],
    requiresCharacterRef: false,
    isActive: true,
  },
  // None style - for raw prompts without modification
  {
    id: 'none',
    name: 'None (Raw Prompt)',
    description: 'No style modification - use your prompt exactly as entered',
    styleType: 'prompt' as const,
    promptPrefix: '',
    compatibleModels: [],
    requiresCharacterRef: false,
    isActive: true,
  },
];

async function seed() {
  console.log('🌱 Seeding database...');

  // Seed models
  console.log('\n📦 Seeding generation models...');
  for (const model of SEED_MODELS) {
    const existing = await db.select().from(generationModels).where(sql`id = ${model.id}`).get();
    if (existing) {
      console.log(`  ⏭️  Model "${model.name}" already exists, skipping`);
    } else {
      await db.insert(generationModels).values(model);
      console.log(`  ✅ Created model: ${model.name}`);
    }
  }

  // Seed styles
  console.log('\n🎨 Seeding visual styles...');
  for (const style of SEED_STYLES) {
    const existing = await db.select().from(visualStyles).where(sql`id = ${style.id}`).get();
    if (existing) {
      console.log(`  ⏭️  Style "${style.name}" already exists, skipping`);
    } else {
      await db.insert(visualStyles).values(style);
      console.log(`  ✅ Created style: ${style.name}`);
    }
  }

  console.log('\n✨ Seeding complete!');

  // Show summary
  const modelCount = await db.select({ count: sql<number>`count(*)` }).from(generationModels).get();
  const styleCount = await db.select({ count: sql<number>`count(*)` }).from(visualStyles).get();
  console.log(`\n📊 Summary:`);
  console.log(`   Models: ${modelCount?.count || 0}`);
  console.log(`   Styles: ${styleCount?.count || 0}`);
}

// Run seed
seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
