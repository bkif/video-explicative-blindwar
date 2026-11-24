import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  MasterTimeline,
  STORYBOARD_CHAPTERS,
  VIDEO_FPS,
  resolveMasterTimeline,
} from './storyboard';

export const AUDIO_SAMPLE_RATE = 44100;

export interface VoiceClipResult {
  readonly chapterId: string;
  readonly filePath: string;
  readonly durationSec: number;
  readonly engine: 'edge-tts' | 'espeak-ng' | 'silent-fallback';
}

export interface AudioBuildResult {
  readonly timeline: MasterTimeline;
  readonly masterWavPath: string;
  readonly browserMp3Path: string;
  readonly clips: readonly VoiceClipResult[];
}

export function probeAudioDuration(filePath: string): number | null {
  const res = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ],
    { encoding: 'utf8', timeout: 8000 },
  );
  if (res.status !== 0 || !res.stdout) return null;
  const parsed = Number.parseFloat(res.stdout.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Encodes stereo [-1, 1] Float32 channels into a standard 16-bit PCM WAV Buffer.
 */
export function encodeStereoPcmWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate = AUDIO_SAMPLE_RATE,
): Buffer {
  const numSamples = Math.min(left.length, right.length);
  const dataBytes = numSamples * 4; // 2 channels * 2 bytes
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // PCM format
  buf.writeUInt16LE(2, 22); // Stereo
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28); // Byte rate
  buf.writeUInt16LE(4, 32); // Block align
  buf.writeUInt16LE(16, 34); // Bits per sample
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataBytes, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i] ?? 0));
    const r = Math.max(-1, Math.min(1, right[i] ?? 0));
    buf.writeInt16LE(Math.round(l * 32767), offset);
    buf.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }

  return buf;
}

function writeSilentWav(filePath: string, durationSec: number): void {
  const samples = Math.max(1, Math.round(durationSec * AUDIO_SAMPLE_RATE));
  const empty = new Float32Array(samples);
  writeFileSync(filePath, encodeStereoPcmWav(empty, empty, AUDIO_SAMPLE_RATE));
}

function synthesizeSingleChapterVoice(
  narration: string,
  chapterId: string,
  defaultDurationSec: number,
  tempDir: string,
  voiceName: string,
): VoiceClipResult {
  const mp3Path = path.join(tempDir, `voice-${chapterId}.mp3`);
  const wavPath = path.join(tempDir, `voice-${chapterId}.wav`);

  // 1. Primary: edge-tts neural French voice
  const edgeRes = spawnSync(
    'edge-tts',
    ['--voice', voiceName, '--rate=+4%', '--text', narration, '--write-media', mp3Path],
    { encoding: 'utf8', timeout: 15000 },
  );

  if (edgeRes.status === 0 && existsSync(mp3Path)) {
    const dur = probeAudioDuration(mp3Path);
    if (dur !== null) {
      return {
        chapterId,
        filePath: mp3Path,
        durationSec: dur,
        engine: 'edge-tts',
      };
    }
  }

  // 2. Fallback: local espeak-ng French voice
  const espeakRes = spawnSync(
    'espeak-ng',
    ['-v', 'fr', '-s', '155', '-w', wavPath, narration],
    { encoding: 'utf8', timeout: 10000 },
  );

  if (espeakRes.status === 0 && existsSync(wavPath)) {
    const dur = probeAudioDuration(wavPath);
    if (dur !== null) {
      return {
        chapterId,
        filePath: wavPath,
        durationSec: dur,
        engine: 'espeak-ng',
      };
    }
  }

  // 3. Offline silent timing fallback
  writeSilentWav(wavPath, defaultDurationSec);
  return {
    chapterId,
    filePath: wavPath,
    durationSec: defaultDurationSec,
    engine: 'silent-fallback',
  };
}

// Deterministic pseudo-random noise generator for procedural whooshes & clicks
function deterministicNoise(index: number): number {
  const x = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function addToneBurst(
  left: Float32Array,
  right: Float32Array,
  startSec: number,
  durationSec: number,
  freqHz: number,
  gain: number,
  pan = 0, // -1 left .. +1 right
  harmonicMix = 0.25,
): void {
  const startIdx = Math.max(0, Math.round(startSec * AUDIO_SAMPLE_RATE));
  const count = Math.round(durationSec * AUDIO_SAMPLE_RATE);
  const leftGain = gain * Math.sqrt((1 - pan) * 0.5);
  const rightGain = gain * Math.sqrt((1 + pan) * 0.5);

  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    if (idx >= left.length) break;
    const t = i / AUDIO_SAMPLE_RATE;
    const norm = i / Math.max(1, count);
    const attack = Math.min(1, t / 0.012);
    const decay = Math.exp(-norm * 4.5);
    const env = attack * decay;
    const wave =
      Math.sin(2 * Math.PI * freqHz * t) +
      harmonicMix * Math.sin(2 * Math.PI * freqHz * 2 * t) * 0.5;
    left[idx] = (left[idx] ?? 0) + wave * env * leftGain;
    right[idx] = (right[idx] ?? 0) + wave * env * rightGain;
  }
}

