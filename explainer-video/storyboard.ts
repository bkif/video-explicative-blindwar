import { clamp } from './primitives';
import { SubtitleCue, splitNarrationIntoCues } from './subtitles';

export type { SubtitleCue };

export const VIDEO_FPS = 30;
export const CHAPTER_BUFFER_SECONDS = 0.55;
export const MIN_CHAPTER_SECONDS = 4.2;

export type ChapterId = 'hook' | 'board-fog' | 'pawn-scout' | 'cards-elite' | 'recap';

export interface StoryboardChapterSpec {
  readonly id: ChapterId;
  readonly label: string;
  readonly headline: string;
  readonly caption: string;
  readonly narration: string;
  readonly highlightWords: readonly string[];
  readonly defaultSpokenSec: number;
}

export interface ResolvedChapter {
  readonly id: ChapterId;
  readonly label: string;
  readonly headline: string;
  readonly caption: string;
  readonly narration: string;
  readonly startFrame: number;
  readonly durationFrames: number;
  readonly spokenDurationSec: number;
  readonly cues: readonly SubtitleCue[];
}

export interface MasterTimeline {
  readonly fps: number;
  readonly totalFrames: number;
  readonly chapters: readonly ResolvedChapter[];
  readonly masterAudioPath: string;
  readonly srtPath: string;
}

export const STORYBOARD_CHAPTERS: readonly StoryboardChapterSpec[] = [
  {
    id: 'hook',
    label: '01 · DUALITÉ',
    headline: 'BLIND WAR',
    caption: 'Stratégie, mémoire, bluff & pouvoirs — par MHLGames',
    narration:
      "Bienvenue dans Blind War, par MHLGames. Un jeu d'échecs tactique où bluff, mémoire et pouvoirs renversent chaque partie.",
    highlightWords: ['Blind War', 'MHLGames', 'bluff', 'mémoire', 'pouvoirs'],
    defaultSpokenSec: 6.8,
  },
  {
    id: 'board-fog',
    label: '02 · 9×9 & MASQUES',
    headline: 'ÉCHIQUIER 9×9 • PIÈCES MASQUÉES',
    caption: "À l'aveugle : les ennemis semblent être de simples pions.",
    narration:
      "Sur un échiquier neuf par neuf, vos pièces sont masquées aux yeux de l'adversaire : une Reine peut se cacher sous l'apparence d'un simple pion.",
    highlightWords: ['neuf par neuf', 'masquées', 'Reine', 'pion'],
    defaultSpokenSec: 7.4,
  },
  {
    id: 'pawn-scout',
    label: '03 · PION COLLÉ',
    headline: 'RÉVÉLATION PAR PION COLLÉ',
    caption: 'Collez un pion à un ennemi pour révéler sa vraie identité.',
    narration:
      "Collez l'un de vos pions contre une pièce ennemie pour lever son masque et révéler sa vraie nature tant qu'il reste au contact.",
    highlightWords: ['pions', 'masque', 'révéler', 'contact'],
    defaultSpokenSec: 6.9,
  },
  {
    id: 'cards-elite',
    label: '04 · POUVOIRS & ÉLITE',
    headline: 'POUVOIRS & PIÈCE ÉLITE',
    caption: 'Cartes à cooldown. Seul le Roi ou la Reine élimine l’Élite.',
    narration:
      "Déclenchez des cartes de pouvoirs à temps de recharge pour inverser le destin, et traquez la pièce élite, éliminable uniquement par le Roi ou la Reine.",
    highlightWords: ['pouvoirs', 'recharge', 'pièce élite', 'Roi', 'Reine'],
    defaultSpokenSec: 8.6,
  },
  {
    id: 'recap',
    label: '05 · JOUER',
    headline: 'PERCEZ LE MASQUE',
    caption: '9×9 • Pièces masquées • Pion collé • Pouvoirs • Élite Royale',
    narration:
      'Stratégie, mémoire et bluff : saurez-vous percer le masque dans Blind War ?',
    highlightWords: ['Stratégie', 'mémoire', 'bluff', 'Blind War'],
    defaultSpokenSec: 4.8,
  },
] as const;

export function resolveMasterTimeline(
  spokenDurationsSec: readonly number[],
  options: {
    fps?: number;
    masterAudioPath?: string;
    srtPath?: string;
  } = {},
): MasterTimeline {
  const fps = options.fps ?? VIDEO_FPS;
  const masterAudioPath = options.masterAudioPath ?? 'public/blind-war-audio.mp3';
  const srtPath = options.srtPath ?? 'public/blind-war-how-to-play.srt';

  let cursorFrame = 0;
  const chapters: ResolvedChapter[] = STORYBOARD_CHAPTERS.map((spec, idx) => {
    const measured = spokenDurationsSec[idx];
    const spokenSec =
      typeof measured === 'number' && Number.isFinite(measured) && measured > 0
        ? measured
        : spec.defaultSpokenSec;
    const totalChapterSec = Math.max(MIN_CHAPTER_SECONDS, spokenSec + CHAPTER_BUFFER_SECONDS);
    const durationFrames = Math.ceil(totalChapterSec * fps);
    const startSec = cursorFrame / fps;

    const cues = splitNarrationIntoCues(
      spec.narration,
      startSec,
      spokenSec,
      spec.highlightWords,
    );

    const resolved: ResolvedChapter = {
      id: spec.id,
      label: spec.label,
      headline: spec.headline,
      caption: spec.caption,
      narration: spec.narration,
      startFrame: cursorFrame,
      durationFrames,
      spokenDurationSec: spokenSec,
      cues,
    };

    cursorFrame += durationFrames;
    return resolved;
  });

  return {
    fps,
    totalFrames: cursorFrame,
    chapters,
    masterAudioPath,
    srtPath,
  };
}

export function buildDefaultMasterTimeline(fps = VIDEO_FPS): MasterTimeline {
  return resolveMasterTimeline(
    STORYBOARD_CHAPTERS.map((ch) => ch.defaultSpokenSec),
    { fps },
  );
}

export interface ActiveChapterState {
  chapter: ResolvedChapter;
  chapterIndex: number;
  localFrame: number;
  localProgress: number;
}

export function getChapterAtFrame(
  frameIndex: number,
  timeline: MasterTimeline,
): ActiveChapterState {
  const clamped = clamp(frameIndex, 0, Math.max(0.0001, timeline.totalFrames - 1e-6));
  for (let i = 0; i < timeline.chapters.length; i++) {
    const ch = timeline.chapters[i];
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
  const fallback = timeline.chapters[timeline.chapters.length - 1]!;
  return {
    chapter: fallback,
    chapterIndex: timeline.chapters.length - 1,
    localFrame: fallback.durationFrames - 1,
    localProgress: 1,
  };
}
