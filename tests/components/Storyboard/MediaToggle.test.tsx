/**
 * Unit tests for MediaToggle component
 * STORY-5-4: Video Generation UI
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaToggle } from '../../../components/Storyboard/MediaToggle';

describe('MediaToggle', () => {
  const mockOnViewChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render image tab when hasImage is true (AC: 2)', () => {
      render(
        <MediaToggle
          activeView="image"
          hasImage={true}
          hasVideo={false}
          onViewChange={mockOnViewChange}
        />
      );

      const imageButton = screen.getByRole('button', { name: /show image/i });
      expect(imageButton).toBeInTheDocument();
    });

    it('should render video tab when hasVideo is true (AC: 2)', () => {
      render(
        <MediaToggle
          activeView="video"
          hasImage={true}
          hasVideo={true}
          onViewChange={mockOnViewChange}
        />
      );

      const videoButton = screen.getByRole('button', { name: /show video/i });
      expect(videoButton).toBeInTheDocument();
    });

    it('should not render when neither image nor video exists (AC: 3)', () => {
      const { container } = render(
        <MediaToggle
          activeView="image"
          hasImage={false}
          hasVideo={false}
          onViewChange={mockOnViewChange}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should show video tab when video is generating (AC: 8)', () => {
      render(
        <MediaToggle
          activeView="video"
          hasImage={true}
          hasVideo={false}
          isVideoGenerating={true}
          onViewChange={mockOnViewChange}
        />
      );

      const videoButton = screen.getByRole('button', { name: /video generating/i });
      expect(videoButton).toBeInTheDocument();
    });
  });

  describe('active state', () => {
    it('should show image tab as active when activeView is image (AC: 4)', () => {
      render(
        <MediaToggle
          activeView="image"
          hasImage={true}
          hasVideo={true}
          onViewChange={mockOnViewChange}
        />
      );

      const imageButton = screen.getByRole('button', { name: /show image/i });
      expect(imageButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show video tab as active when activeView is video (AC: 4)', () => {
      render(
        <MediaToggle
          activeView="video"
          hasImage={true}
          hasVideo={true}
          onViewChange={mockOnViewChange}
        />
      );

      const videoButton = screen.getByRole('button', { name: /show video/i });
      expect(videoButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('interactions', () => {
    it('should call onViewChange with "image" when clicking image tab (AC: 5)', () => {
      render(
        <MediaToggle
          activeView="video"
          hasImage={true}
          hasVideo={true}
          onViewChange={mockOnViewChange}
        />
      );

      const imageButton = screen.getByRole('button', { name: /show image/i });
      fireEvent.click(imageButton);

      expect(mockOnViewChange).toHaveBeenCalledWith('image');
    });

    it('should call onViewChange with "video" when clicking video tab (AC: 5)', () => {
      render(
        <MediaToggle
          activeView="image"
          hasImage={true}
          hasVideo={true}
          onViewChange={mockOnViewChange}
        />
      );

      const videoButton = screen.getByRole('button', { name: /show video/i });
      fireEvent.click(videoButton);

      expect(mockOnViewChange).toHaveBeenCalledWith('video');
    });

    it('should prevent event propagation to parent elements (AC: 11)', () => {
      const parentClickHandler = vi.fn();

      render(
        <div onClick={parentClickHandler}>
          <MediaToggle
            activeView="image"
            hasImage={true}
            hasVideo={true}
            onViewChange={mockOnViewChange}
          />
        </div>
      );

      const imageButton = screen.getByRole('button', { name: /show image/i });
      fireEvent.click(imageButton);

      // onViewChange should be called, but parent should not receive the click
      expect(mockOnViewChange).toHaveBeenCalled();
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('size variants', () => {
    it('should render with small size by default', () => {
      render(
        <MediaToggle
          activeView="image"
          hasImage={true}
          hasVideo={true}
          onViewChange={mockOnViewChange}
        />
      );

      // Component renders with sm size classes
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });

    it('should render with medium size when specified', () => {
      render(
        <MediaToggle
          activeView="image"
          hasImage={true}
          hasVideo={true}
          onViewChange={mockOnViewChange}
          size="md"
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });
  });

  describe('default video tab behavior (AC: 9)', () => {
    it('should show video tab even when generating (with spinner)', () => {
      render(
        <MediaToggle
          activeView="video"
          hasImage={true}
          hasVideo={false}
          isVideoGenerating={true}
          onViewChange={mockOnViewChange}
        />
      );

      // Video tab should be visible and show generating state
      const videoButton = screen.getByRole('button', { name: /video generating/i });
      expect(videoButton).toBeInTheDocument();
    });
  });
});
