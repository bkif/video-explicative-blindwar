import { ChildProcessByStdio, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { createCanvas } from '@napi-rs/canvas';
import { renderFrame } from './renderer';
import { TOTAL_FRAMES, VIDEO_FPS } from './storyboard';
import { AspectMode, RenderContext2D, getDimensions } from './theme';

interface ExportCliOptions {
  aspectRatio: AspectMode;
  fps: number;
  totalFrames: number;
  outputPath: string;
}

function parseCliArgs(argv: readonly string[]): ExportCliOptions {
  const isVertical = argv.includes('--vertical');
  const aspectRatio: AspectMode = isVertical ? '9:16' : '16:9';

  let fps = VIDEO_FPS;
  let totalFrames = TOTAL_FRAMES;
  let customOut: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith('--fps=')) {
      const parsed = Number(arg.slice('--fps='.length));
      if (Number.isFinite(parsed) && parsed > 0) fps = Math.round(parsed);
    } else if (arg.startsWith('--frames=')) {
      const parsed = Number(arg.slice('--frames='.length));
      if (Number.isFinite(parsed) && parsed > 0) totalFrames = Math.round(parsed);
    } else if (arg.startsWith('--out=')) {
      customOut = arg.slice('--out='.length);
    }
  }

  const defaultName = isVertical ? 'blind-war-tiktok.mp4' : 'blind-war-how-to-play.mp4';
  const outputPath = path.resolve(process.cwd(), customOut ?? path.join('public', defaultName));

  return { aspectRatio, fps, totalFrames, outputPath };
}

function assertFfmpegInstalled(): void {
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error(
      [
        'Error: "ffmpeg" was not found on your PATH.',
        'Please install FFmpeg before rendering BLIND WAR explainer videos:',
        '  - Ubuntu / Debian: sudo apt-get update && sudo apt-get install -y ffmpeg',
        '  - macOS (Homebrew): brew install ffmpeg',
        '  - Windows (winget): winget install Gyan.FFmpeg',
      ].join('\n'),
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));
  assertFfmpegInstalled();

  const { width, height } = getDimensions(opts.aspectRatio);
  mkdirSync(path.dirname(opts.outputPath), { recursive: true });

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
    } catch {
      // Ignore cleanup errors
    }
    if (signal) {
      console.error(`\nRender interrupted (${signal}); partial output cleaned up.`);
      process.exit(130);
    }
  };

  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));

  const ffmpegArgs = [
    '-y',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${width}x${height}`,
    '-r',
    String(opts.fps),
    '-i',
    'pipe:0',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-movflags',
    '+faststart',
    tempOutputPath,
  ];

  console.log(
    `Rendering BLIND WAR explainer (${opts.aspectRatio}, ${width}x${height} @ ${opts.fps}fps, ${opts.totalFrames} frames)...`,
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

  try {
    for (let frame = 0; frame < opts.totalFrames; frame++) {
      if (aborted) break;
      renderFrame(ctx, frame, opts.totalFrames, opts.aspectRatio);
      const rawRgba = canvas.data();
      const canContinue = proc.stdin.write(rawRgba);
      if (!canContinue) {
        await once(proc.stdin, 'drain');
      }

      if ((frame + 1) % 120 === 0 || frame + 1 === opts.totalFrames) {
        const pct = Math.round(((frame + 1) / opts.totalFrames) * 100);
        console.log(`  Encoded frame ${frame + 1}/${opts.totalFrames} (${pct}%)`);
      }
    }

    proc.stdin.end();
    const [exitCode] = await exitPromise;
    if (exitCode !== 0) {
      const logTail = Buffer.concat(stderrChunks).toString('utf8').slice(-1200);
      throw new Error(`ffmpeg exited with code ${exitCode}:\n${logTail}`);
    }

    renameSync(tempOutputPath, opts.outputPath);
    console.log(`Success: exported ${opts.outputPath}`);
  } catch (err) {
    cleanup();
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to export explainer video: ${message}`);
    process.exit(1);
  }
}

void main();