function addChessClick(
  left: Float32Array,
  right: Float32Array,
  atSec: number,
  gain = 0.24,
  pan = 0,
): void {
  const startIdx = Math.max(0, Math.round(atSec * AUDIO_SAMPLE_RATE));
  const count = Math.round(0.055 * AUDIO_SAMPLE_RATE);
  const lGain = gain * (1 - Math.max(0, pan) * 0.4);
  const rGain = gain * (1 + Math.min(0, pan) * 0.4);

  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    if (idx >= left.length) break;
    const t = i / AUDIO_SAMPLE_RATE;
    const env = Math.exp(-t * 85);
    const thud = Math.sin(2 * Math.PI * (240 - t * 1800) * t);
    const snap = deterministicNoise(idx) * Math.exp(-t * 160) * 0.45;
    const sample = (thud * 0.75 + snap) * env;
    left[idx] = (left[idx] ?? 0) + sample * lGain;
    right[idx] = (right[idx] ?? 0) + sample * rGain;
  }
}

function addWhooshSweep(
  left: Float32Array,
  right: Float32Array,
  startSec: number,
  durationSec: number,
  gain = 0.14,
): void {
  const startIdx = Math.max(0, Math.round(startSec * AUDIO_SAMPLE_RATE));
  const count = Math.round(durationSec * AUDIO_SAMPLE_RATE);
  let lp = 0;

  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    if (idx >= left.length) break;
    const norm = i / Math.max(1, count);
    const env = Math.sin(Math.PI * norm);
    const alpha = 0.04 + 0.18 * Math.sin(Math.PI * norm);
    const noise = deterministicNoise(idx + 917);
    lp = lp + alpha * (noise - lp);
    const sample = lp * env * gain;
    left[idx] = (left[idx] ?? 0) + sample * (1 - norm * 0.2);
    right[idx] = (right[idx] ?? 0) + sample * (0.8 + norm * 0.2);
  }
}

export function computeVoiceDuckGain(
  timeSec: number,
  speechWindows: ReadonlyArray<{ startSec: number; endSec: number }>,
): number {
  const fadeTime = 0.2;
  const duckFloor = 0.26;
  let minGain = 1;

  for (const win of speechWindows) {
    if (timeSec >= win.startSec - fadeTime && timeSec <= win.endSec + fadeTime) {
      if (timeSec < win.startSec) {
        const t = (timeSec - (win.startSec - fadeTime)) / fadeTime;
        const g = 1 - (1 - duckFloor) * (0.5 - 0.5 * Math.cos(Math.PI * t));
        minGain = Math.min(minGain, g);
      } else if (timeSec > win.endSec) {
        const t = (timeSec - win.endSec) / fadeTime;
        const g = duckFloor + (1 - duckFloor) * (0.5 - 0.5 * Math.cos(Math.PI * t));
        minGain = Math.min(minGain, g);
      } else {
        minGain = Math.min(minGain, duckFloor);
      }
    }
  }

  return minGain;
}

/**
 * Generates deterministic stereo PCM WAV containing:
 * - Split-duality ambient music (Left harmonic temple chimes + Right cosmic synth pulse)
 * - Synced tactical SFX (chess clicks, mask shimmer, scanner ping, card flip, shield clang)
 * - Smooth automatic voice-ducking during narration intervals
 */
