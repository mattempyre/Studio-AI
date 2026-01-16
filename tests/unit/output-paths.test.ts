import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  rm: vi.fn(),
}));

// Import after mocking
import {
  getOutputDir,
  getProjectMediaDir,
  generateFilename,
  getOutputPath,
  generateOutputPath,
  ensureOutputDir,
  ensureProjectDirs,
  listProjectMedia,
  deleteProjectMedia,
} from '../../src/backend/services/outputPaths.js';

describe('Output Paths Service', () => {
  const originalEnv = process.env.OUTPUT_DIR;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OUTPUT_DIR;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.OUTPUT_DIR = originalEnv;
    } else {
      delete process.env.OUTPUT_DIR;
    }
  });

  describe('getOutputDir', () => {
    it('should return default path when OUTPUT_DIR not set', () => {
      expect(getOutputDir()).toBe('./data/projects');
    });

    it('should return OUTPUT_DIR when set', () => {
      process.env.OUTPUT_DIR = '/custom/output';
      expect(getOutputDir()).toBe('/custom/output');
    });
  });

  describe('getProjectMediaDir', () => {
    it('should return correct path for images', () => {
      const result = getProjectMediaDir('project-123', 'images');
      expect(result).toBe(path.join('./data/projects', 'project-123', 'images'));
    });

    it('should return correct path for videos', () => {
      const result = getProjectMediaDir('project-123', 'videos');
      expect(result).toBe(path.join('./data/projects', 'project-123', 'videos'));
    });

    it('should return correct path for audio', () => {
      const result = getProjectMediaDir('project-123', 'audio');
      expect(result).toBe(path.join('./data/projects', 'project-123', 'audio'));
    });

    it('should use custom OUTPUT_DIR', () => {
      process.env.OUTPUT_DIR = '/custom';
      const result = getProjectMediaDir('proj-1', 'images');
      expect(result).toBe(path.join('/custom', 'proj-1', 'images'));
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with prefix and extension', () => {
      const filename = generateFilename('scene', 'png', 1234567890);
      expect(filename).toMatch(/^scene_1234567890_[a-z0-9]{6}\.png$/);
    });

    it('should use current timestamp when not provided', () => {
      const before = Date.now();
      const filename = generateFilename('video', 'mp4');
      const after = Date.now();

      const match = filename.match(/^video_(\d+)_[a-z0-9]{6}\.mp4$/);
      expect(match).toBeTruthy();

      const timestamp = parseInt(match![1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should generate unique filenames', () => {
      const filename1 = generateFilename('test', 'png', 1000);
      const filename2 = generateFilename('test', 'png', 1000);
      // Random suffix should make them different
      expect(filename1).not.toBe(filename2);
    });
  });

  describe('getOutputPath', () => {
    it('should return full path to file', () => {
      const result = getOutputPath('proj-1', 'images', 'scene_001.png');
      expect(result).toBe(path.join('./data/projects', 'proj-1', 'images', 'scene_001.png'));
    });
  });

  describe('generateOutputPath', () => {
    it('should generate complete output path', () => {
      const result = generateOutputPath('proj-1', 'videos', 'scene', 'mp4');
      expect(result).toMatch(/data[\\/]projects[\\/]proj-1[\\/]videos[\\/]scene_\d+_[a-z0-9]{6}\.mp4$/);
    });
  });

  describe('ensureOutputDir', () => {
    it('should create directory and return path', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      const result = await ensureOutputDir('proj-1', 'images');

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join('./data/projects', 'proj-1', 'images'),
        { recursive: true }
      );
      expect(result).toBe(path.join('./data/projects', 'proj-1', 'images'));
    });
  });

  describe('ensureProjectDirs', () => {
    it('should create all media directories', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await ensureProjectDirs('proj-1');

      expect(fs.mkdir).toHaveBeenCalledTimes(3);
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('images'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('videos'),
        { recursive: true }
      );
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('audio'),
        { recursive: true }
      );
    });
  });

  describe('listProjectMedia', () => {
    it('should return list of files in directory', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['file1.png', 'file2.png'] as any);

      const result = await listProjectMedia('proj-1', 'images');

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('file1.png');
      expect(result[1]).toContain('file2.png');
    });

    it('should return empty array when directory does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readdir).mockRejectedValue(error);

      const result = await listProjectMedia('proj-1', 'images');

      expect(result).toEqual([]);
    });

    it('should throw other errors', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      vi.mocked(fs.readdir).mockRejectedValue(error);

      await expect(listProjectMedia('proj-1', 'images')).rejects.toThrow('Permission denied');
    });
  });

  describe('deleteProjectMedia', () => {
    it('should delete project directory', async () => {
      vi.mocked(fs.rm).mockResolvedValue();

      await deleteProjectMedia('proj-1');

      expect(fs.rm).toHaveBeenCalledWith(
        path.join('./data/projects', 'proj-1'),
        { recursive: true, force: true }
      );
    });

    it('should not throw when directory does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.rm).mockRejectedValue(error);

      await expect(deleteProjectMedia('proj-1')).resolves.toBeUndefined();
    });

    it('should throw other errors', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      vi.mocked(fs.rm).mockRejectedValue(error);

      await expect(deleteProjectMedia('proj-1')).rejects.toThrow('Permission denied');
    });
  });
});
