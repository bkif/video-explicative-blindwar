import {
  BLIND_WAR_THEME,
  FONT_DISPLAY,
  FONT_MONO,
  FONT_SANS,
  RenderContext2D,
  traceRoundedRect,
} from './theme';

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function progress(frame: number, startFrame: number, durationFrames: number): number {
  if (durationFrames <= 0) return frame >= startFrame ? 1 : 0;
  return clamp((frame - startFrame) / durationFrames, 0, 1);
}

export function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

export function easeInOutQuart(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
}

export function easeOutBack(t: number): number {
  const x = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Deterministic damped spring curve normalized so f(0)=0 and f(1)=1.
 */
export function spring(t: number, damping = 6.5, frequency = 11): number {
  const x = clamp(t, 0, 1);
  if (x === 0) return 0;
  if (x === 1) return 1;
  const raw = 1 - Math.exp(-damping * x) * Math.cos(frequency * x);
  const endVal = 1 - Math.exp(-damping) * Math.cos(frequency);
  return clamp(raw / endVal, 0, 1.18);
}

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king' | 'elite';
export type PieceFaction = 'light' | 'dark';

export interface BoardRect {
  x: number;
  y: number;
  size: number;
}

export interface TileHighlight {
  col: number;
  row: number;
  color: string;
  alpha: number;
}

export interface BoardDrawOptions {
  highlights?: readonly TileHighlight[];
  showGridBadge?: boolean;
  fadeIn?: number;
}

export function boardSquareCenter(
  rect: BoardRect,
  col: number,
  row: number,
): { cx: number; cy: number; cellSize: number } {
  const pad = rect.size * 0.045;
  const inner = rect.size - pad * 2;
  const cellSize = inner / 9;
  return {
    cx: rect.x + pad + (col + 0.5) * cellSize,
    cy: rect.y + pad + (row + 0.5) * cellSize,
    cellSize,
  };
}

const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;

export function drawBoard9x9(
  ctx: RenderContext2D,
  rect: BoardRect,
  options: BoardDrawOptions = {},
): void {
  const fade = clamp(options.fadeIn ?? 1, 0, 1);
  if (fade <= 0.01) return;

  const pad = rect.size * 0.045;
  const innerSize = rect.size - pad * 2;
  const cell = innerSize / 9;

  ctx.save();
  ctx.globalAlpha *= fade;

  // Outer frame with gold/violet bevel
  traceRoundedRect(ctx, rect.x, rect.y, rect.size, rect.size, 18);
  const frameGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.size, rect.y + rect.size);
  frameGrad.addColorStop(0, '#2B2242');
  frameGrad.addColorStop(0.5, '#17112B');
  frameGrad.addColorStop(1, '#26174A');
  ctx.fillStyle = frameGrad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 28;
  ctx.fill();
  ctx.shadowBlur = 0;

  const borderGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.size, rect.y);
  borderGrad.addColorStop(0, BLIND_WAR_THEME.goldBright);
  borderGrad.addColorStop(0.5, BLIND_WAR_THEME.goldRich);
  borderGrad.addColorStop(1, BLIND_WAR_THEME.cyanRune);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // 9x9 checkerboard tiles
  const gridX = rect.x + pad;
  const gridY = rect.y + pad;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const isLight = (row + col) % 2 === 0;
      const tx = gridX + col * cell;
      const ty = gridY + row * cell;
      ctx.fillStyle = isLight ? '#EFE6D2' : '#1E173B';
      ctx.fillRect(tx, ty, cell + 0.4, cell + 0.4);

      // Subtle inner bevel line
      ctx.strokeStyle = isLight ? 'rgba(212, 160, 57, 0.25)' : 'rgba(168, 85, 247, 0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, ty, cell, cell);
    }
  }

  // Tile highlights
  if (options.highlights) {
    for (const hl of options.highlights) {
      const tx = gridX + hl.col * cell;
      const ty = gridY + hl.row * cell;
      ctx.save();
      ctx.globalAlpha *= clamp(hl.alpha, 0, 1);
      ctx.fillStyle = hl.color;
      ctx.fillRect(tx + 2, ty + 2, cell - 4, cell - 4);
      ctx.strokeStyle = hl.color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(tx + 2, ty + 2, cell - 4, cell - 4);
      ctx.restore();
    }
  }

  // Coordinates A-I & 9-1
  ctx.fillStyle = BLIND_WAR_THEME.goldBright;
  ctx.font = `700 ${Math.max(11, Math.round(pad * 0.48))}px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 9; i++) {
    const colLabel = COL_LABELS[i] ?? '';
    ctx.fillText(colLabel, gridX + (i + 0.5) * cell, rect.y + rect.size - pad * 0.48);
    ctx.fillText(String(9 - i), rect.x + pad * 0.48, gridY + (i + 0.5) * cell);
  }

  // Optional 9x9 Grid pill badge
  if (options.showGridBadge) {
    const badgeW = Math.max(108, rect.size * 0.2);
    const badgeH = 30;
    const bx = rect.x + rect.size - badgeW - 14;
    const by = rect.y - badgeH * 0.5;
    traceRoundedRect(ctx, bx, by, badgeW, badgeH, 15);
    ctx.fillStyle = BLIND_WAR_THEME.obsidian;
    ctx.fill();
    ctx.strokeStyle = BLIND_WAR_THEME.goldBright;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = BLIND_WAR_THEME.goldBright;
    ctx.font = `700 14px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('9 × 9 GRID', bx + badgeW / 2, by + badgeH / 2 + 0.5);
  }

  ctx.restore();
}