export function synthesizeProceduralBedAndSfx(timeline: MasterTimeline): {
  left: Float32Array;
  right: Float32Array;
} {
  const totalSec = timeline.totalFrames / timeline.fps;
  const numSamples = Math.max(1, Math.round(totalSec * AUDIO_SAMPLE_RATE));
  const musicLeft = new Float32Array(numSamples);
  const musicRight = new Float32Array(numSamples);
  const sfxLeft = new Float32Array(numSamples);
  const sfxRight = new Float32Array(numSamples);

  const speechWindows = timeline.chapters.map((ch) => ({
    startSec: ch.startFrame / timeline.fps,
    endSec: ch.startFrame / timeline.fps + ch.spokenDurationSec,
  }));

  // 1. Dual-world ambient music bed
  const arpNotes = [293.66, 440.0, 587.33, 659.25, 440.0, 369.99]; // D4, A4, D5, E5, A4, F#4
  const stepDur = 0.5;
  for (let i = 0; i < numSamples; i++) {
    const t = i / AUDIO_SAMPLE_RATE;
    const fadeIn = Math.min(1, t / 0.8);
    const fadeOut = Math.min(1, Math.max(0, (totalSec - t) / 1.0));
    const duck = computeVoiceDuckGain(t, speechWindows);
    const masterEnv = fadeIn * fadeOut * duck;

    // Warm obsidian sub-bass drone (D2 + A1 pulse)
    const bassFreq = t % 8 < 4 ? 73.42 : 55.0;
    const bassPulse = 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.5 * t);
    const bass =
      (Math.sin(2 * Math.PI * bassFreq * t) * 0.75 +
        Math.sin(2 * Math.PI * bassFreq * 2 * t) * 0.2) *
      0.16 *
      bassPulse;

    // Soft arpeggiated chime pulse (BLIND left warmth / WAR right shimmer)
    const stepIdx = Math.floor(t / stepDur);
    const localStepT = t - stepIdx * stepDur;
    const noteHz = arpNotes[stepIdx % arpNotes.length] ?? 440;
    const chimeEnv = Math.exp(-localStepT * 5.2);
    const chime = Math.sin(2 * Math.PI * noteHz * t) * chimeEnv * 0.085;
    const pan = stepIdx % 2 === 0 ? -0.35 : 0.35;

    musicLeft[i] = (bass + chime * (1 - pan * 0.5)) * masterEnv;
    musicRight[i] = (bass + chime * (1 + pan * 0.5)) * masterEnv;
  }

  // 2. Synced tactical SFX per chapter
  for (const ch of timeline.chapters) {
    const s = ch.startFrame / timeline.fps;
    const d = ch.durationFrames / timeline.fps;

    if (ch.id === 'hook') {
      addWhooshSweep(sfxLeft, sfxRight, s + 0.05, 1.1, 0.16);
      addToneBurst(sfxLeft, sfxRight, s + 0.35, 1.4, 293.66, 0.16, -0.4);
      addToneBurst(sfxLeft, sfxRight, s + 0.42, 1.4, 440.0, 0.14, 0.4);
      addToneBurst(sfxLeft, sfxRight, s + 0.5, 1.5, 587.33, 0.12, 0);
    } else if (ch.id === 'board-fog') {
      addChessClick(sfxLeft, sfxRight, s + 0.3, 0.25, -0.3);
      addChessClick(sfxLeft, sfxRight, s + 0.75, 0.22, 0.2);
      addWhooshSweep(sfxLeft, sfxRight, s + d * 0.35, 0.9, 0.14);
      addToneBurst(sfxLeft, sfxRight, s + d * 0.42, 1.1, 329.63, 0.12, 0.45);
    } else if (ch.id === 'pawn-scout') {
      addChessClick(sfxLeft, sfxRight, s + d * 0.28, 0.28, -0.2);
      // Scanner ping + Queen reveal shimmer
      addToneBurst(sfxLeft, sfxRight, s + d * 0.4, 0.55, 880.0, 0.13, 0.35, 0.1);
      addToneBurst(sfxLeft, sfxRight, s + d * 0.48, 1.25, 587.33, 0.15, -0.2);
      addToneBurst(sfxLeft, sfxRight, s + d * 0.52, 1.25, 739.99, 0.14, 0.25);
    } else if (ch.id === 'cards-elite') {
      // Card flip + swap + cooldown ticks + shield clang + royal capture chord
      addWhooshSweep(sfxLeft, sfxRight, s + d * 0.1, 0.65, 0.15);
      addToneBurst(sfxLeft, sfxRight, s + d * 0.24, 0.85, 523.25, 0.13, 0.35);
      addChessClick(sfxLeft, sfxRight, s + d * 0.42, 0.18, 0.25);
      addToneBurst(sfxLeft, sfxRight, s + d * 0.58, 0.45, 196.0, 0.16, -0.3, 0.8); // blocked clang
      addToneBurst(sfxLeft, sfxRight, s + d * 0.74, 1.3, 440.0, 0.15, 0);
      addToneBurst(sfxLeft, sfxRight, s + d * 0.76, 1.3, 659.25, 0.14, 0.3);
    } else if (ch.id === 'recap') {
      addToneBurst(sfxLeft, sfxRight, s + 0.2, 1.6, 293.66, 0.14, -0.35);
      addToneBurst(sfxLeft, sfxRight, s + 0.25, 1.6, 440.0, 0.14, 0.35);
      addToneBurst(sfxLeft, sfxRight, s + 0.32, 1.8, 587.33, 0.14, 0);
    }
  }

  // Combine music + SFX with soft clipping protection
  const outLeft = new Float32Array(numSamples);
  const outRight = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    outLeft[i] = Math.tanh((musicLeft[i] ?? 0) + (sfxLeft[i] ?? 0));
    outRight[i] = Math.tanh((musicRight[i] ?? 0) + (sfxRight[i] ?? 0));
  }

  return { left: outLeft, right: outRight };
}

