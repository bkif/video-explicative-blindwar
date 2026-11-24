# BLIND WAR — Voiced & Subtitled Programmatic Explainer Pipeline

Deterministic Canvas 2D + French neural TTS + procedural SFX/music + FFmpeg explainer video pipeline and audio-synced 60fps interactive player for **BLIND WAR** by **MHLGames**.

## Architecture
- **Visual Engine:** Split celestial marble/gold vs. cosmic obsidian/violet/cyan aesthetic with winged masquerade crown emblem, `9×9` board, Fog of Deception mask toggling, Adjacent Pawn Reveal scanner, holographic Power Card flip + cooldown ring, and Royal-Only Elite shield.
- **French Voiceover (`explainer-video/audio.ts`):** Synthesizes per-chapter French narration (`edge-tts` `fr-FR-HenriNeural` with automatic fallback to `espeak-ng` or timed silent pacing), measures exact spoken durations with `ffprobe`, and adapts chapter lengths dynamically (`+0.55s` buffer).
- **Procedural Audio & Voice-Ducking:** Synthesizes dual-world ambient music + synced chess/rune/card/shield SFX directly in stereo 16-bit PCM WAV with smooth cosine voice-ducking during narration.
- **Subtitles (`explainer-video/subtitles.ts`):** Renders burned-in high-contrast dynamic subtitles in safe zones (`16:9` and `9:16` TikTok) and exports `public/blind-war-how-to-play.srt` (embedded as `mov_text`).

## Commands
- `npm run dev` — Launch the interactive audio-synced 60fps player (**Comment jouer / How to Play**)
- `npm run render:tutorial-video` — Export `public/blind-war-how-to-play.mp4` (`16:9`, H.264 + AAC + `mov_text`), `.srt`, and browser `.mp3`
- `npm run render:tutorial-video:vertical` — Export `public/blind-war-tiktok.mp4` (`9:16`, H.264 + AAC + `mov_text`)
- `npm run typecheck && npm run lint && npm test && npm run build` — Verify TypeScript, ESLint, Vitest, and Vite production build