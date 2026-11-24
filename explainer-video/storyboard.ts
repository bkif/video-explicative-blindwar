import { clamp } from './primitives';

export const VIDEO_FPS = 30;
export const TOTAL_FRAMES = 720; // 24 seconds at 30fps

export interface StoryboardChapter {
  readonly id: 'hook' | 'board-fog' | 'pawn-scout' | 'cards-elite' | 'recap';
  readonly label: string;
  readonly headline: string;
  readonly caption: string;
  readonly startFrame: number;
  readonly durationFrames: number;
}

export const STORYBOARD_CHAPTERS: readonly StoryboardChapter[] = [
  {
    id: 'hook',
    label: '01 · DUALITY',
    headline: 'BLIND WAR',
    caption: 'Strategy, memory, bluffing & arcane powers — by MHLGames',
    startFrame: 0,
    durationFrames: 120,
  },
  {
    id: 'board-fog',
    label: '02 · 9×9 & FOG',
    headline: '9×9 GRID • HIDDEN IDENTITIES',
    caption: 'Enemies disguise as masked Pawns. Track them by memory.',
    startFrame: 120,
    durationFrames: 150,
  },
  {
    id: 'pawn-scout',
    label: '03 · PAWN SCOUT',
    headline: 'ADJACENT PAWN REVEAL',
    caption: 'Move a Pawn beside a foe to unmask its true identity.',
    startFrame: 270,
    durationFrames: 150,
  },
  {
    id: 'cards-elite',
    label: '04 · POWERS & ELITE',
    headline: 'POWER CARDS & ROYAL ELITE',
    caption: 'Trigger cooldown powers. Only King or Queen defeats the Elite.',
    startFrame: 420,
    durationFrames: 180,
  },
  {
    id: 'recap',
    label: '05 · PLAY NOW',
    headline: 'ENTER THE MASQUERADE',
    caption: '9×9 Grid • Hidden Foes • Pawn Scout • Powers • Royal Elite',
    startFrame: 600,
    durationFrames: 120,
  },
] as const;

export interface ActiveChapterState {
  chapter: StoryboardChapter;
  chapterIndex: number;
  localFrame: number;
  localProgress: number;
}

export function getChapterAtFrame(frameIndex: number): ActiveChapterState {
  const clamped = clamp(frameIndex, 0, TOTAL_FRAMES - 1e-6);
  for (let i = 0; i < STORYBOARD_CHAPTERS.length; i++) {
    const ch = STORYBOARD_CHAPTERS[i];
    if (!ch) continue;
    const end = ch.startFrame + ch.durationFrames;
    if (clamped >= ch.startFrame && clamped < end) {
      const localFrame = clamped - ch.startFrame;
      return {
        chapter: ch,
        chapterIndex: i,
        localFrame,
        localProgress: clamp(localFrame / Math.max(1, ch.durationFrames), 0, 1),
      };
    }
  }
  const fallback = STORYBOARD_CHAPTERS[STORYBOARD_CHAPTERS.length - 1]!;
  return {
    chapter: fallback,
    chapterIndex: STORYBOARD_CHAPTERS.length - 1,
    localFrame: fallback.durationFrames - 1,
    localProgress: 1,
  };
}