/**
 * Synthesizes French narration clips, measures durations via ffprobe, resolves the
 * MasterTimeline, synthesizes procedural SFX/music with ducking, and mixes final audio.
 */
export function buildMasterAudioAndTimeline(options: {
  tempDir: string;
  browserMp3Path: string;
  srtPath: string;
  voiceName?: string;
}): AudioBuildResult {
  mkdirSync(options.tempDir, { recursive: true });
  mkdirSync(path.dirname(options.browserMp3Path), { recursive: true });

  const voiceName = options.voiceName ?? 'fr-FR-HenriNeural';
  const clips: VoiceClipResult[] = STORYBOARD_CHAPTERS.map((spec) =>
    synthesizeSingleChapterVoice(
      spec.narration,
      spec.id,
      spec.defaultSpokenSec,
      options.tempDir,
      voiceName,
    ),
  );

  const timeline = resolveMasterTimeline(
    clips.map((c) => c.durationSec),
    {
      fps: VIDEO_FPS,
      masterAudioPath: options.browserMp3Path,
      srtPath: options.srtPath,
    },
  );

  // Synthesize procedural music + SFX WAV
  const { left, right } = synthesizeProceduralBedAndSfx(timeline);
  const bedWavPath = path.join(options.tempDir, 'procedural-bed-sfx.wav');
  writeFileSync(bedWavPath, encodeStereoPcmWav(left, right, AUDIO_SAMPLE_RATE));

  const masterWavPath = path.join(options.tempDir, 'master-mix.wav');
  const totalSec = timeline.totalFrames / timeline.fps;

  // Mix procedural bed + delayed chapter voice tracks via ffmpeg
  const ffmpegInputs: string[] = ['-y', '-i', bedWavPath];
  const filterSteps: string[] = ['[0:a]volume=1.0[bed]'];
  const mixLabels: string[] = ['[bed]'];

  clips.forEach((clip, idx) => {
    const ch = timeline.chapters[idx];
    if (!ch) return;
    ffmpegInputs.push('-i', clip.filePath);
    const delayMs = Math.max(0, Math.round((ch.startFrame / timeline.fps) * 1000));
    const inputIdx = idx + 1;
    const label = `[v${idx}]`;
    filterSteps.push(
      `[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=1.35${label}`,
    );
    mixLabels.push(label);
  });

  const filterComplex = [
    ...filterSteps,
    `${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:normalize=0,alimiter=limit=0.95[outa]`,
  ].join(';');

  const mixRes = spawnSync(
    'ffmpeg',
    [
      ...ffmpegInputs,
      '-filter_complex',
      filterComplex,
      '-map',
      '[outa]',
      '-t',
      totalSec.toFixed(3),
      '-ar',
      String(AUDIO_SAMPLE_RATE),
      '-ac',
      '2',
      masterWavPath,
    ],
    { encoding: 'utf8', timeout: 30000 },
  );

  if (mixRes.status !== 0) {
    throw new Error(`ffmpeg audio mix failed:\n${mixRes.stderr}`);
  }

  // Also export compact MP3 for browser <audio> sync
  const mp3Res = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      masterWavPath,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      options.browserMp3Path,
    ],
    { encoding: 'utf8', timeout: 20000 },
  );

  if (mp3Res.status !== 0) {
    throw new Error(`ffmpeg browser MP3 export failed:\n${mp3Res.stderr}`);
  }

  return {
    timeline,
    masterWavPath,
    browserMp3Path: options.browserMp3Path,
    clips,
  };
}