export interface PieceDrawOptions {
  masked?: boolean;
  maskLift?: number; // 0 = masked, 1 = fully revealed
  royalShield?: boolean;
  glowColor?: string;
  scale?: number;
  timeSec?: number;
}

function drawPieceSilhouette(
  ctx: RenderContext2D,
  type: PieceType,
  r: number,
  fill: string | ReturnType<RenderContext2D['createLinearGradient']>,
  stroke: string,
): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1.8, r * 0.08);
  ctx.lineJoin = 'round';

  // Common pedestal base
  const drawBase = (widthFrac: number) => {
    traceRoundedRect(ctx, -r * widthFrac, r * 0.52, r * widthFrac * 2, r * 0.28, r * 0.09);
    ctx.fill();
    ctx.stroke();
  };

  if (type === 'pawn') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.54);
    ctx.quadraticCurveTo(-r * 0.26, r * 0.05, -r * 0.16, -r * 0.12);
    ctx.lineTo(r * 0.16, -r * 0.12);
    ctx.quadraticCurveTo(r * 0.26, r * 0.05, r * 0.42, r * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -r * 0.36, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawBase(0.56);
    return;
  }

  if (type === 'rook') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.44, r * 0.54);
    ctx.lineTo(-r * 0.34, -r * 0.32);
    ctx.lineTo(-r * 0.44, -r * 0.32);
    ctx.lineTo(-r * 0.44, -r * 0.66);
    ctx.lineTo(-r * 0.24, -r * 0.66);
    ctx.lineTo(-r * 0.24, -r * 0.48);
    ctx.lineTo(-r * 0.08, -r * 0.48);
    ctx.lineTo(-r * 0.08, -r * 0.66);
    ctx.lineTo(r * 0.08, -r * 0.66);
    ctx.lineTo(r * 0.08, -r * 0.48);
    ctx.lineTo(r * 0.24, -r * 0.48);
    ctx.lineTo(r * 0.24, -r * 0.66);
    ctx.lineTo(r * 0.44, -r * 0.66);
    ctx.lineTo(r * 0.44, -r * 0.32);
    ctx.lineTo(r * 0.34, -r * 0.32);
    ctx.lineTo(r * 0.44, r * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawBase(0.6);
    return;
  }

  if (type === 'knight') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.44, r * 0.54);
    ctx.quadraticCurveTo(-r * 0.46, -r * 0.04, -r * 0.16, -r * 0.58);
    ctx.lineTo(0, -r * 0.72);
    ctx.lineTo(r * 0.12, -r * 0.54);
    ctx.lineTo(r * 0.48, -r * 0.24);
    ctx.lineTo(r * 0.32, -r * 0.04);
    ctx.lineTo(r * 0.06, -r * 0.14);
    ctx.quadraticCurveTo(r * 0.18, r * 0.24, r * 0.42, r * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawBase(0.58);
    return;
  }

  if (type === 'bishop') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.54);
    ctx.quadraticCurveTo(-r * 0.32, r * 0.04, -r * 0.28, -r * 0.26);
    ctx.quadraticCurveTo(0, -r * 0.78, r * 0.28, -r * 0.26);
    ctx.quadraticCurveTo(r * 0.32, r * 0.04, r * 0.42, r * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -r * 0.66, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawBase(0.58);
    return;
  }

  if (type === 'queen') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.48, r * 0.54);
    ctx.lineTo(-r * 0.56, -r * 0.34);
    ctx.lineTo(-r * 0.26, -r * 0.06);
    ctx.lineTo(-r * 0.22, -r * 0.56);
    ctx.lineTo(0, -r * 0.16);
    ctx.lineTo(r * 0.22, -r * 0.56);
    ctx.lineTo(r * 0.26, -r * 0.06);
    ctx.lineTo(r * 0.56, -r * 0.34);
    ctx.lineTo(r * 0.48, r * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Queen jewels
    const tips = [-0.56, -0.22, 0.22, 0.56];
    const yTips = [-0.38, -0.60, -0.60, -0.38];
    for (let i = 0; i < tips.length; i++) {
      ctx.beginPath();
      ctx.arc(r * (tips[i] ?? 0), r * (yTips[i] ?? 0), r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, -r * 0.68, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawBase(0.64);
    return;
  }

  if (type === 'king') {
    ctx.beginPath();
    ctx.moveTo(-r * 0.48, r * 0.54);
    ctx.lineTo(-r * 0.5, -r * 0.28);
    ctx.quadraticCurveTo(-r * 0.22, -r * 0.42, 0, -r * 0.24);
    ctx.quadraticCurveTo(r * 0.22, -r * 0.42, r * 0.5, -r * 0.28);
    ctx.lineTo(r * 0.48, r * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cross
    ctx.lineWidth = Math.max(3, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.34);
    ctx.lineTo(0, -r * 0.78);
    ctx.moveTo(-r * 0.22, -r * 0.58);
    ctx.lineTo(r * 0.22, -r * 0.58);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.8, r * 0.08);
    drawBase(0.64);
    return;
  }

  // 'elite': Armored Paladin / Royal Bastion crest
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.72);
  ctx.lineTo(r * 0.5, -r * 0.34);
  ctx.lineTo(r * 0.42, r * 0.54);
  ctx.lineTo(-r * 0.42, r * 0.54);
  ctx.lineTo(-r * 0.5, -r * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner royal diamond
  ctx.fillStyle = BLIND_WAR_THEME.royalGold;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.32);
  ctx.lineTo(r * 0.2, -r * 0.02);
  ctx.lineTo(0, r * 0.28);
  ctx.lineTo(-r * 0.2, -r * 0.02);
  ctx.closePath();
  ctx.fill();
  drawBase(0.62);
}

