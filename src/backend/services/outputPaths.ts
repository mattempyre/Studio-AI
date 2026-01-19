/**
 * Output path utilities for generated media files
 *
 * Provides consistent path generation for images, videos, and audio files.
 * Files are organized by project ID and media type.
 *
 * Structure:
 *   {OUTPUT_DIR}/{projectId}/images/
 *   {OUTPUT_DIR}/{projectId}/videos/
 *   {OUTPUT_DIR}/{projectId}/audio/
 */

import * as path from 'path';
import * as fs from 'fs/promises';

export type MediaType = 'images' | 'videos' | 'audio';

/**
 * Get the base output directory from environment or default
 */
export function getOutputDir(): string {
  return process.env.OUTPUT_DIR || './data/projects';
}

/**
 * Get the directory path for a specific project and media type
 */
export function getProjectMediaDir(projectId: string, mediaType: MediaType): string {
  return path.join(getOutputDir(), projectId, mediaType);
}

/**
 * Generate a unique filename for generated media
 *
 * Format: {prefix}_{timestamp}_{random}.{ext}
 */
export function generateFilename(
  prefix: string,
  extension: string,
  timestamp?: number
): string {
  const ts = timestamp || Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${random}.${extension}`;
}

/**
 * Get the full output path for a generated file
 *
 * @param projectId - The project ID
 * @param mediaType - Type of media (images, videos, audio)
 * @param filename - The filename (or will be generated if prefix/ext provided)
 */
export function getOutputPath(
  projectId: string,
  mediaType: MediaType,
  filename: string
): string {
  return path.join(getProjectMediaDir(projectId, mediaType), filename);
}

/**
 * Generate a complete output path with auto-generated filename
 *
 * @param projectId - The project ID
 * @param mediaType - Type of media (images, videos, audio)
 * @param prefix - Filename prefix (e.g., 'scene', 'narration')
 * @param extension - File extension without dot (e.g., 'png', 'mp4', 'wav')
 */
export function generateOutputPath(
  projectId: string,
  mediaType: MediaType,
  prefix: string,
  extension: string
): string {
  const filename = generateFilename(prefix, extension);
  return getOutputPath(projectId, mediaType, filename);
}

/**
 * Ensure the output directory exists for a project and media type
 */
export async function ensureOutputDir(
  projectId: string,
  mediaType: MediaType
): Promise<string> {
  const dir = getProjectMediaDir(projectId, mediaType);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Ensure all media directories exist for a project
 */
export async function ensureProjectDirs(projectId: string): Promise<void> {
  await Promise.all([
    ensureOutputDir(projectId, 'images'),
    ensureOutputDir(projectId, 'videos'),
    ensureOutputDir(projectId, 'audio'),
  ]);
}

/**
 * Get all files in a project's media directory
 */
export async function listProjectMedia(
  projectId: string,
  mediaType: MediaType
): Promise<string[]> {
  const dir = getProjectMediaDir(projectId, mediaType);
  try {
    const files = await fs.readdir(dir);
    return files.map((f) => path.join(dir, f));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Delete all media files for a project
 */
export async function deleteProjectMedia(projectId: string): Promise<void> {
  const projectDir = path.join(getOutputDir(), projectId);
  try {
    await fs.rm(projectDir, { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Specific path helpers for the generation engine
 */

export function getAudioPath(projectId: string, sentenceId: string): string {
  return path.join(getProjectMediaDir(projectId, 'audio'), `${sentenceId}.wav`);
}

export function getSectionAudioPath(projectId: string, sectionId: string): string {
  return path.join(getProjectMediaDir(projectId, 'audio'), `section_${sectionId}.wav`);
}

export function getImagePath(projectId: string, sentenceId: string): string {
  return path.join(getProjectMediaDir(projectId, 'images'), `${sentenceId}.png`);
}

export function getVideoPath(projectId: string, sentenceId: string): string {
  return path.join(getProjectMediaDir(projectId, 'videos'), `${sentenceId}.mp4`);
}

/**
 * Convert a filesystem path to a media URL path for serving to the frontend.
 *
 * Takes paths like:
 *   - ./data/projects/proj-123/images/sent-456.png
 *   - data/projects/proj-123/images/sent-456.png
 *   - C:\...\data\projects\proj-123\images\sent-456.png
 *
 * Returns: /media/projects/proj-123/images/sent-456.png
 *
 * This path can be appended to API_BASE on the frontend to get the full URL.
 */
export function toMediaUrl(filesystemPath: string): string {
  // Normalize to forward slashes
  const normalized = filesystemPath.replace(/\\/g, '/');

  // Find the project directory portion (after 'projects/')
  const projectsMatch = normalized.match(/projects\/(.+)$/);
  if (projectsMatch) {
    return `/media/projects/${projectsMatch[1]}`;
  }

  // Fallback: if path doesn't match expected pattern, return as-is
  // This shouldn't happen in normal operation
  console.warn(`toMediaUrl: unexpected path format: ${filesystemPath}`);
  return filesystemPath;
}
