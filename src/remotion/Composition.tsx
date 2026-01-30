import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  Video,
  Img,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  interpolate
} from 'remotion';
import { Project, Scene, AudioTrack } from '../../types';

export interface VideoCompositionProps {
  project: Project;
}

export const VideoComposition: React.FC<VideoCompositionProps> = ({ project }) => {
  const { fps } = useVideoConfig();

  // Convert scenes to sequences
  const renderVideoSequences = () => {
    return project.scenes.map((scene) => {
      const timelineStart = scene.timelineStart ?? 0;
      const effectiveDuration = scene.effectiveDuration ?? scene.videoDuration ?? 5;
      const trimStart = scene.trimStart ?? 0;

      const startFrame = Math.round(timelineStart * fps);
      const durationInFrames = Math.round(effectiveDuration * fps);
      const trimStartFrames = Math.round(trimStart * fps);

      return (
        <Sequence
          key={scene.id}
          from={startFrame}
          durationInFrames={durationInFrames}
          name={`Scene: ${scene.id}`}
        >
          <SceneRenderer
            scene={scene}
            trimStartFrames={trimStartFrames}
          />
        </Sequence>
      );
    });
  };

  // Render audio tracks
  const renderAudioSequences = () => {
    const audioTracks = project.audioTracks || [];

    return audioTracks.flatMap((track) => {
      return track.clips.map((clip) => {
        const startFrame = Math.round(clip.startTime * fps);
        const durationInFrames = Math.round(clip.duration * fps);

        // This is a placeholder - in production you'd have actual audio URLs
        const audioUrl = `/audio/${track.type}/${clip.name.toLowerCase().replace(/\s+/g, '-')}.mp3`;

        return (
          <Sequence
            key={clip.id}
            from={startFrame}
            durationInFrames={durationInFrames}
            name={`Audio: ${clip.name}`}
          >
            <Audio
              src={audioUrl}
              volume={track.isMuted ? 0 : track.volume}
            />
          </Sequence>
        );
      });
    });
  };

  // Render text overlays
  const renderTextOverlays = () => {
    return (project.textOverlays || []).map((overlay) => {
      const startFrame = Math.round(overlay.startTime * fps);
      const durationInFrames = 5 * fps; // 5 seconds default duration

      return (
        <Sequence
          key={overlay.id}
          from={startFrame}
          durationInFrames={durationInFrames}
          name={`Text: ${overlay.text}`}
        >
          <TextOverlayRenderer overlay={overlay} />
        </Sequence>
      );
    });
  };

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {renderVideoSequences()}
      {renderAudioSequences()}
      {renderTextOverlays()}
    </AbsoluteFill>
  );
};

// Scene renderer component
const SceneRenderer: React.FC<{
  scene: Scene;
  trimStartFrames: number;
}> = ({ scene, trimStartFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (scene.videoUrl) {
    return (
      <AbsoluteFill>
        <Video
          src={scene.videoUrl}
          startFrom={trimStartFrames}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      </AbsoluteFill>
    );
  }

  if (scene.imageUrl) {
    // Ken Burns effect for images
    const scale = interpolate(
      frame,
      [0, 150],
      [1, 1.1],
      { extrapolateRight: 'clamp' }
    );

    return (
      <AbsoluteFill>
        <Img
          src={scene.imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale})`
          }}
        />
      </AbsoluteFill>
    );
  }

  // Fallback for scenes without media
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div style={{ color: 'white', fontSize: 24, opacity: 0.5 }}>
        No media
      </div>
    </AbsoluteFill>
  );
};

// Text overlay renderer
const TextOverlayRenderer: React.FC<{
  overlay: {
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
  };
}> = ({ overlay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in/out animation
  const opacity = interpolate(
    frame,
    [0, fps * 0.5, fps * 4.5, fps * 5],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: `${overlay.x}%`,
          top: `${overlay.y}%`,
          transform: 'translate(-50%, -50%)',
          color: overlay.color,
          fontSize: overlay.fontSize,
          fontWeight: 'bold',
          textShadow: '0 2px 4px rgba(0,0,0,0.8)',
          opacity
        }}
      >
        {overlay.text}
      </div>
    </AbsoluteFill>
  );
};

export default VideoComposition;