export function drawChessPiece(
  ctx: RenderContext2D,
  cx: number,
  cy: number,
  cellSize: number,
  type: PieceType,
  faction: PieceFaction,
  options: PieceDrawOptions = {},
): void {
  const r = cellSize * 0.37 * (options.scale ?? 1);
  const masked = Boolean(options.masked);
  const maskLift = clamp(options.maskLift ?? (masked ? 0 : 1), 0, 1);
  const timeSec = options.timeSec ?? 0;

  ctx.save();
  ctx.translate(cx, cy);

  // Drop shadow on square
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.78, r * 0.62, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  if (options.glowColor) {
    ctx.shadowColor = options.glowColor;
    ctx.shadowBlur = 16;
  }

  // Royal shield aura (Only King / Queen can eliminate)
  if (options.royalShield) {
    const pulse = 1 + 0.06 * Math.sin(timeSec * 4.5);
    const shieldR = cellSize * 0.44 * pulse;
    ctx.save();
    ctx.strokeStyle = BLIND_WAR_THEME.royalGold;
    ctx.lineWidth = 2.6;
    ctx.shadowColor = BLIND_WAR_THEME.royalGold;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 - Math.PI / 6;
      const px = Math.cos(a) * shieldR;
      const py = Math.sin(a) * shieldR;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.14)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // True piece fill & stroke
  const fillGrad = ctx.createLinearGradient(-r, -r, r, r);
  if (faction === 'light') {
    fillGrad.addColorStop(0, '#FFFDF7');
    fillGrad.addColorStop(0.55, '#F3E7CE');
    fillGrad.addColorStop(1, '#D1AE6B');
  } else {
    fillGrad.addColorStop(0, '#31235C');
    fillGrad.addColorStop(0.55, '#191233');
    fillGrad.addColorStop(1, '#0C081A');
  }
  const strokeColor =
    faction === 'light' ? BLIND_WAR_THEME.goldDeep : BLIND_WAR_THEME.cyanRune;

  if (!masked || maskLift > 0.05) {
    ctx.save();
    ctx.globalAlpha *= masked ? easeOutCubic(maskLift) : 1;
    drawPieceSilhouette(ctx, type, r, fillGrad, strokeColor);
    ctx.restore();
  }

  // Masquerade disguise overlay (Fog of Deception: looks like a masked Pawn)
  if (masked && maskLift < 0.98) {
    const maskOpacity = 1 - easeOutCubic(maskLift);
    const liftY = -maskLift * r * 0.85;
    ctx.save();
    ctx.globalAlpha *= maskOpacity;
    ctx.translate(0, liftY);

    const cloakGrad = ctx.createLinearGradient(-r, -r, r, r);
    cloakGrad.addColorStop(0, '#3B286B');
    cloakGrad.addColorStop(1, '#120D24');
    drawPieceSilhouette(ctx, 'pawn', r, cloakGrad, BLIND_WAR_THEME.violetGlow);

    // Ornate mini masquerade mask across the Pawn head
    ctx.fillStyle = BLIND_WAR_THEME.marbleBase;
    ctx.strokeStyle = BLIND_WAR_THEME.goldBright;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.38, -r * 0.42);
    ctx.quadraticCurveTo(0, -r * 0.28, r * 0.38, -r * 0.42);
    ctx.lineTo(r * 0.28, -r * 0.24);
    ctx.quadraticCurveTo(0, -r * 0.16, -r * 0.28, -r * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing cyan/gold visor dots
    ctx.fillStyle = BLIND_WAR_THEME.goldRich;
    ctx.beginPath();
    ctx.arc(-r * 0.13, -r * 0.33, r * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BLIND_WAR_THEME.cyanRune;
    ctx.beginPath();
    ctx.arc(r * 0.13, -r * 0.33, r * 0.055, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

export function drawAdjacencyScannerPulse(
  ctx: RenderContext2D,
  boardRect: BoardRect,
  pawnCol: number,
  pawnRow: number,
  targetCol: number,
  targetRow: number,
  pulseT: number,
): void {
  const t = clamp(pulseT, 0, 1);
  if (t <= 0.01) return;

  const pPos = boardSquareCenter(boardRect, pawnCol, pawnRow);
  const tPos = boardSquareCenter(boardRect, targetCol, targetRow);

  ctx.save();
  // Energy arc from scouting Pawn to adjacent enemy
  ctx.strokeStyle = BLIND_WAR_THEME.cyanRune;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = BLIND_WAR_THEME.cyanRune;
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.45 + 0.55 * Math.sin(t * Math.PI);
  ctx.beginPath();
  ctx.moveTo(pPos.cx, pPos.cy);
  ctx.lineTo(lerp(pPos.cx, tPos.cx, Math.min(1, t * 1.4)), lerp(pPos.cy, tPos.cy, Math.min(1, t * 1.4)));
  ctx.stroke();

  // Expanding radar ring around target
  const ringR = pPos.cellSize * (0.35 + t * 0.55);
  ctx.strokeStyle = BLIND_WAR_THEME.goldBright;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 1 - t * 0.7;
  ctx.beginPath();
  ctx.arc(tPos.cx, tPos.cy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  // Floating "UNMASKED!" tag
  if (t > 0.3) {
    const tagAlpha = clamp((t - 0.3) / 0.25, 0, 1);
    ctx.globalAlpha = tagAlpha;
    const tagW = 128;
    const tagH = 26;
    const tx = tPos.cx - tagW / 2;
    const ty = tPos.cy - pPos.cellSize * 0.78;
    traceRoundedRect(ctx, tx, ty, tagW, tagH, 13);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.strokeStyle = BLIND_WAR_THEME.emeraldReveal;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = BLIND_WAR_THEME.emeraldReveal;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QUEEN REVEALED', tPos.cx, ty + tagH / 2 + 0.5);
  }

  ctx.restore();
}

export interface PowerCardOptions {
  cx: number;
  cy: number;
  width: number;
  height: number;
  flipT: number; // 0 = card back, 1 = card front
  cooldownProgress: number; // 0..1 remaining cooldown sweep
  cooldownTurns: number;
  title: string;
  subtitle: string;
}

export function drawPowerCard(ctx: RenderContext2D, opts: PowerCardOptions): void {
  const { cx, cy, width, height } = opts;
  const angle = clamp(opts.flipT, 0, 1) * Math.PI;
  const scaleX = Math.cos(angle);
  const showFront = scaleX < 0;
  const absScaleX = Math.max(0.04, Math.abs(scaleX));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(absScaleX, 1);

  traceRoundedRect(ctx, -width / 2, -height / 2, width, height, 18);

  if (!showFront) {
    // Card Back (Obsidian & Gold Astrolabe)
    const backGrad = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    backGrad.addColorStop(0, '#1D143B');
    backGrad.addColorStop(1, '#090714');
    ctx.fillStyle = backGrad;
    ctx.fill();
    ctx.strokeStyle = BLIND_WAR_THEME.goldRich;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(248, 216, 120, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, width * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = BLIND_WAR_THEME.goldBright;
    ctx.font = `700 16px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BLIND WAR', 0, 0);
  } else {
    // Front Face (Holographic Arcane Power Card + Cooldown Ring)
    const frontGrad = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    frontGrad.addColorStop(0, '#1B133D');
    frontGrad.addColorStop(0.55, '#2A1859');
    frontGrad.addColorStop(1, '#0E1930');
    ctx.fillStyle = frontGrad;
    ctx.shadowColor = BLIND_WAR_THEME.violetGlow;
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;

    const borderGrad = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    borderGrad.addColorStop(0, BLIND_WAR_THEME.cyanRune);
    borderGrad.addColorStop(0.5, BLIND_WAR_THEME.goldBright);
    borderGrad.addColorStop(1, BLIND_WAR_THEME.magentaAccent);
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner emblem + Radial Cooldown Ring
    const ringCy = -height * 0.11;
    const ringR = Math.min(width, height) * 0.22;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, ringCy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Active cooldown sweep
    const cd = clamp(opts.cooldownProgress, 0, 1);
    if (cd > 0.01) {
      ctx.strokeStyle = BLIND_WAR_THEME.cyanRune;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.shadowColor = BLIND_WAR_THEME.cyanRune;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, ringCy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Rune hourglass / lightning inside ring
    ctx.strokeStyle = BLIND_WAR_THEME.goldBright;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-ringR * 0.35, ringCy - ringR * 0.38);
    ctx.lineTo(ringR * 0.35, ringCy - ringR * 0.38);
    ctx.lineTo(-ringR * 0.35, ringCy + ringR * 0.38);
    ctx.lineTo(ringR * 0.35, ringCy + ringR * 0.38);
    ctx.closePath();
    ctx.stroke();

    // Card Title & Cooldown label
    ctx.fillStyle = BLIND_WAR_THEME.textLight;
    ctx.font = `700 ${Math.round(width * 0.092)}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.title, 0, height * 0.2, width * 0.86);

    ctx.fillStyle = BLIND_WAR_THEME.textSoft;
    ctx.font = `600 ${Math.round(width * 0.068)}px ${FONT_SANS}`;
    ctx.fillText(opts.subtitle, 0, height * 0.31, width * 0.86);

    // Cooldown pill
    const pillW = width * 0.64;
    const pillH = 26;
    traceRoundedRect(ctx, -pillW / 2, height * 0.4 - pillH / 2, pillW, pillH, 13);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
    ctx.fill();
    ctx.strokeStyle = BLIND_WAR_THEME.cyanRune;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = BLIND_WAR_THEME.cyanRune;
    ctx.font = `700 12px ${FONT_MONO}`;
    ctx.fillText(`COOLDOWN: ${opts.cooldownTurns} TURNS`, 0, height * 0.4 + 0.5);
  }

  ctx.restore();
}

export interface ChapterBarItem {
  readonly id: string;
  readonly label: string;
  readonly startFrame: number;
  readonly durationFrames: number;
}

export function drawChapterProgressBar(
  ctx: RenderContext2D,
  width: number,
  height: number,
  chapters: readonly ChapterBarItem[],
  currentFrame: number,
  totalFrames: number,
  isVertical: boolean,
): void {
  const marginX = isVertical ? 48 : 84;
  const barH = isVertical ? 64 : 56;
  const y = height - barH - (isVertical ? 44 : 28);
  const totalW = width - marginX * 2;

  ctx.save();
  traceRoundedRect(ctx, marginX, y, totalW, barH, 16);
  ctx.fillStyle = 'rgba(10, 8, 22, 0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 160, 57, 0.38)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const innerPad = 14;
  const segGap = 8;
  const segAreaW = totalW - innerPad * 2;
  const trackY = y + barH - 14;
  const trackH = 5;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (!ch) continue;
    const fracStart = ch.startFrame / totalFrames;
    const fracLen = ch.durationFrames / totalFrames;
    const sx = marginX + innerPad + fracStart * segAreaW + (i > 0 ? segGap * 0.5 : 0);
    const sw = Math.max(12, fracLen * segAreaW - segGap);
    const chProgress = clamp((currentFrame - ch.startFrame) / ch.durationFrames, 0, 1);
    const isActive = currentFrame >= ch.startFrame && currentFrame < ch.startFrame + ch.durationFrames;

    // Segment track
    traceRoundedRect(ctx, sx, trackY, sw, trackH, 2.5);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.fill();

    if (chProgress > 0) {
      traceRoundedRect(ctx, sx, trackY, sw * chProgress, trackH, 2.5);
      const progGrad = ctx.createLinearGradient(sx, 0, sx + sw, 0);
      progGrad.addColorStop(0, BLIND_WAR_THEME.goldBright);
      progGrad.addColorStop(1, BLIND_WAR_THEME.cyanRune);
      ctx.fillStyle = progGrad;
      ctx.fill();
    }

    // Label above segment
    const labelText = isVertical ? `0${i + 1}` : ch.label;
    ctx.fillStyle = isActive
      ? BLIND_WAR_THEME.goldBright
      : chProgress >= 1
        ? BLIND_WAR_THEME.textSoft
        : 'rgba(148, 163, 184, 0.6)';
    ctx.font = `${isActive ? 700 : 600} ${isVertical ? 14 : 12}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, sx + sw / 2, y + 21, sw - 4);
  }

  ctx.restore();
}
