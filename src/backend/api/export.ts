import { Router, Request, Response } from 'express';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

const router = Router();

interface ExportRequest {
  projectId: string;
  project: {
    id: string;
    name: string;
    scenes: Array<{
      id: string;
      videoUrl?: string;
      imageUrl?: string;
      timelineStart?: number;
      effectiveDuration?: number;
      trimStart?: number;
      trimEnd?: number;
      videoDuration?: number;
      narration: string;
      imagePrompt: string;
      cameraMovement: string;
      visualStyle: string;
      scriptSectionId: string;
      timestamp: string;
    }>;
    audioTracks?: Array<{
      id: string;
      type: 'voice' | 'music' | 'sfx';
      name: string;
      volume: number;
      isMuted: boolean;
      clips: Array<{
        id: string;
        name: string;
        startTime: number;
        duration: number;
      }>;
    }>;
    textOverlays?: Array<{
      id: string;
      text: string;
      x: number;
      y: number;
      fontSize: number;
      color: string;
      startTime: number;
    }>;
  };
  format?: '1080p' | '720p' | 'vertical';
  codec?: 'h264' | 'h265' | 'vp8' | 'vp9';
}

interface ExportJob {
  id: string;
  projectId: string;
  status: 'queued' | 'bundling' | 'rendering' | 'completed' | 'failed';
  progress: number;
  outputPath?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory job tracking (in production, use database)
const exportJobs = new Map<string, ExportJob>();

// Start export job
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { projectId, project, format = '1080p', codec = 'h264' } = req.body as ExportRequest;

    if (!projectId || !project) {
      return res.status(400).json({
        success: false,
        error: 'Missing projectId or project data'
      });
    }

    // Create job
    const jobId = `export_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const job: ExportJob = {
      id: jobId,
      projectId,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    exportJobs.set(jobId, job);

    // Start async rendering
    processExport(jobId, project, format, codec).catch(error => {
      const job = exportJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        job.updatedAt = new Date();
      }
    });

    return res.json({
      success: true,
      jobId,
      message: 'Export started'
    });
  } catch (error) {
    console.error('Export start error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start export'
    });
  }
});

// Get export job status
router.get('/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = exportJobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  return res.json({
    success: true,
    job: {
      id: job.id,
      projectId: job.projectId,
      status: job.status,
      progress: job.progress,
      outputPath: job.outputPath,
      error: job.error
    }
  });
});

// Download exported video
router.get('/download/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = exportJobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  if (job.status !== 'completed' || !job.outputPath) {
    return res.status(400).json({
      success: false,
      error: 'Export not completed'
    });
  }

  if (!fs.existsSync(job.outputPath)) {
    return res.status(404).json({
      success: false,
      error: 'Output file not found'
    });
  }

  res.download(job.outputPath);
});

// Process export asynchronously
async function processExport(
  jobId: string,
  project: ExportRequest['project'],
  format: string,
  codec: string
) {
  const job = exportJobs.get(jobId);
  if (!job) return;

  try {
    // Update status to bundling
    job.status = 'bundling';
    job.progress = 5;
    job.updatedAt = new Date();

    // Path to the Remotion entry point
    const entryPoint = path.resolve(__dirname, '../../remotion/index.ts');

    // Bundle the video
    console.log('Bundling Remotion project...');
    const bundleLocation = await bundle({
      entryPoint,
      onProgress: (progress) => {
        job.progress = 5 + Math.round(progress * 15); // 5-20%
        job.updatedAt = new Date();
      }
    });

    // Update status to rendering
    job.status = 'rendering';
    job.progress = 20;
    job.updatedAt = new Date();

    // Select composition based on format
    const compositionId = format === '720p'
      ? 'VideoExport720p'
      : format === 'vertical'
      ? 'VideoExportVertical'
      : 'VideoExport';

    // Calculate total duration from scenes
    const totalDuration = project.scenes.reduce((acc, scene) => {
      return acc + (scene.effectiveDuration ?? scene.videoDuration ?? 5);
    }, 0);

    console.log('Selecting composition:', compositionId);
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: { project }
    });

    // Override duration based on actual project content
    const fps = 30;
    const durationInFrames = Math.ceil(totalDuration * fps);

    // Output path
    const outputDir = path.resolve(__dirname, '../../../exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(
      outputDir,
      `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp4`
    );

    console.log('Starting render to:', outputPath);

    // Render the video
    await renderMedia({
      composition: {
        ...composition,
        durationInFrames
      },
      serveUrl: bundleLocation,
      codec: codec as 'h264' | 'h265' | 'vp8' | 'vp9',
      outputLocation: outputPath,
      inputProps: { project },
      onProgress: ({ progress }) => {
        job.progress = 20 + Math.round(progress * 80); // 20-100%
        job.updatedAt = new Date();
      }
    });

    // Update job to completed
    job.status = 'completed';
    job.progress = 100;
    job.outputPath = outputPath;
    job.updatedAt = new Date();

    console.log('Export completed:', outputPath);
  } catch (error) {
    console.error('Export error:', error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
    job.updatedAt = new Date();
    throw error;
  }
}

export { router as exportRouter };
