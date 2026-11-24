import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { clamp, easeInOutQuart, easeOutCubic, progress, spring } from './primitives';
import { renderFrame } from './renderer';
import { STORYBOARD_CHAPTERS, TOTAL_FRAMES, getChapterAtFrame } from './storyboard';
import { RenderContext2D, getDimensions } from './theme';

describe('BLIND WAR explainer storyboard & math', () => {
  it('covers exactly 720 contiguous frames across 5 chapters', () => {
    expect(STORYBOARD_CHAPTERS).toHaveLength(5);
    let cursor = 0;
    for (const ch of STORYBOARD_CHAPTERS) {
      expect(ch.startFrame).toBe(cursor);
      expect(ch.durationFrames).toBeGreaterThan(0);
      cursor += ch.durationFrames;
    }
    expect(cursor).toBe(TOTAL_FRAMES);
  });

  it('clamps progress and easing curves cleanly within expected bounds', () => {
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(progress(5, 10, 20)).toBe(0);
    expect(progress(20, 10, 20)).toBe(0.5);
    expect(progress(50, 10, 20)).toBe(1);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeInOutQuart(0)).toBe(0);
    expect(easeInOutQuart(1)).toBe(1);
    expect(spring(0)).toBe(0);
    expect(spring(1)).toBe(1);
  });

  it('resolves chapters safely even for out-of-range frames', () => {
    expect(getChapterAtFrame(-50).chapter.id).toBe('hook');
    expect(getChapterAtFrame(150).chapter.id).toBe('board-fog');
    expect(getChapterAtFrame(320).chapter.id).toBe('pawn-scout');
    expect(getChapterAtFrame(500).chapter.id).toBe('cards-elite');
    expect(getChapterAtFrame(9999).chapter.id).toBe('recap');
  });
});

describe('BLIND WAR deterministic canvas renderer', () => {
  it('renders identical bytes for identical frame indices in 16:9 and 9:16', () => {
    for (const aspect of ['16:9', '9:16'] as const) {
      const { width, height } = getDimensions(aspect);
      const canvasA = createCanvas(width, height);
      const canvasB = createCanvas(width, height);
      const ctxA = canvasA.getContext('2d') as unknown as RenderContext2D;
      const ctxB = canvasB.getContext('2d') as unknown as RenderContext2D;

      renderFrame(ctxA, 345, TOTAL_FRAMES, aspect);
      renderFrame(ctxB, 345, TOTAL_FRAMES, aspect);

      expect(Buffer.compare(canvasA.data(), canvasB.data())).toBe(0);
    }
  });

  it('renders non-blank distinct frames across all 5 chapters', () => {
    const { width, height } = getDimensions('16:9');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as unknown as RenderContext2D;

    const snapshots: Buffer[] = [];
    for (const ch of STORYBOARD_CHAPTERS) {
      const midFrame = ch.startFrame + Math.floor(ch.durationFrames / 2);
      renderFrame(ctx, midFrame, TOTAL_FRAMES, '16:9');
      const buf = Buffer.from(canvas.data());
      // Ensure frame is not completely empty
      const hasNonZero = buf.some((b) => b !== 0);
      expect(hasNonZero).toBe(true);
      snapshots.push(buf);
    }

    for (let i = 1; i < snapshots.length; i++) {
      expect(Buffer.compare(snapshots[i - 1]!, snapshots[i]!)).not.toBe(0);
    }
  });
});
