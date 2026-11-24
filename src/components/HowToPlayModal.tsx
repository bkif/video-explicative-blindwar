import { useCallback, useEffect, useRef, useState } from 'react';
import { renderFrame } from '../../explainer-video/renderer';
import {
  STORYBOARD_CHAPTERS,
  TOTAL_FRAMES,
  VIDEO_FPS,
  getChapterAtFrame,
} from '../../explainer-video/storyboard';
import { AspectMode, RenderContext2D, getDimensions } from '../../explainer-video/theme';

export interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DURATION_SECONDS = TOTAL_FRAMES / VIDEO_FPS;
const PLAYBACK_FPS = 60;
const PLAYBACK_TOTAL_FRAMES = DURATION_SECONDS * PLAYBACK_FPS;

export function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectMode>('16:9');
  const [framePos, setFramePos] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const frameRef = useRef<number>(framePos);
  frameRef.current = framePos;

  const drawCurrentFrame = useCallback(
    (frameVal: number, aspect: AspectMode) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width, height } = getDimensions(aspect);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderFrame(
        ctx as unknown as RenderContext2D,
        frameVal,
        PLAYBACK_TOTAL_FRAMES,
        aspect,
      );
    },
    [],
  );

  // Sync canvas immediately when aspect ratio, open state, or scrubbed frame changes
  useEffect(() => {
    if (!isOpen) return;
    drawCurrentFrame(framePos, aspectRatio);
  }, [isOpen, framePos, aspectRatio, drawCurrentFrame]);

  // Reset play state cleanly when reopened (respecting prefers-reduced-motion)
  useEffect(() => {
    if (!isOpen) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setIsPlaying(!prefersReduced);
  }, [isOpen]);

  // 60fps requestAnimationFrame deterministic loop
  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dtSec = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;
      const next = (frameRef.current + dtSec * PLAYBACK_FPS) % PLAYBACK_TOTAL_FRAMES;
      frameRef.current = next;
      setFramePos(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, isPlaying]);

  // Keyboard navigation: Space, ArrowLeft, ArrowRight, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === ' ') {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setFramePos((prev) => Math.max(0, prev - PLAYBACK_FPS));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setFramePos((prev) =>
          Math.min(PLAYBACK_TOTAL_FRAMES - 1, prev + PLAYBACK_FPS),
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalized30FpsFrame = (framePos / PLAYBACK_TOTAL_FRAMES) * TOTAL_FRAMES;
  const activeChapter = getChapterAtFrame(normalized30FpsFrame);
  const currentSec = Math.floor(framePos / PLAYBACK_FPS);

  return (
    <div
      className="bw-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bw-modal-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bw-modal-panel">
        <div className="bw-modal-top">
          <div>
            <h2 id="bw-modal-heading" className="bw-modal-title">
              How to Play BLIND WAR — Interactive Explainer
            </h2>
          </div>
          <div className="bw-control-group">
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label="Switch to 16:9 landscape aspect ratio"
              aria-pressed={aspectRatio === '16:9'}
              onClick={() => setAspectRatio('16:9')}
            >
              16:9 Web
            </button>
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label="Switch to 9:16 vertical TikTok aspect ratio"
              aria-pressed={aspectRatio === '9:16'}
              onClick={() => setAspectRatio('9:16')}
            >
              9:16 TikTok
            </button>
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label="Close How to Play modal"
              onClick={onClose}
            >
              Close (Esc)
            </button>
          </div>
        </div>

        <div className="bw-stage">
          <canvas
            ref={canvasRef}
            className="bw-canvas"
            aria-label="BLIND WAR animated tutorial canvas"
          />
        </div>

        <input
          type="range"
          className="bw-scrubber"
          min={0}
          max={PLAYBACK_TOTAL_FRAMES - 1}
          step={1}
          value={Math.floor(framePos)}
          aria-label="Seek explainer timeline"
          onChange={(e) => {
            setFramePos(Number(e.target.value));
          }}
        />

        <div className="bw-controls-row">
          <div className="bw-control-group">
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label={isPlaying ? 'Pause explainer' : 'Play explainer'}
              aria-pressed={isPlaying}
              onClick={() => setIsPlaying((prev) => !prev)}
            >
              {isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            </button>
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label="Restart explainer from beginning"
              onClick={() => setFramePos(0)}
            >
              Restart
            </button>
          </div>
          <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
            {activeChapter.chapter.label} · {currentSec}s / {DURATION_SECONDS}s
          </span>
        </div>

        <div className="bw-chapters-row" role="group" aria-label="Explainer chapters">
          {STORYBOARD_CHAPTERS.map((ch, idx) => {
            const target60FpsFrame = (ch.startFrame / TOTAL_FRAMES) * PLAYBACK_TOTAL_FRAMES;
            const isCurrent = activeChapter.chapterIndex === idx;
            return (
              <button
                key={ch.id}
                type="button"
                className="bw-ctrl-btn"
                aria-label={`Jump to chapter ${ch.label}`}
                aria-pressed={isCurrent}
                onClick={() => setFramePos(target60FpsFrame)}
              >
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
