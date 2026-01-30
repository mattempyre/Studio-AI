import { useState, useCallback, useRef } from 'react';
import { Scene } from '../../../types';

interface UseDragDropOptions {
  scenes: Scene[];
  onReorder: (scenes: Scene[]) => void;
  pixelsPerSecond: number;
}

interface UseDragDropReturn {
  isDragging: boolean;
  dragClipId: string | null;
  dropTargetIndex: number | null;
  handleDragStart: (e: React.DragEvent, sceneId: string) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
  handleDrop: (e: React.DragEvent, targetIndex: number) => void;
}

export function useDragDrop({
  scenes,
  onReorder,
  pixelsPerSecond
}: UseDragDropOptions): UseDragDropReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [dragClipId, setDragClipId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const dragDataRef = useRef<{ sceneId: string; originalIndex: number } | null>(null);

  const recalculateTimelineStarts = useCallback((orderedScenes: Scene[]): Scene[] => {
    let currentStart = 0;

    return orderedScenes.map(scene => {
      const effectiveDuration = scene.effectiveDuration ?? scene.videoDuration ?? 5;
      const updatedScene = {
        ...scene,
        timelineStart: currentStart
      };
      currentStart += effectiveDuration;
      return updatedScene;
    });
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, sceneId: string) => {
    setIsDragging(true);
    setDragClipId(sceneId);

    const originalIndex = scenes.findIndex(s => s.id === sceneId);
    dragDataRef.current = { sceneId, originalIndex };

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sceneId);

    // Create a drag image (optional)
    const target = e.target as HTMLElement;
    if (target) {
      const rect = target.getBoundingClientRect();
      e.dataTransfer.setDragImage(target, rect.width / 2, rect.height / 2);
    }
  }, [scenes]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragClipId(null);
    setDropTargetIndex(null);
    dragDataRef.current = null;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    if (!dragDataRef.current) {
      handleDragEnd();
      return;
    }

    const { sceneId, originalIndex } = dragDataRef.current;

    // Don't do anything if dropped in the same position
    if (originalIndex === targetIndex || originalIndex === targetIndex - 1) {
      handleDragEnd();
      return;
    }

    // Create new scene order
    const newScenes = [...scenes];
    const [movedScene] = newScenes.splice(originalIndex, 1);

    // Adjust target index if we removed an item before the target
    const adjustedTargetIndex = originalIndex < targetIndex ? targetIndex - 1 : targetIndex;
    newScenes.splice(adjustedTargetIndex, 0, movedScene);

    // Recalculate timeline positions
    const updatedScenes = recalculateTimelineStarts(newScenes);

    onReorder(updatedScenes);
    handleDragEnd();
  }, [scenes, onReorder, recalculateTimelineStarts, handleDragEnd]);

  return {
    isDragging,
    dragClipId,
    dropTargetIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop
  };
}
