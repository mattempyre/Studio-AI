/**
 * MediaToggle Component
 * STORY-5-4: Video Generation UI
 *
 * Tab pills for switching between image and video content in sentence cards.
 * Positioned below the media area, shows Image/Video tabs with active states.
 */

import React from 'react';
import * as Icons from '../Icons';

export type MediaView = 'image' | 'video';

interface MediaToggleProps {
  /** Current active media view */
  activeView: MediaView;
  /** Whether the scene has an image file */
  hasImage: boolean;
  /** Whether the scene has a video file */
  hasVideo: boolean;
  /** Whether video is currently generating */
  isVideoGenerating?: boolean;
  /** Called when user clicks a tab */
  onViewChange: (view: MediaView) => void;
  /** Size variant for different layouts */
  size?: 'sm' | 'md';
}

export const MediaToggle: React.FC<MediaToggleProps> = ({
  activeView,
  hasImage,
  hasVideo,
  isVideoGenerating = false,
  onViewChange,
  size = 'sm',
}) => {
  // Only show tabs if there's content to toggle between
  // Show video tab if video exists OR is generating
  const showVideoTab = hasVideo || isVideoGenerating;

  // Don't render if there's nothing to toggle
  if (!hasImage && !showVideoTab) {
    return null;
  }

  const handleClick = (view: MediaView, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    onViewChange(view);
  };

  const iconSize = size === 'sm' ? 16 : 20;
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm';
  const paddingClass = size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2';

  return (
    <div
      className="flex items-center gap-1 mt-2"
      onClick={(e) => e.stopPropagation()} // Prevent card selection when clicking container
    >
      {/* Image Tab */}
      {hasImage && (
        <button
          onClick={(e) => handleClick('image', e)}
          className={`${paddingClass} rounded ${textClass} flex items-center gap-1 transition-colors ${
            activeView === 'image'
              ? 'bg-white/20 text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
          title="Show image"
          aria-label="Show image"
          aria-pressed={activeView === 'image'}
        >
          <Icons.ImageIcon size={iconSize} />
        </button>
      )}

      {/* Video Tab */}
      {showVideoTab && (
        <button
          onClick={(e) => handleClick('video', e)}
          className={`${paddingClass} rounded ${textClass} flex items-center gap-1 transition-colors ${
            activeView === 'video'
              ? 'bg-white/20 text-white'
              : 'text-white/50 hover:text-white/70'
          }`}
          title={isVideoGenerating ? 'Video generating...' : 'Show video'}
          aria-label={isVideoGenerating ? 'Video generating' : 'Show video'}
          aria-pressed={activeView === 'video'}
        >
          {isVideoGenerating ? (
            <Icons.RefreshCw size={iconSize} className="animate-spin" />
          ) : (
            <Icons.Video size={iconSize} />
          )}
        </button>
      )}
    </div>
  );
};

export default MediaToggle;
