import React from 'react';
import { Composition } from 'remotion';
import { VideoComposition, VideoCompositionProps } from './Composition';
import { Project } from '../../types';

// Default project for Remotion Studio preview
const defaultProject: Project = {
  id: 'preview',
  name: 'Preview Project',
  type: 'video',
  status: 'draft',
  lastEdited: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  script: [],
  scenes: [
    {
      id: 'scene-1',
      scriptSectionId: 's1',
      timestamp: '0:00 - 0:05',
      narration: 'Sample scene for preview',
      imagePrompt: '',
      cameraMovement: 'static',
      visualStyle: 'cinematic',
      timelineStart: 0,
      effectiveDuration: 5,
      videoDuration: 5
    }
  ],
  textOverlays: [],
  progress: 0
};

export const RemotionRoot: React.FC = () => {
  // In production, this will receive the actual project data
  // via input props from the render call
  return (
    <>
      <Composition
        id="VideoExport"
        component={VideoComposition as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={30 * 60} // 60 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          project: defaultProject
        }}
      />
      <Composition
        id="VideoExport720p"
        component={VideoComposition as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={30 * 60}
        fps={30}
        width={1280}
        height={720}
        defaultProps={{
          project: defaultProject
        }}
      />
      <Composition
        id="VideoExportVertical"
        component={VideoComposition as unknown as React.FC<Record<string, unknown>>}
        durationInFrames={30 * 60}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          project: defaultProject
        }}
      />
    </>
  );
};
