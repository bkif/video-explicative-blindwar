import {
  BLIND_WAR_THEME,
  FONT_SANS,
  RenderContext2D,
  traceRoundedRect,
} from './theme';

export interface SubtitleCue {
  readonly startSec: number;
  readonly endSec: number;
  readonly text: string;
  readonly highlightWords?: readonly string[];
}

export interface TimelineChapterLike {
  readonly id: string;
  readonly label: string;
  readonly startFrame: number;
  readonly durationFrames: number;
  readonly cues: readonly SubtitleCue[];
}

export interface MasterTimelineLike {
  readonly fps: number;
  readonly totalFrames: number;
  readonly chapters: readonly TimelineChapterLike[];
}

/**
 * Splits a chapter narration string into balanced 1-2 line subtitle cues
 * proportionally timed across the spoken duration.
 */
export function splitNarrationIntoCues(
  narration: string,
  startSec: number,
  spokenDurationSec: number,
  highlightWords?: readonly string[],
): SubtitleCue[] {
  const clean = narration.trim().replace(/\s+/g, ' ');
  if (!clean) return [];

  // Split by major clauses first (, : . ? !)
  const rawClauses = clean
    .split(/(?<=[,:.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Merge overly short clauses or split long clauses (> 66 chars)
  const segments: string[] = [];
  for (const clause of rawClauses) {
    if (clause.length <= 66) {
      const prev = segments[segments.length - 1];
      if (prev && prev.length + 1 + clause.length <= 58 && !/[.?!:]$/.test(prev)) {
        segments[segments.length - 1] = `${prev} ${clause}`;
      } else {
        segments.push(clause);
      }
    } else {
      const words = clause.split(' ');
      const mid = Math.ceil(words.length / 2);
      segments.push(words.slice(0, mid).join(' '));
      segments.push(words.slice(mid).join(' '));
    }
  }

  const totalChars = segments.reduce((acc, seg) => acc + Math.max(1, seg.length), 0);
  const leadIn = 0.08;
  const usableDur = Math.max(1.2, spokenDurationSec - leadIn);

  let cursor = startSec + leadIn;
  return segments.map((seg, idx) => {
    const share = Math.max(1, seg.length) / totalChars;
    const segDur = usableDur * share;
    const segStart = cursor;
    const segEnd = idx === segments.length - 1 ? startSec + spokenDurationSec + 0.2 : cursor + segDur;
    cursor += segDur;
    return {
      startSec: Number(segStart.toFixed(3)),
      endSec: Number(segEnd.toFixed(3)),
      text: seg,
      highlightWords,
    };
  });
}

export function formatSrtTimestamp(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(ms === 1000 ? 999 : ms)}`;
}

export function generateSrtContent(timeline: MasterTimelineLike): string {
  const cues: SubtitleCue[] = [];
  for (const ch of timeline.chapters) {
    for (const cue of ch.cues) {
      cues.push(cue);
    }
  }

  return cues
    .map(
      (cue, idx) =>
        `${idx + 1}\n${formatSrtTimestamp(cue.startSec)} --> ${formatSrtTimestamp(cue.endSec)}\n${cue.text}\n`,
    )
    .join('\n');
}

export function getActiveSubtitleCue(
  timeline: MasterTimelineLike,
  timeSec: number,
): SubtitleCue | null {
  for (const ch of timeline.chapters) {
    for (const cue of ch.cues) {
      if (timeSec >= cue.startSec && timeSec <= cue.endSec) {
        return cue;
      }
    }
  }
  return null;
}

function wrapIntoTwoLines(
  ctx: RenderContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= 2) break;
    }
  }
  if (current && lines.length < 2) {
    lines.push(current);
  }
  return lines.slice(0, 2);
}

interface StyledToken {
  text: string;
  highlighted: boolean;
}

function tokenizeLineHighlights(
  line: string,
  highlightWords?: readonly string[],
): StyledToken[] {
  if (!highlightWords || highlightWords.length === 0) {
    return [{ text: line, highlighted: false }];
  }

  const normalizedTerms = highlightWords
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  const words = line.split(' ');
  return words.map((word, idx) => {
    const stripped = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const isHit = normalizedTerms.some(
      (term) => term === stripped || term.split(' ').includes(stripped),
    );
    return {
      text: idx < words.length - 1 ? `${word} ` : word,
      highlighted: isHit && stripped.length >= 3,
    };
  });
}

/**
 * Renders high-contrast dynamic subtitles inside a safe-zone obsidian/gold pill.
 */
export function drawSubtitleOverlay(
  ctx: RenderContext2D,
  width: number,
  height: number,
  cue: SubtitleCue | null,
  isVertical: boolean,
  enabled = true,
): void {
  if (!enabled || !cue) return;

  ctx.save();
  const fontSize = isVertical ? 26 : 25;
  ctx.font = `700 ${fontSize}px ${FONT_SANS}`;
  const maxTextW = isVertical ? width - 170 : Math.min(1180, width - 300);
  const lines = wrapIntoTwoLines(ctx, cue.text, maxTextW);
  if (lines.length === 0) {
    ctx.restore();
    return;
  }

  const lineHeights = fontSize * 1.32;
  const longestLineW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const pillW = Math.min(width - 96, Math.max(360, longestLineW + 64));
  const pillH = lines.length === 1 ? 56 : 90;

  // Safe zone positioning: above progress bar (16:9) & well above TikTok bottom UI (9:16)
  const centerY = isVertical ? height - 275 : height - 132;
  const pillX = width / 2 - pillW / 2;
  const pillY = centerY - pillH / 2;

  traceRoundedRect(ctx, pillX, pillY, pillW, pillH, 18);
  ctx.fillStyle = 'rgba(8, 6, 18, 0.92)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;

  const borderGrad = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
  borderGrad.addColorStop(0, BLIND_WAR_THEME.goldBright);
  borderGrad.addColorStop(0.5, BLIND_WAR_THEME.violetGlow);
  borderGrad.addColorStop(1, BLIND_WAR_THEME.cyanRune);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineW = ctx.measureText(line).width;
    let cursorX = width / 2 - lineW / 2;
    const lineY =
      lines.length === 1
        ? centerY + 1
        : centerY - lineHeights * 0.5 + i * lineHeights + 2;

    const tokens = tokenizeLineHighlights(line, cue.highlightWords);
    for (const token of tokens) {
      ctx.fillStyle = token.highlighted
        ? BLIND_WAR_THEME.goldBright
        : BLIND_WAR_THEME.textLight;
      ctx.fillText(token.text, cursorX, lineY);
      cursorX += ctx.measureText(token.text).width;
    }
  }

  ctx.restore();
}
