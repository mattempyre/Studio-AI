import { useState, useRef, useCallback, useEffect } from 'react';
import { Scene, AudioTrack } from '../../../types';

interface UseTimelinePlaybackOptions {
  scenes: Scene[];
  audioTracks?: AudioTrack[];
  duration: number;
  onTimeUpdate?: (time: number) => void;
}

interface UseTimelinePlaybackReturn {
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seekTo: (time: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToNextClip: () => void;
  jumpToPrevClip: () => void;
  shuttle: (direction: 'forward' | 'backward' | 'stop') => void;
  getCurrentScene: () => Scene | null;
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>;
  audioRefs: React.MutableRefObject<Map<string, HTMLAudioElement>>;
  registerVideoRef: (sceneId: string, element: HTMLVideoElement | null) => void;
  registerAudioRef: (clipId: string, element: HTMLAudioElement | null) => void;
}

export function useTimelinePlayback({
  scenes,
  audioTracks = [],
  duration,
  onTimeUpdate
}: UseTimelinePlaybackOptions): UseTimelinePlaybackReturn {
  const [currentTime, setCurrentTimeState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuttleSpeed, setShuttleSpeed] = useState(0); // -2, -1, 0, 1, 2

  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const lastFrameTime = useRef<number>(performance.now());
  const animationFrameRef = useRef<number | undefined>(undefined);

  const registerVideoRef = useCallback((sceneId: string, element: HTMLVideoElement | null) => {
    if (element) {
      videoRefs.current.set(sceneId, element);
    } else {
      videoRefs.current.delete(sceneId);
    }
  }, []);

  const registerAudioRef = useCallback((clipId: string, element: HTMLAudioElement | null) => {
    if (element) {
      audioRefs.current.set(clipId, element);
    } else {
      audioRefs.current.delete(clipId);
    }
  }, []);

  // Get scene that should be playing at a given time
  const getSceneAtTime = useCallback((time: number): Scene | null => {
    for (const scene of scenes) {
      const start = scene.timelineStart ?? 0;
      const effectiveDur = scene.effectiveDuration ?? scene.videoDuration ?? 5;

      if (time >= start && time < start + effectiveDur) {
        return scene;
      }
    }
    return scenes.length > 0 ? scenes[0] : null;
  }, [scenes]);

  const getCurrentScene = useCallback(() => {
    return getSceneAtTime(currentTime);
  }, [currentTime, getSceneAtTime]);

  // Sync video elements to the master timeline
  const syncVideos = useCallback((masterTime: number) => {
    videoRefs.current.forEach((videoEl, sceneId) => {
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene) return;

      const clipStart = scene.timelineStart ?? 0;
      const trimOffset = scene.trimStart ?? 0;
      const slipOffset = scene.slipOffset ?? 0; // Default to 0 for backwards compatibility
      const effectiveDur = scene.effectiveDuration ?? scene.videoDuration ?? 5;

      // Calculate local time within the video (includes trim and slip offsets)
      const localTime = masterTime - clipStart + trimOffset + slipOffset;

      if (localTime >= 0 && localTime < effectiveDur + trimOffset + slipOffset) {
        // This video should be playing
        const targetTime = localTime;

        // Only seek if difference is significant (avoid micro-seeks)
        if (Math.abs(videoEl.currentTime - targetTime) > 0.1) {
          videoEl.currentTime = targetTime;
        }

        if (isPlaying && videoEl.paused) {
          videoEl.play().catch(() => {});
        }
      } else {
        // This video should be paused
        if (!videoEl.paused) {
          videoEl.pause();
        }
      }
    });
  }, [scenes, isPlaying]);

  // Sync audio elements to the master timeline
  const syncAudio = useCallback((masterTime: number) => {
    // Get all audio clips from all tracks
    for (const track of audioTracks) {
      if (track.isMuted) continue;

      for (const clip of track.clips) {
        const audioEl = audioRefs.current.get(clip.id);
        if (!audioEl) continue;

        const clipStart = clip.startTime;
        const clipEnd = clipStart + clip.duration;

        // Calculate local time within the audio clip
        // For section-level audio, add the audioStartOffset to seek to the correct position
        const audioOffset = clip.audioStartOffset ?? 0;
        const localTime = masterTime - clipStart + audioOffset;

        if (masterTime >= clipStart && masterTime < clipEnd) {
          // This audio should be playing
          audioEl.volume = track.volume;

          // Only seek if difference is significant (avoid micro-seeks)
          if (Math.abs(audioEl.currentTime - localTime) > 0.1) {
            audioEl.currentTime = localTime;
          }

          if (isPlaying && audioEl.paused) {
            audioEl.play().catch(() => {});
          }
        } else {
          // This audio should be paused
          if (!audioEl.paused) {
            audioEl.pause();
          }
        }
      }
    }
  }, [audioTracks, isPlaying]);

