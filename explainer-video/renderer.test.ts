import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_SAMPLE_RATE,
  computeVoiceDuckGain,
  encodeStereoPcmWav,
  synthesizeProceduralBedAndSfx,
} from './audio';
import { clamp, easeInOutQuart, easeOutCubic, spring } from './primitives';
import { renderFrame } from './renderer';
import {
  STORYBOARD_CHAPTERS,
  VIDEO_FPS,
  buildDefaultMasterTimeline,
  getChapterAtFrame,
  resolveMasterTimeline,
} from './storyboard';
import {
  formatSrtTimestamp,
  generateSrtContent,
  getActiveSubtitleCue,
  splitNarrationIntoCues,
} from './subtitles';
import { RenderContext2D, getDimensions } from './theme';

describe('BLIND WAR dynamic storyboard & subtitles', () => {
  it('resolves contiguous chapter frames adapted to TTS durations + buffer', () => {
    const measured = [5.2, 6.4, 5.8, 7.1, 4.0];
    const timeline = resolveMasterTimeline(measured, { fps: VIDEO_FPS });

    expect(timeline.chapters).toHaveLength(5);
    let cursor = 0;
    for (let i = 0; i < timeline.chapters.length; i++) {
      const ch = timeline.chapters[i]!;
      expect(ch.startFrame).toBe(cursor);
      expect(ch.durationFrames).toBeGreaterThanOrEqual(Math.ceil((measured[i]! + 0.5) * VIDEO_FPS));
      expect(ch.cues.length).toBeGreaterThan(0);
      cursor += ch.durationFrames;
    }
    expect(cursor).toBe(timeline.totalFrames);
  });

  it('generates valid SRT timestamps and active subtitle cues', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(65.432)).toBe('00:01:05,432');

    const cues = splitNarrationIntoCues(
      STORYBOARD_CHAPTERS[0]!.narration,
      0,
      6.5,
      STORYBOARD_CHAPTERS[0]!.highlightWords,
    );
    expect(cues.length).toBeGreaterThanOrEqual(2);
    expect(cues[0]!.startSec).toBeGreaterThanOrEqual(0);
    expect(cues[cues.length - 1]!.endSec).toBeGreaterThan(6.0);

    const timeline = buildDefaultMasterTimeline();
    const srt = generateSrtContent(timeline);
    expect(srt).toContain('00:00:00,');
    expect(srt).toContain('Blind War');

    const firstCue = timeline.chapters[0]!.cues[0]!;
    const active = getActiveSubtitleCue(timeline, (firstCue.startSec + firstCue.endSec) / 2);
    expect(active?.text).toBe(firstCue.text);
  });

  it('clamps easing curves and resolves out-of-range frames safely', () => {
    expect(clamp(-2, 0, 1)).toBe(0);
    expect(clamp(3, 0, 1)).toBe(1);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeInOutQuart(0)).toBe(0);
    expect(easeInOutQuart(1)).toBe(1);
    expect(spring(0)).toBe(0);
    expect(spring(1)).toBe(1);

    const timeline = buildDefaultMasterTimeline();
    expect(getChapterAtFrame(-50, timeline).chapter.id).toBe('hook');
    expect(getChapterAtFrame(timeline.totalFrames + 500, timeline).chapter.id).toBe('recap');
  });
});

describe('BLIND WAR procedural audio synthesizer & voice ducking', () => {
  it('ducks ambient music smoothly during narration windows', () => {
    const windows = [{ startSec: 1.0, endSec: 3.0 }];
    expect(computeVoiceDuckGain(0.2, windows)).toBe(1);
    expect(computeVoiceDuckGain(2.0, windows)).toBeLessThan(0.3);
    expect(computeVoiceDuckGain(4.0, windows)).toBe(1);
  });

  it('synthesizes finite stereo PCM samples and valid RIFF WAV header', () => {
    const shortTimeline = resolveMasterTimeline([1.5, 1.5, 1.5, 1.5, 1.5], { fps: 10 });
    const { left, right } = synthesizeProceduralBedAndSfx(shortTimeline);
    const expectedSamples = Math.round((shortTimeline.totalFrames / shortTimeline.fps) * AUDIO_SAMPLE_RATE);

    expect(left.length).toBe(expectedSamples);
    expect(right.length).toBe(expectedSamples);
    expect(left.some((v) => Math.abs(v) > 0.001)).toBe(true);

    const wav = encodeStereoPcmWav(left.subarray(0, 1000), right.subarray(0, 1000));
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.length).toBe(44 + 1000 * 4);
  });
});

describe('BLIND WAR deterministic renderer with subtitles', () => {
  it('renders identical bytes for identical frame indices in 16:9 and 9:16', () => {
    const timeline = buildDefaultMasterTimeline();
    for (const aspect of ['16:9', '9:16'] as const) {
      const { width, height } = getDimensions(aspect);
      const canvasA = createCanvas(width, height);
      const canvasB = createCanvas(width, height);
      const ctxA = canvasA.getContext('2d') as unknown as RenderContext2D;
      const ctxB = canvasB.getContext('2d') as unknown as RenderContext2D;

      const sampleFrame = timeline.chapters[2]!.startFrame + 60;
      renderFrame(ctxA, sampleFrame, timeline, aspect, { showSubtitles: true });
      renderFrame(ctxB, sampleFrame, timeline, aspect, { showSubtitles: true });

      expect(Buffer.compare(canvasA.data(), canvasB.data())).toBe(0);
    }
  });

  it('renders distinct frames across chapters and toggles subtitles visually', () => {
    const timeline = buildDefaultMasterTimeline();
    const { width, height } = getDimensions('16:9');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as unknown as RenderContext2D;

    const firstCue = timeline.chapters[0]!.cues[0]!;
    const cueFrame = Math.floor(((firstCue.startSec + firstCue.endSec) / 2) * timeline.fps);

    renderFrame(ctx, cueFrame, timeline, '16:9', { showSubtitles: true });
    const withSubs = Buffer.from(canvas.data());

    renderFrame(ctx, cueFrame, timeline, '16:9', { showSubtitles: false });
    const withoutSubs = Buffer.from(canvas.data());

    expect(Buffer.compare(withSubs, withoutSubs)).not.toBe(0);
  });
});
