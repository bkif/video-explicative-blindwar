import { ChildProcessByStdio, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { createCanvas } from '@napi-rs/canvas';
import { buildMasterAudioAndTimeline } from './audio';
import { renderFrame } from './renderer';
import { VIDEO_FPS } from './storyboard';
import { generateSrtContent } from './subtitles';
import { AspectMode, RenderContext2D, getDimensions } from './theme';

interface ExportCliOptions {
  aspectRatio: AspectMode;
  fps: number;
  outputPath: string;
  srtPath: string;
  browserMp3Path: string;
  timelineJsonPath: string;
  voiceName: string;
  noSubtitles: boolean;
}

function parseCliArgs(argv: readonly string[]): ExportCliOptions {
  const isVertical = argv.includes('--vertical');
  const noSubtitles = argv.includes('--no-burn-subtitles');
  const aspectRatio: AspectMode = isVertical ? '9:16' : '16:9';

  let fps = VIDEO_FPS;
  let customOut: string | undefined;
  let voiceName = 'fr-FR-HenriNeural';

  for (const arg of argv) {
    if (arg.startsWith('--fps=')) {
      const parsed = Number(arg.slice('--fps='.length));
      if (Number.isFinite(parsed) && parsed > 0) fps = Math.round(parsed);
    } else if (arg.startsWith('--out=')) {
      customOut = arg.slice('--out='.length);
    } else if (arg.startsWith('--voice=')) {
      const v = arg.slice('--voice='.length).trim();
      if (v) voiceName = v;
    }
  }

  const defaultName = isVertical ? 'blind-war-tiktok.mp4' : 'blind-war-how-to-play.mp4';
  const publicDir = path.resolve(process.cwd(), 'public');
  const outputPath = path.resolve(process.cwd(), customOut ?? path.join('public', defaultName));

  return {
    aspectRatio,
    fps,
    outputPath,
    srtPath: path.join(publicDir, 'blind-war-how-to-play.srt'),
    browserMp3Path: path.join(publicDir, 'blind-war-audio.mp3'),
    timelineJsonPath: path.join(publicDir, 'blind-war-timeline.json'),
    voiceName,
    noSubtitles,
  };
}

function assertMediaToolsInstalled(): void {
  for (const bin of ['ffmpeg', 'ffprobe']) {
    const probe = spawnSync(bin, ['-version'], { stdio: 'ignore' });
    if (probe.error || probe.status !== 0) {
      console.error(
        [
          `Error: "${bin}" was not found on your PATH.`,
          'Please install FFmpeg (includes ffprobe) before rendering BLIND WAR explainer videos:',
          '  - Ubuntu / Debian: sudo apt-get update && sudo apt-get install -y ffmpeg',
          '  - macOS (Homebrew): brew install ffmpeg',
          '  - Windows (winget): winget install Gyan.FFmpeg',
        ].join('\n'),
      );
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));
  assertMediaToolsInstalled();

  const { width, height } = getDimensions(opts.aspectRatio);
  mkdirSync(path.dirname(opts.outputPath), { recursive: true });
  mkdirSync(path.dirname(opts.srtPath), { recursive: true });

  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'blind-war-audio-'));
  const tempOutputPath = `${opts.outputPath}.tmp.mp4`;
  let ffmpegProc: ChildProcessByStdio<Writable, null, Readable> | null = null;
  let aborted = false;

  const cleanup = (signal?: string): void => {
    aborted = true;
    if (ffmpegProc && !ffmpegProc.killed) {
      ffmpegProc.kill('SIGTERM');
    }
    try {
      rmSync(tempOutputPath, { force: true });
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    if (signal) {
      console.error(`\nRender interrupted (${signal}); temporary files cleaned up.`);
      process.exit(130);
    }
  };

  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));

  try {
    console.log(`Synthesizing French voiceover (${opts.voiceName}) + procedural SFX/music...`);
    const audioBuild = buildMasterAudioAndTimeline({
      tempDir,
      browserMp3Path: opts.browserMp3Path,
      srtPath: opts.srtPath,
      voiceName: opts.voiceName,
    });

    const { timeline, clips, masterWavPath } = audioBuild;
    for (const clip of clips) {
      console.log(
        `  [${clip.chapterId}] engine=${clip.engine}, spoken=${clip.durationSec.toFixed(2)}s`,
      );
    }

    // Export timed .srt subtitle track & timeline JSON for browser player sync
    writeFileSync(opts.srtPath, generateSrtContent(timeline), 'utf8');
    writeFileSync(
      opts.timelineJsonPath,
      JSON.stringify(
        {
          ...timeline,
          masterAudioPath: '/blind-war-audio.mp3',
          srtPath: '/blind-war-how-to-play.srt',
        },
        null,
        2,
      ),
      'utf8',
    );

    const ffmpegArgs = [
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${width}x${height}`,
      '-r',
      String(timeline.fps),
      '-i',
      'pipe:0',
      '-i',
      masterWavPath,
      '-i',
      opts.srtPath,
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-map',
      '2:s:0',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-c:s',
      'mov_text',
      '-metadata:s:a:0',
      'language=fra',
      '-metadata:s:s:0',
      'language=fra',
      '-t',
      (timeline.totalFrames / timeline.fps).toFixed(3),
      '-movflags',
      '+faststart',
      tempOutputPath,
    ];

    const durationSec = (timeline.totalFrames / timeline.fps).toFixed(2);
    console.log(
      `Rendering BLIND WAR voiced explainer (${opts.aspectRatio}, ${width}x${height} @ ${timeline.fps}fps, ${timeline.totalFrames} frames / ${durationSec}s)...`,
    );

    const proc = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
    ffmpegProc = proc;

    const stderrChunks: Buffer[] = [];
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    const exitPromise = once(proc, 'close') as Promise<[number | null, NodeJS.Signals | null]>;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as unknown as RenderContext2D;

    for (let frame = 0; frame < timeline.totalFrames; frame++) {
      if (aborted) break;
      renderFrame(ctx, frame, timeline, opts.aspectRatio, {
        showSubtitles: !opts.noSubtitles,
      });
      const rawRgba = canvas.data();
      const canContinue = proc.stdin.write(rawRgba);
      if (!canContinue) {
        await once(proc.stdin, 'drain');
      }

      if ((frame + 1) % 150 === 0 || frame + 1 === timeline.totalFrames) {
        const pct = Math.round(((frame + 1) / timeline.totalFrames) * 100);
        console.log(`  Encoded frame ${frame + 1}/${timeline.totalFrames} (${pct}%)`);
      }
    }

    proc.stdin.end();
    const [exitCode] = await exitPromise;
    if (exitCode !== 0) {
      const logTail = Buffer.concat(stderrChunks).toString('utf8').slice(-1400);
      throw new Error(`ffmpeg exited with code ${exitCode}:\n${logTail}`);
    }

    renameSync(tempOutputPath, opts.outputPath);
    console.log(`Success: exported ${opts.outputPath}`);
    console.log(`Subtitles: ${opts.srtPath}`);
  } catch (err) {
    cleanup();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to export voiced explainer video: ${message}`);
    process.exit(1);
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

void main();