  // Playback loop
  useEffect(() => {
    const animate = (time: number) => {
      const deltaTime = (time - lastFrameTime.current) / 1000;
      lastFrameTime.current = time;

      if (isPlaying || shuttleSpeed !== 0) {
        const speed = shuttleSpeed !== 0 ? shuttleSpeed * 2 : 1;

        setCurrentTimeState(prev => {
          const next = prev + deltaTime * speed;
          if (next >= duration) {
            setIsPlaying(false);
            setShuttleSpeed(0);
            return duration;
          }
          if (next < 0) {
            return 0;
          }
          return next;
        });
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying || shuttleSpeed !== 0) {
      lastFrameTime.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, shuttleSpeed, duration]);

  // Sync videos and audio whenever time changes
  useEffect(() => {
    syncVideos(currentTime);
    syncAudio(currentTime);
    onTimeUpdate?.(currentTime);
  }, [currentTime, syncVideos, syncAudio, onTimeUpdate]);

  // Pause all media when playback stops
  useEffect(() => {
    if (!isPlaying && shuttleSpeed === 0) {
      videoRefs.current.forEach(videoEl => {
        if (!videoEl.paused) {
          videoEl.pause();
        }
      });
      audioRefs.current.forEach(audioEl => {
        if (!audioEl.paused) {
          audioEl.pause();
        }
      });
    }
  }, [isPlaying, shuttleSpeed]);

  const setCurrentTime = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, duration));
    setCurrentTimeState(clampedTime);
  }, [duration]);

  const play = useCallback(() => {
    if (currentTime >= duration) {
      setCurrentTimeState(0);
    }
    setShuttleSpeed(0);
    setIsPlaying(true);
  }, [currentTime, duration]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    setShuttleSpeed(0);
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seekTo = useCallback((time: number) => {
    setCurrentTime(time);
  }, [setCurrentTime]);

  // Frame step using functional update to ensure reliability
  const stepForward = useCallback(() => {
    setCurrentTimeState(prev => Math.min(prev + 1/30, duration)); // ~1 frame at 30fps
  }, [duration]);

  const stepBackward = useCallback(() => {
    setCurrentTimeState(prev => Math.max(prev - 1/30, 0));
  }, []);

  // Jump to next clip boundary
  const jumpToNextClip = useCallback(() => {
    // Find the next scene start time after current time
    const sortedScenes = [...scenes].sort((a, b) => (a.timelineStart ?? 0) - (b.timelineStart ?? 0));

    for (const scene of sortedScenes) {
      const sceneStart = scene.timelineStart ?? 0;
      if (sceneStart > currentTime + 0.01) { // Small epsilon to avoid staying at same position
        setCurrentTimeState(sceneStart);
        return;
      }
    }

    // If no next clip, jump to end
    setCurrentTimeState(duration);
  }, [scenes, currentTime, duration]);

  // Jump to previous clip boundary (or start of current clip)
  const jumpToPrevClip = useCallback(() => {
    // Find the previous scene start time before current time
    const sortedScenes = [...scenes].sort((a, b) => (b.timelineStart ?? 0) - (a.timelineStart ?? 0));

    for (const scene of sortedScenes) {
      const sceneStart = scene.timelineStart ?? 0;
      if (sceneStart < currentTime - 0.01) { // Small epsilon
        setCurrentTimeState(sceneStart);
        return;
      }
    }

    // If no previous clip, jump to start
    setCurrentTimeState(0);
  }, [scenes, currentTime]);

  const shuttle = useCallback((direction: 'forward' | 'backward' | 'stop') => {
    if (direction === 'stop') {
      setShuttleSpeed(0);
      setIsPlaying(false);
    } else if (direction === 'forward') {
      setIsPlaying(false);
      setShuttleSpeed(prev => Math.min(prev + 1, 4));
    } else {
      setIsPlaying(false);
      setShuttleSpeed(prev => Math.max(prev - 1, -4));
    }
  }, []);

  return {
    currentTime,
    setCurrentTime,
    isPlaying,
    play,
    pause,
    togglePlayback,
    seekTo,
    stepForward,
    stepBackward,
    jumpToNextClip,
    jumpToPrevClip,
    shuttle,
    getCurrentScene,
    videoRefs,
    audioRefs,
    registerVideoRef,
    registerAudioRef
  };
}
