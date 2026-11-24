import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderFrame } from '../../explainer-video/renderer';
import {
  MasterTimeline,
  buildDefaultMasterTimeline,
  getChapterAtFrame,
} from '../../explainer-video/storyboard';
import { AspectMode, RenderContext2D, getDimensions } from '../../explainer-video/theme';

export interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function isMasterTimeline(data: unknown): data is MasterTimeline {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Partial<MasterTimeline>;
  return (
    typeof candidate.fps === 'number' &&
    typeof candidate.totalFrames === 'number' &&
    Array.isArray(candidate.chapters) &&
    candidate.chapters.length > 0
  );
}

export function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const defaultTimeline = useMemo(() => buildDefaultMasterTimeline(), []);
  const [timeline, setTimeline] = useState<MasterTimeline>(defaultTimeline);
  const [hasAudioTrack, setHasAudioTrack] = useState<boolean>(false);

  const [aspectRatio, setAspectRatio] = useState<AspectMode>('16:9');
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return true;
    }
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const timeRef = useRef<number>(currentTimeSec);
  timeRef.current = currentTimeSec;

  const totalDurationSec = timeline.totalFrames / timeline.fps;

  // Load measured timeline JSON & check if master MP3 exists
  useEffect(() => {
    let active = true;
    fetch('/blind-war-timeline.json')
      .then(async (res) => {
        const contentType = res.headers.get('content-type') ?? '';
        if (!res.ok || !contentType.includes('application/json')) return null;
        return (await res.json()) as unknown;
      })
      .then((json) => {
        if (!active || !isMasterTimeline(json)) return;
        setTimeline(json);
        setHasAudioTrack(true);
      })
      .catch(() => {
        // Fallback smoothly to default timeline without audio file
      });

    return () => {
      active = false;
    };
  }, []);

  const drawAtTime = useCallback(
    (timeSec: number, aspect: AspectMode, subtitlesOn: boolean, tl: MasterTimeline) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { width, height } = getDimensions(aspect);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const framePos = Math.min(tl.totalFrames - 0.001, Math.max(0, timeSec * tl.fps));
      renderFrame(ctx as unknown as RenderContext2D, framePos, tl, aspect, {
        showSubtitles: subtitlesOn,
      });
    },
    [],
  );

  // Sync audio element volume & mute state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = isMuted;
    audio.volume = volume;
  }, [isMuted, volume, hasAudioTrack]);

  // Reset playback state when modal opens/closes
  useEffect(() => {
    const audio = audioRef.current;
    if (!isOpen) {
      if (audio) audio.pause();
      return;
    }
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setIsPlaying(!prefersReduced);
  }, [isOpen]);

  // Sync <audio> play/pause with React state
  useEffect(() => {
    const audio = audioRef.current;
    if (!isOpen || !hasAudioTrack || !audio) return;
    if (isPlaying) {
      if (Math.abs(audio.currentTime - timeRef.current) > 0.15) {
        audio.currentTime = timeRef.current;
      }
      void audio.play().catch(() => {
        // Browser autoplay policy may block unmuted play before user gesture; keep visual clock running
      });
    } else {
      audio.pause();
    }
  }, [isOpen, isPlaying, hasAudioTrack]);

  // Redraw whenever scrubbed time, aspect ratio, or subtitle toggle changes
  useEffect(() => {
    if (!isOpen) return;
    drawAtTime(currentTimeSec, aspectRatio, showSubtitles, timeline);
  }, [isOpen, currentTimeSec, aspectRatio, showSubtitles, timeline, drawAtTime]);

  // 60fps deterministic loop driven by <audio>.currentTime when available
  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dtSec = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      const audio = audioRef.current;
      let nextTime: number;
      if (hasAudioTrack && audio && !audio.paused && Number.isFinite(audio.currentTime)) {
        nextTime = audio.currentTime;
      } else {
        nextTime = (timeRef.current + dtSec) % totalDurationSec;
      }

      if (nextTime >= totalDurationSec) {
        nextTime = 0;
        if (audio) audio.currentTime = 0;
      }

      timeRef.current = nextTime;
      setCurrentTimeSec(nextTime);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, isPlaying, hasAudioTrack, totalDurationSec]);

  const seekToTime = useCallback(
    (targetSec: number) => {
      const clamped = Math.max(0, Math.min(totalDurationSec - 0.05, targetSec));
      timeRef.current = clamped;
      setCurrentTimeSec(clamped);
      const audio = audioRef.current;
      if (audio && hasAudioTrack) {
        audio.currentTime = clamped;
      }
    },
    [hasAudioTrack, totalDurationSec],
  );

  // Keyboard shortcuts: Space, M, C, ArrowLeft, ArrowRight, Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' && event.key !== 'Escape') return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === ' ') {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        setIsMuted((prev) => !prev);
      } else if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        setShowSubtitles((prev) => !prev);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seekToTime(timeRef.current - 1.5);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        seekToTime(timeRef.current + 1.5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, seekToTime]);

  if (!isOpen) return null;

  const activeChapter = getChapterAtFrame(currentTimeSec * timeline.fps, timeline);

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
        {hasAudioTrack ? (
          <audio
            ref={audioRef}
            src="/blind-war-audio.mp3"
            preload="auto"
            onEnded={() => seekToTime(0)}
          />
        ) : null}

        <div className="bw-modal-top">
          <div>
            <h2 id="bw-modal-heading" className="bw-modal-title">
              Comment jouer à BLIND WAR — Tutoriel Vidéo
            </h2>
          </div>
          <div className="bw-control-group">
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label="Afficher au format 16:9 paysage"
              aria-pressed={aspectRatio === '16:9'}
              onClick={() => setAspectRatio('16:9')}
            >
              16:9 Web
            </button>
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label="Afficher au format 9:16 vertical TikTok"
              aria-pressed={aspectRatio === '9:16'}
              onClick={() => setAspectRatio('9:16')}
            >
              9:16 TikTok
            </button>
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label="Fermer la fenêtre tutoriel"
              onClick={onClose}
            >
              Fermer (Esc)
            </button>
          </div>
        </div>

        <div className="bw-stage">
          <canvas
            ref={canvasRef}
            className="bw-canvas"
            aria-label="Lecteur vidéo interactif BLIND WAR"
          />
        </div>

        <input
          type="range"
          className="bw-scrubber"
          min={0}
          max={Math.max(1, Math.floor(totalDurationSec * 10))}
          step={1}
          value={Math.floor(currentTimeSec * 10)}
          aria-label="Barre de progression de la vidéo"
          onChange={(e) => seekToTime(Number(e.target.value) / 10)}
        />

        <div className="bw-controls-row">
          <div className="bw-control-group">
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label={isPlaying ? 'Mettre en pause' : 'Lire la vidéo'}
              aria-pressed={isPlaying}
              onClick={() => setIsPlaying((prev) => !prev)}
            >
              {isPlaying ? 'Pause (Espace)' : 'Lecture (Espace)'}
            </button>
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label="Redémarrer au début"
              onClick={() => seekToTime(0)}
            >
              Début
            </button>
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label={showSubtitles ? 'Masquer les sous-titres' : 'Afficher les sous-titres'}
              aria-pressed={showSubtitles}
              onClick={() => setShowSubtitles((prev) => !prev)}
            >
              CC (C)
            </button>
            <button
              type="button"
              className="bw-ctrl-btn"
              aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
              aria-pressed={isMuted}
              onClick={() => setIsMuted((prev) => !prev)}
            >
              {isMuted ? 'Muet (M)' : 'Son (M)'}
            </button>
            <label className="bw-volume-wrap" aria-label="Volume audio">
              <input
                type="range"
                className="bw-volume-slider"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                aria-label="Réglage du volume"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  if (v > 0 && isMuted) setIsMuted(false);
                }}
              />
            </label>
          </div>
          <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
            {activeChapter.chapter.label} · {Math.floor(currentTimeSec)}s /{' '}
            {Math.ceil(totalDurationSec)}s
            {hasAudioTrack ? ' · Audio FR' : ''}
          </span>
        </div>

        <div className="bw-chapters-row" role="group" aria-label="Chapitres du tutoriel">
          {timeline.chapters.map((ch, idx) => {
            const targetSec = ch.startFrame / timeline.fps;
            const isCurrent = activeChapter.chapterIndex === idx;
            return (
              <button
                key={ch.id}
                type="button"
                className="bw-ctrl-btn"
                aria-label={`Aller au chapitre ${ch.label}`}
                aria-pressed={isCurrent}
                onClick={() => seekToTime(targetSec)}
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
