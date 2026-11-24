# BLIND WAR — Programmatic Explainer Video & Interactive Player

Deterministic, 100% procedural Canvas 2D + FFmpeg explainer video pipeline and 60fps interactive player for **BLIND WAR** by **MHLGames**.

## Core Features
- **Split Duality Aesthetic:** Celestial white marble & gold clockwork vs. cosmic obsidian, electric violet/cyan nebula, constellations, and the winged masquerade crown emblem.
- **5-Chapter Storyboard (24s @ 30fps / 60fps UI):**
  1. Hook & Duality (`0–4s`)
  2. 9×9 Board & Hidden Piece Identities (`4–9s`)
  3. Adjacent Pawn Scouting Reveal (`9–14s`)
  4. Power Cards, Cooldowns & Royal-Only Elite (`14–20s`)
  5. Recap & Call-to-Play (`20–24s`)
- **Multi-Aspect Export:** Renders both `16:9` (`1920x1080`) web trailer and `9:16` (`1080x1920`) TikTok/vertical MP4s from the exact same deterministic `renderFrame` engine.

## Commands
- `npm run dev` — Launch interactive 60fps web player with the **How to Play** modal
- `npm run render:tutorial-video` — Export `public/blind-war-how-to-play.mp4` (`16:9`)
- `npm run render:tutorial-video:vertical` — Export `public/blind-war-tiktok.mp4` (`9:16`)
- `npm run typecheck && npm run lint && npm test && npm run build` — Verify types, lint, tests, and production bundle