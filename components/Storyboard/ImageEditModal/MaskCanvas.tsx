import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { MaskCanvasProps } from './types';

const MaskCanvas: React.FC<MaskCanvasProps> = ({
  imageUrl,
  brushSize,
  isErasing,
  onMaskChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Load and size the image
  useEffect(() => {
    if (!containerRef.current || !imageUrl) return;

    const container = containerRef.current;

    // Function to load and draw the image once container has dimensions
    const loadImage = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Wait for container to have dimensions
      if (containerWidth === 0 || containerHeight === 0) {
        // Retry after a short delay
        requestAnimationFrame(loadImage);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Calculate size to fit container while maintaining aspect ratio
        const imgAspect = img.width / img.height;
        const containerAspect = containerWidth / containerHeight;

        let width: number;
        let height: number;

        if (imgAspect > containerAspect) {
          // Image is wider than container
          width = containerWidth;
          height = containerWidth / imgAspect;
        } else {
          // Image is taller than container
          height = containerHeight;
          width = containerHeight * imgAspect;
        }

        // Set canvas dimensions directly on the elements before drawing
        // (React state update is async, so we need to set these imperatively)
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;

        if (canvas) {
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
          }
        }

        if (maskCanvas) {
          maskCanvas.width = width;
          maskCanvas.height = height;
          const maskCtx = maskCanvas.getContext('2d');
          if (maskCtx) {
            maskCtx.clearRect(0, 0, width, height);
          }
        }

        // Update React state for positioning calculations
        setCanvasSize({ width, height });
        setImageLoaded(true);
      };
      img.src = imageUrl;
    };

    // Start loading the image
    loadImage();
  }, [imageUrl]);

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return { x, y };
    },
    []
  );

  // Draw on the mask canvas
  const draw = useCallback(
    (x: number, y: number) => {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;

      const ctx = maskCanvas.getContext('2d');
      if (!ctx) return;

      ctx.beginPath();
      if (isErasing) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        // Draw in pure red for mask (ComfyUI extracts red channel)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
      }
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    },
    [brushSize, isErasing]
  );

  // Export mask as PNG with red channel
  const exportMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) {
      onMaskChange(null);
      return;
    }

    const ctx = maskCanvas.getContext('2d');
    if (!ctx) {
      onMaskChange(null);
      return;
    }

    // Check if mask has any content
    const imageData = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const hasContent = imageData.data.some((_, i) => i % 4 === 3 && imageData.data[i] > 0);

    if (!hasContent) {
      onMaskChange(null);
      return;
    }

    // Create output canvas with solid red for mask areas
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = maskCanvas.width;
    outputCanvas.height = maskCanvas.height;
    const outputCtx = outputCanvas.getContext('2d')!;

    // Fill with black background (non-edit areas)
    outputCtx.fillStyle = 'black';
    outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

    // Get mask data and convert alpha to red channel
    for (let i = 0; i < imageData.data.length; i += 4) {
      const alpha = imageData.data[i + 3];
      if (alpha > 0) {
        // Set pixel to red based on alpha
        const x = (i / 4) % maskCanvas.width;
        const y = Math.floor(i / 4 / maskCanvas.width);
        outputCtx.fillStyle = `rgb(${Math.round((alpha / 255) * 255)}, 0, 0)`;
        outputCtx.fillRect(x, y, 1, 1);
      }
    }

    onMaskChange(outputCanvas.toDataURL('image/png'));
  }, [onMaskChange]);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const coords = getCanvasCoords(e);
      if (!coords) return;

      setIsDrawing(true);
      draw(coords.x, coords.y);
    },
    [getCanvasCoords, draw]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const coords = getCanvasCoords(e);
      if (coords) {
        setCursorPos(coords);
      }

      if (!isDrawing) return;
      if (!coords) return;

      draw(coords.x, coords.y);
    },
    [isDrawing, getCanvasCoords, draw]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      exportMask();
    }
  }, [isDrawing, exportMask]);

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    if (isDrawing) {
      setIsDrawing(false);
      exportMask();
    }
  }, [isDrawing, exportMask]);

  // Clear mask function exposed via ref
  useEffect(() => {
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas && canvasSize.width > 0) {
      // Attach clear method to canvas element for external access
      (maskCanvas as HTMLCanvasElement & { clearMask?: () => void }).clearMask = () => {
        const ctx = maskCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
          onMaskChange(null);
        }
      };
    }
  }, [canvasSize, onMaskChange]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[400px] bg-black rounded-lg overflow-hidden flex items-center justify-center"
    >
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-text-muted">
          Loading image...
        </div>
      )}

      {/* Source image canvas - dimensions set imperatively, not via React props */}
      <canvas
        ref={canvasRef}
        className="absolute"
        style={{
          opacity: imageLoaded ? 1 : 0,
        }}
      />

      {/* Mask overlay canvas - dimensions set imperatively, not via React props */}
      <canvas
        ref={maskCanvasRef}
        className="absolute cursor-crosshair"
        style={{
          opacity: imageLoaded ? 1 : 0,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {/* Brush cursor preview */}
      {cursorPos && imageLoaded && (
        <div
          className="absolute pointer-events-none border-2 rounded-full"
          style={{
            width: brushSize,
            height: brushSize,
            left: cursorPos.x - brushSize / 2 + (canvasSize.width ? (containerRef.current!.clientWidth - canvasSize.width) / 2 : 0),
            top: cursorPos.y - brushSize / 2 + (canvasSize.height ? (containerRef.current!.clientHeight - canvasSize.height) / 2 : 0),
            borderColor: isErasing ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          }}
        />
      )}
    </div>
  );
};

// Export a ref handle type for external clear access
export interface MaskCanvasHandle {
  clearMask: () => void;
}

export default MaskCanvas;
