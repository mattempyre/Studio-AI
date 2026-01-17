#!/usr/bin/env npx tsx
/**
 * Setup Worktree Ports
 *
 * Automatically generates .env.local with ports based on story number.
 * Run this after creating a new git worktree.
 *
 * Port Convention:
 *   main repo:    Frontend 3000, Backend 3001, Inngest 8288
 *   STORY-010:    Frontend 3100, Backend 3101, Inngest 8210
 *   STORY-011:    Frontend 3110, Backend 3111, Inngest 8211
 *   STORY-0XX:    Frontend 3XX0, Backend 3XX1, Inngest 82XX
 *
 * Usage:
 *   npx tsx scripts/setup-worktree-ports.ts
 *   npm run setup:ports
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';

interface PortConfig {
  frontendPort: number;
  backendPort: number;
  inngestPort: number;
  storyId: string | null;
}

function extractStoryNumber(dirName: string): number | null {
  // Match patterns like: Studio-AI-STORY-011, STORY-011, feature/STORY-011
  const match = dirName.match(/STORY-(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function calculatePorts(storyNumber: number | null): PortConfig {
  if (storyNumber === null) {
    // Main repo - use default ports
    return {
      frontendPort: 3000,
      backendPort: 3001,
      inngestPort: 8288,
      storyId: null,
    };
  }

  // Story-based ports:
  // STORY-010 -> 3100, 3101, 8210
  // STORY-011 -> 3110, 3111, 8211
  // STORY-123 -> 3230, 3231, 8323 (wraps for > 99)
  const basePort = 3000 + (storyNumber * 10);
  const inngestBase = 8200 + storyNumber;

  return {
    frontendPort: basePort,
    backendPort: basePort + 1,
    inngestPort: inngestBase,
    storyId: `STORY-${String(storyNumber).padStart(3, '0')}`,
  };
}

function generateEnvContent(config: PortConfig, existingEnv: string = ''): string {
  const lines: string[] = [];

  // Header
  lines.push('# Auto-generated port configuration for worktree development');
  lines.push(`# ${config.storyId ? `Worktree: ${config.storyId}` : 'Main repository'}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Port configuration
  lines.push('# Server Ports');
  lines.push(`PORT=${config.backendPort}`);
  lines.push(`VITE_PORT=${config.frontendPort}`);
  lines.push(`INNGEST_DEV_PORT=${config.inngestPort}`);
  lines.push('');

  // Frontend API URL
  lines.push('# Frontend API Configuration');
  lines.push(`VITE_API_URL=http://localhost:${config.backendPort}`);
  lines.push(`FRONTEND_URL=http://localhost:${config.frontendPort}`);
  lines.push('');

  // Preserve existing non-port env vars
  const existingLines = existingEnv.split('\n');
  const preservedVars: string[] = [];
  const portVars = ['PORT', 'VITE_PORT', 'INNGEST_DEV_PORT', 'VITE_API_URL', 'FRONTEND_URL'];

  for (const line of existingLines) {
    const trimmed = line.trim();
    // Skip empty lines, comments, and port-related vars
    if (!trimmed || trimmed.startsWith('#')) continue;

    const varName = trimmed.split('=')[0];
    if (!portVars.includes(varName)) {
      preservedVars.push(line);
    }
  }

  if (preservedVars.length > 0) {
    lines.push('# Preserved existing configuration');
    lines.push(...preservedVars);
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const cwd = process.cwd();
  const dirName = basename(cwd);

  console.log(`\n🔧 Setting up worktree ports for: ${dirName}\n`);

  // Extract story number from directory name
  const storyNumber = extractStoryNumber(dirName);
  const config = calculatePorts(storyNumber);

  console.log('Port Configuration:');
  console.log(`  Frontend:  http://localhost:${config.frontendPort}`);
  console.log(`  Backend:   http://localhost:${config.backendPort}`);
  console.log(`  Inngest:   http://localhost:${config.inngestPort}`);
  console.log('');

  // Read existing .env.local if it exists
  const envPath = join(cwd, '.env.local');
  let existingEnv = '';

  if (existsSync(envPath)) {
    existingEnv = readFileSync(envPath, 'utf-8');
    console.log('📄 Found existing .env.local - preserving non-port variables');
  }

  // Generate and write new .env.local
  const envContent = generateEnvContent(config, existingEnv);
  writeFileSync(envPath, envContent);

  console.log('✅ Created .env.local with port configuration\n');

  // Show docker-compose override instructions
  if (config.storyId) {
    console.log('📋 To start Inngest with custom port, use:');
    console.log(`   INNGEST_DEV_PORT=${config.inngestPort} docker-compose up inngest\n`);
    console.log('   Or use: npm run dev:all (reads from .env.local)\n');
  }

  // Show quick start
  console.log('🚀 Quick Start:');
  console.log('   npm run dev:all    # Start all services with configured ports');
  console.log('');
}

main();
