import {
  BoardRect,
  PieceFaction,
  PieceType,
  TileHighlight,
  boardSquareCenter,
  clamp,
  drawAdjacencyScannerPulse,
  drawBoard9x9,
  drawChapterProgressBar,
  drawChessPiece,
  drawPowerCard,
  easeInOutQuart,
  easeOutBack,
  easeOutCubic,
  lerp,
  spring,
} from './primitives';
import {
  MasterTimeline,
  ResolvedChapter,
  getChapterAtFrame,
} from './storyboard';
import { drawSubtitleOverlay, getActiveSubtitleCue } from './subtitles';
import {
  AspectMode,
  BLIND_WAR_THEME,
  FONT_DISPLAY,
  FONT_MONO,
  FONT_SANS,
  RenderContext2D,
  drawSplitDualityBackground,
  drawTextWithShadow,
  drawWingedMasqueradeEmblem,
  getDimensions,
  traceRoundedRect,
} from './theme';

export interface RenderOptions {
  readonly showSubtitles?: boolean;
}

interface LayoutZones {
  width: number;
  height: number;
  isVertical: boolean;
  boardRect: BoardRect;
  panelRect: { x: number; y: number; w: number; h: number };
  headerY: number;
}

function computeLayout(aspectRatio: AspectMode): LayoutZones {
  const { width, height } = getDimensions(aspectRatio);
  const isVertical = aspectRatio === '9:16';

  if (!isVertical) {
    return {
      width,
      height,
      isVertical: false,
      headerY: 66,
      boardRect: { x: 145, y: 174, size: 685 },
      panelRect: { x: 900, y: 174, w: 890, h: 685 },
    };
  }

  return {
    width,
    height,
    isVertical: true,
    headerY: 82,
    boardRect: { x: 175, y: 238, size: 730 },
    panelRect: { x: 76, y: 995, w: 928, h: 560 },
  };
}

function segmentProgress(t: number, start: number, span: number): number {
  return clamp((t - start) / Math.max(0.0001, span), 0, 1);
}

function drawChapterHeader(
  ctx: RenderContext2D,
  layout: LayoutZones,
  label: string,
  headline: string,
  caption: string,
  chapterT: number,
): void {
  const { width, isVertical, headerY } = layout;
  const enterT = segmentProgress(chapterT, 0, 0.16);
  const alpha = easeOutCubic(enterT);
  const slideY = (1 - easeOutCubic(enterT)) * 18;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (isVertical) {
    const hdrW = width - 64;
    const hdrH = 166;
    traceRoundedRect(ctx, 32, headerY - 50 + slideY, hdrW, hdrH, 22);
    ctx.fillStyle = 'rgba(10, 8, 22, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 160, 57, 0.32)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  const pillW = isVertical ? 340 : 320;
  const pillH = 34;
  const px = width / 2 - pillW / 2;
  const py = headerY - 38 + slideY;
  traceRoundedRect(ctx, px, py, pillW, pillH, 17);
  ctx.fillStyle = 'rgba(13, 10, 28, 0.88)';
  ctx.fill();
  ctx.strokeStyle = BLIND_WAR_THEME.goldRich;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  drawTextWithShadow(ctx, `${label}  ·  MHLGAMES`, width / 2, py + pillH / 2 + 0.5, {
    font: `700 13px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.goldBright,
    maxWidth: pillW - 24,
  });

  drawTextWithShadow(ctx, headline, width / 2, headerY + 24 + slideY, {
    font: `700 ${isVertical ? 44 : 42}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.textLight,
    shadowColor: 'rgba(124, 58, 237, 0.7)',
    shadowBlur: 18,
    maxWidth: width - (isVertical ? 96 : 240),
  });

  drawTextWithShadow(ctx, caption, width / 2, headerY + (isVertical ? 74 : 68) + slideY, {
    font: `500 ${isVertical ? 22 : 21}px ${FONT_SANS}`,
    color: BLIND_WAR_THEME.textSoft,
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    shadowBlur: 10,
    maxWidth: width - (isVertical ? 96 : 260),
  });

  ctx.restore();
}

function drawTacticalPanelFrame(
  ctx: RenderContext2D,
  rect: { x: number; y: number; w: number; h: number },
  accentColor: string,
  fade: number,
): void {
  ctx.save();
  ctx.globalAlpha *= clamp(fade, 0, 1);
  traceRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 24);
  const bg = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  bg.addColorStop(0, 'rgba(17, 13, 36, 0.90)');
  bg.addColorStop(1, 'rgba(9, 7, 20, 0.94)');
  ctx.fillStyle = bg;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 24;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();
}

function renderHookChapter(
  ctx: RenderContext2D,
  layout: LayoutZones,
  chapterT: number,
  timeSec: number,
): void {
  const { width, height, isVertical } = layout;
  const wipeT = easeInOutQuart(segmentProgress(chapterT, 0, 0.34));
  const splitRatio = lerp(0.06, 0.5, wipeT);

  drawSplitDualityBackground(ctx, width, height, splitRatio, timeSec, 1);

  const wmAlpha = easeOutCubic(segmentProgress(chapterT, 0.08, 0.22)) * 0.14;
  ctx.save();
  ctx.globalAlpha = wmAlpha;
  drawTextWithShadow(ctx, 'BLIND', width * 0.22, height * (isVertical ? 0.22 : 0.45), {
    font: `700 ${isVertical ? 110 : 148}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.goldDeep,
  });
  drawTextWithShadow(ctx, 'WAR', width * 0.78, height * (isVertical ? 0.22 : 0.45), {
    font: `700 ${isVertical ? 110 : 148}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.cyanRune,
  });
  ctx.restore();

  const emblemT = spring(segmentProgress(chapterT, 0.08, 0.32));
  const maskTease = Math.sin(segmentProgress(chapterT, 0.4, 0.45) * Math.PI) * 0.32;
  const emblemScale = (isVertical ? 1.5 : 1.4) * Math.max(0.01, emblemT);
  const emblemY = height * (isVertical ? 0.33 : 0.36);

  ctx.save();
  ctx.globalAlpha = easeOutCubic(segmentProgress(chapterT, 0.06, 0.18));
  drawWingedMasqueradeEmblem(ctx, width / 2, emblemY, emblemScale, maskTease, timeSec);
  ctx.restore();

  const titleT = easeOutCubic(segmentProgress(chapterT, 0.2, 0.24));
  const titleY = emblemY + (isVertical ? 255 : 215);

  ctx.save();
  ctx.globalAlpha = titleT;

  const plaqueW = isVertical ? 840 : 860;
  const plaqueH = isVertical ? 255 : 238;
  traceRoundedRect(ctx, width / 2 - plaqueW / 2, titleY - 62, plaqueW, plaqueH, 24);
  ctx.fillStyle = 'rgba(10, 8, 22, 0.85)';
  ctx.fill();
  const plaqueBorder = ctx.createLinearGradient(
    width / 2 - plaqueW / 2,
    0,
    width / 2 + plaqueW / 2,
    0,
  );
  plaqueBorder.addColorStop(0, BLIND_WAR_THEME.goldBright);
  plaqueBorder.addColorStop(0.5, BLIND_WAR_THEME.textLight);
  plaqueBorder.addColorStop(1, BLIND_WAR_THEME.cyanRune);
  ctx.strokeStyle = plaqueBorder;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  drawTextWithShadow(ctx, 'COMMENT JOUER  ·  MHLGAMES', width / 2, titleY - 26, {
    font: `700 ${isVertical ? 20 : 18}px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.goldBright,
  });

  drawTextWithShadow(ctx, 'BLIND WAR', width / 2, titleY + 34, {
    font: `700 ${isVertical ? 82 : 84}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.textLight,
    shadowColor: 'rgba(168, 85, 247, 0.75)',
    shadowBlur: 24,
  });

  drawTextWithShadow(
    ctx,
    'Stratégie · Mémoire · Bluff · Pouvoirs',
    width / 2,
    titleY + 98,
    {
      font: `600 ${isVertical ? 26 : 25}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.cyanRune,
      maxWidth: plaqueW - 56,
    },
  );

  drawTextWithShadow(
    ctx,
    'Variante tactique d’échecs  ·  10–50 ans',
    width / 2,
    titleY + 140,
    {
      font: `600 ${isVertical ? 19 : 18}px ${FONT_MONO}`,
      color: BLIND_WAR_THEME.textSoft,
      maxWidth: plaqueW - 56,
    },
  );

  ctx.restore();
}

function renderBoardAndFogChapter(
  ctx: RenderContext2D,
  layout: LayoutZones,
  chapter: ResolvedChapter,
  chapterT: number,
  timeSec: number,
): void {
  const { width, height, boardRect, panelRect, isVertical } = layout;

  drawSplitDualityBackground(ctx, width, height, isVertical ? 0.16 : 0.22, timeSec, 0.72);
  drawChapterHeader(ctx, layout, chapter.label, chapter.headline, chapter.caption, chapterT);

  const boardFade = easeOutCubic(segmentProgress(chapterT, 0, 0.16));
  drawBoard9x9(ctx, boardRect, { fadeIn: boardFade, showGridBadge: true });

  const disguiseT = easeInOutQuart(segmentProgress(chapterT, 0.34, 0.24));
  const isOpponentView = disguiseT > 0.5;

  const lightPieces: ReadonlyArray<{ type: PieceType; col: number; row: number }> = [
    { type: 'rook', col: 0, row: 8 },
    { type: 'knight', col: 2, row: 7 },
    { type: 'queen', col: 3, row: 7 },
    { type: 'king', col: 4, row: 8 },
    { type: 'bishop', col: 6, row: 7 },
    { type: 'pawn', col: 1, row: 6 },
    { type: 'pawn', col: 4, row: 5 },
    { type: 'pawn', col: 7, row: 6 },
  ];

  const darkPieces: ReadonlyArray<{ type: PieceType; col: number; row: number }> = [
    { type: 'king', col: 4, row: 0 },
    { type: 'rook', col: 8, row: 1 },
    { type: 'queen', col: 5, row: 2 },
    { type: 'elite', col: 2, row: 2 },
    { type: 'knight', col: 6, row: 3 },
    { type: 'pawn', col: 1, row: 3 },
    { type: 'pawn', col: 3, row: 3 },
    { type: 'pawn', col: 7, row: 2 },
  ];

  for (const p of lightPieces) {
    const pos = boardSquareCenter(boardRect, p.col, p.row);
    drawChessPiece(ctx, pos.cx, pos.cy, pos.cellSize, p.type, 'light', { timeSec });
  }

  for (let i = 0; i < darkPieces.length; i++) {
    const p = darkPieces[i];
    if (!p) continue;
    const pos = boardSquareCenter(boardRect, p.col, p.row);
    const localDisguise = clamp((disguiseT - i * 0.04) / 0.68, 0, 1);
    drawChessPiece(ctx, pos.cx, pos.cy, pos.cellSize, p.type, 'dark', {
      masked: localDisguise > 0.02,
      maskLift: 1 - localDisguise,
      glowColor: localDisguise > 0.5 ? BLIND_WAR_THEME.violetGlow : undefined,
      timeSec,
    });
  }

  drawTacticalPanelFrame(
    ctx,
    panelRect,
    isOpponentView ? BLIND_WAR_THEME.violetGlow : BLIND_WAR_THEME.goldBright,
    boardFade,
  );

  const px = panelRect.x;
  const py = panelRect.y;
  const pw = panelRect.w;
  const ph = panelRect.h;

  const pillW = Math.min(pw - 80, 440);
  const pillH = 44;
  const pillX = px + pw / 2 - pillW / 2;
  const pillY = py + 28;
  traceRoundedRect(ctx, pillX, pillY, pillW, pillH, 22);
  ctx.fillStyle = isOpponentView ? 'rgba(124, 58, 237, 0.3)' : 'rgba(212, 160, 57, 0.24)';
  ctx.fill();
  ctx.strokeStyle = isOpponentView ? BLIND_WAR_THEME.cyanRune : BLIND_WAR_THEME.goldBright;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawTextWithShadow(
    ctx,
    isOpponentView ? 'VUE ADVERSAIRE : TOUT MASQUÉ' : 'IDENTITÉS RÉELLES',
    px + pw / 2,
    pillY + pillH / 2 + 1,
    {
      font: `700 17px ${FONT_MONO}`,
      color: isOpponentView ? BLIND_WAR_THEME.cyanRune : BLIND_WAR_THEME.goldBright,
      maxWidth: pillW - 28,
    },
  );

  const rowY = py + (isVertical ? 190 : 230);
  const sampleTypes: readonly PieceType[] = ['queen', 'elite', 'knight'];
  const sampleNames = ['REINE', 'ÉLITE', 'CAVALIER'] as const;
  const colSpan = (pw - 110) / 3;

  for (let i = 0; i < 3; i++) {
    const scx = px + 55 + colSpan * (i + 0.5);
    const pt = sampleTypes[i]!;
    const pName = sampleNames[i]!;

    traceRoundedRect(ctx, scx - 86, rowY - 72, 172, 162, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.strokeStyle = isOpponentView ? 'rgba(168, 85, 247, 0.45)' : 'rgba(248, 216, 120, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawChessPiece(ctx, scx, rowY - 12, 82, pt, 'dark', {
      masked: disguiseT > 0.05,
      maskLift: 1 - disguiseT,
      timeSec,
    });

    drawTextWithShadow(ctx, isOpponentView ? 'PION MASQUÉ ?' : pName, scx, rowY + 62, {
      font: `700 15px ${FONT_MONO}`,
      color: isOpponentView ? BLIND_WAR_THEME.violetGlow : BLIND_WAR_THEME.goldBright,
      maxWidth: 156,
    });
  }

  const infoY = py + ph - (isVertical ? 128 : 168);
  drawTextWithShadow(ctx, 'BROUILLARD DE DUPLICITÉ', px + pw / 2, infoY, {
    font: `700 ${isVertical ? 26 : 28}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.textLight,
    maxWidth: pw - 72,
  });
  drawTextWithShadow(
    ctx,
    'Une Reine peut se cacher sous l’apparence d’un simple pion.',
    px + pw / 2,
    infoY + 42,
    {
      font: `500 ${isVertical ? 20 : 21}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.textSoft,
      maxWidth: pw - 72,
    },
  );
  drawTextWithShadow(
    ctx,
    'Mémorisez chaque déplacement pour déjouer le bluff.',
    px + pw / 2,
    infoY + 78,
    {
      font: `600 ${isVertical ? 20 : 21}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.cyanRune,
      maxWidth: pw - 72,
    },
  );
}

function renderPawnScoutChapter(
  ctx: RenderContext2D,
  layout: LayoutZones,
  chapter: ResolvedChapter,
  chapterT: number,
  timeSec: number,
): void {
  const { width, height, boardRect, panelRect, isVertical } = layout;

  drawSplitDualityBackground(ctx, width, height, isVertical ? 0.16 : 0.24, timeSec, 0.78);
  drawChapterHeader(ctx, layout, chapter.label, chapter.headline, chapter.caption, chapterT);

  const moveT = easeInOutQuart(segmentProgress(chapterT, 0.08, 0.3));
  const pawnCol = 5;
  const pawnRow = lerp(6, 4, moveT);

  const scanT = segmentProgress(chapterT, 0.38, 0.3);
  const maskLift = easeOutCubic(segmentProgress(chapterT, 0.45, 0.22));

  const highlights: TileHighlight[] = [];
  if (moveT > 0.88) {
    const hlAlpha = clamp((moveT - 0.88) / 0.12, 0, 1) * 0.28;
    const dirs = [
      [0, -1],
      [1, 0],
      [-1, 0],
      [0, 1],
      [1, -1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ] as const;
    for (const [dc, dr] of dirs) {
      highlights.push({
        col: 5 + dc,
        row: 4 + dr,
        color: dc === 0 && dr === -1 ? BLIND_WAR_THEME.emeraldReveal : BLIND_WAR_THEME.cyanRune,
        alpha: dc === 0 && dr === -1 ? hlAlpha * 1.65 : hlAlpha * 0.7,
      });
    }
  }

  drawBoard9x9(ctx, boardRect, { highlights, showGridBadge: false });

  const staticPieces: ReadonlyArray<{
    type: PieceType;
    faction: PieceFaction;
    col: number;
    row: number;
    masked?: boolean;
  }> = [
    { type: 'king', faction: 'light', col: 4, row: 8 },
    { type: 'rook', faction: 'light', col: 1, row: 7 },
    { type: 'pawn', faction: 'light', col: 2, row: 6 },
    { type: 'king', faction: 'dark', col: 4, row: 0 },
    { type: 'knight', faction: 'dark', col: 2, row: 2, masked: true },
    { type: 'rook', faction: 'dark', col: 7, row: 2, masked: true },
  ];

  for (const sp of staticPieces) {
    const pos = boardSquareCenter(boardRect, sp.col, sp.row);
    drawChessPiece(ctx, pos.cx, pos.cy, pos.cellSize, sp.type, sp.faction, {
      masked: sp.masked,
      timeSec,
    });
  }

  const targetPos = boardSquareCenter(boardRect, 5, 3);
  drawChessPiece(ctx, targetPos.cx, targetPos.cy, targetPos.cellSize, 'queen', 'dark', {
    masked: true,
    maskLift,
    glowColor: maskLift > 0.2 ? BLIND_WAR_THEME.emeraldReveal : BLIND_WAR_THEME.violetGlow,
    timeSec,
  });

  const pawnPos = boardSquareCenter(boardRect, pawnCol, pawnRow);
  drawChessPiece(ctx, pawnPos.cx, pawnPos.cy, pawnPos.cellSize, 'pawn', 'light', {
    glowColor: BLIND_WAR_THEME.goldBright,
    scale: 1.06,
    timeSec,
  });

  if (scanT > 0.01) {
    drawAdjacencyScannerPulse(ctx, boardRect, 5, 4, 5, 3, scanT);
  }

  drawTacticalPanelFrame(ctx, panelRect, BLIND_WAR_THEME.cyanRune, 1);

  const px = panelRect.x;
  const py = panelRect.y;
  const pw = panelRect.w;
  const ph = panelRect.h;

  drawTextWithShadow(ctx, 'MÉCANIQUE DU PION COLLÉ', px + pw / 2, py + 48, {
    font: `700 ${isVertical ? 25 : 27}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.goldBright,
    maxWidth: pw - 64,
  });

  const diagY = py + (isVertical ? 198 : 240);
  const leftX = px + pw * 0.23;
  const midX = px + pw * 0.5;
  const rightX = px + pw * 0.77;

  traceRoundedRect(ctx, leftX - 95, diagY - 76, 190, 162, 18);
  ctx.fillStyle = 'rgba(248, 216, 120, 0.1)';
  ctx.fill();
  ctx.strokeStyle = BLIND_WAR_THEME.goldBright;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawChessPiece(ctx, leftX, diagY - 12, 86, 'pawn', 'light', { timeSec });
  drawTextWithShadow(ctx, 'VOTRE PION', leftX, diagY + 60, {
    font: `700 15px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.goldBright,
  });

  drawTextWithShadow(ctx, 'AU CONTACT', midX, diagY - 26, {
    font: `700 15px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.cyanRune,
  });
  ctx.save();
  ctx.strokeStyle = BLIND_WAR_THEME.cyanRune;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(midX - 46, diagY + 4);
  ctx.lineTo(midX + 38, diagY + 4);
  ctx.lineTo(midX + 24, diagY - 10);
  ctx.moveTo(midX + 38, diagY + 4);
  ctx.lineTo(midX + 24, diagY + 18);
  ctx.stroke();
  ctx.restore();

  traceRoundedRect(ctx, rightX - 95, diagY - 76, 190, 162, 18);
  ctx.fillStyle = maskLift > 0.5 ? 'rgba(52, 211, 153, 0.14)' : 'rgba(168, 85, 247, 0.12)';
  ctx.fill();
  ctx.strokeStyle =
    maskLift > 0.5 ? BLIND_WAR_THEME.emeraldReveal : BLIND_WAR_THEME.violetGlow;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawChessPiece(ctx, rightX, diagY - 12, 86, 'queen', 'dark', {
    masked: true,
    maskLift,
    timeSec,
  });
  drawTextWithShadow(
    ctx,
    maskLift > 0.5 ? 'VRAIE REINE !' : 'CIBLE MASQUÉE',
    rightX,
    diagY + 60,
    {
      font: `700 15px ${FONT_MONO}`,
      color: maskLift > 0.5 ? BLIND_WAR_THEME.emeraldReveal : BLIND_WAR_THEME.violetGlow,
    },
  );

  const footY = py + ph - (isVertical ? 126 : 165);
  drawTextWithShadow(ctx, 'LES PIONS SONT VOS ÉCLAIREURS', px + pw / 2, footY, {
    font: `700 ${isVertical ? 23 : 24}px ${FONT_SANS}`,
    color: BLIND_WAR_THEME.textLight,
    maxWidth: pw - 72,
  });
  drawTextWithShadow(
    ctx,
    'La pièce ennemie reste révélée tant que votre pion reste adjacent.',
    px + pw / 2,
    footY + 42,
    {
      font: `500 ${isVertical ? 19 : 20}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.textSoft,
      maxWidth: pw - 72,
    },
  );
}

function renderCardsAndEliteChapter(
  ctx: RenderContext2D,
  layout: LayoutZones,
  chapter: ResolvedChapter,
  chapterT: number,
  timeSec: number,
): void {
  const { width, height, boardRect, panelRect, isVertical } = layout;

  drawSplitDualityBackground(ctx, width, height, isVertical ? 0.15 : 0.2, timeSec, 0.65);
  drawChapterHeader(ctx, layout, chapter.label, chapter.headline, chapter.caption, chapterT);

  const swapT = easeInOutQuart(segmentProgress(chapterT, 0.14, 0.22));
  const flipT = easeOutCubic(segmentProgress(chapterT, 0.04, 0.16));
  const cooldownSweep = 1 - segmentProgress(chapterT, 0.18, 0.42) * 0.45;
  const eliteFocusT = easeOutCubic(segmentProgress(chapterT, 0.48, 0.14));
  const blockT = segmentProgress(chapterT, 0.56, 0.2);
  const royalCaptureT = segmentProgress(chapterT, 0.72, 0.22);

  const highlights: TileHighlight[] = [];
  if (swapT > 0.05 && swapT < 0.98) {
    highlights.push({ col: 2, row: 6, color: BLIND_WAR_THEME.cyanRune, alpha: 0.4 });
    highlights.push({ col: 6, row: 6, color: BLIND_WAR_THEME.violetGlow, alpha: 0.4 });
  }
  if (eliteFocusT > 0.05) {
    highlights.push({
      col: 4,
      row: 3,
      color: BLIND_WAR_THEME.royalGold,
      alpha: 0.35 * eliteFocusT,
    });
  }

  drawBoard9x9(ctx, boardRect, { highlights });

  const swapColA = lerp(2, 6, swapT);
  const swapColB = lerp(6, 2, swapT);
  const swapArcY = Math.sin(swapT * Math.PI) * -0.55;

  const posA = boardSquareCenter(boardRect, swapColA, 6 + swapArcY);
  const posB = boardSquareCenter(boardRect, swapColB, 6 - swapArcY);

  drawChessPiece(ctx, posA.cx, posA.cy, posA.cellSize, 'knight', 'light', {
    glowColor: swapT > 0.05 && swapT < 0.95 ? BLIND_WAR_THEME.cyanRune : undefined,
    timeSec,
  });
  drawChessPiece(ctx, posB.cx, posB.cy, posB.cellSize, 'queen', 'light', {
    glowColor: BLIND_WAR_THEME.goldBright,
    timeSec,
  });

  const kingPos = boardSquareCenter(boardRect, 4, 5);
  drawChessPiece(ctx, kingPos.cx, kingPos.cy, kingPos.cellSize, 'king', 'light', { timeSec });

  const pawnPos = boardSquareCenter(boardRect, 3, 4);
  drawChessPiece(ctx, pawnPos.cx, pawnPos.cy, pawnPos.cellSize, 'pawn', 'light', { timeSec });

  const darkKing = boardSquareCenter(boardRect, 4, 0);
  drawChessPiece(ctx, darkKing.cx, darkKing.cy, darkKing.cellSize, 'king', 'dark', { timeSec });

  const elitePos = boardSquareCenter(boardRect, 4, 3);
  drawChessPiece(ctx, elitePos.cx, elitePos.cy, elitePos.cellSize, 'elite', 'dark', {
    royalShield: true,
    glowColor: BLIND_WAR_THEME.royalGold,
    scale: 1 + 0.08 * eliteFocusT,
    timeSec,
  });

  if (blockT > 0.05) {
    ctx.save();
    ctx.strokeStyle = BLIND_WAR_THEME.royalCrimson;
    ctx.lineWidth = 4;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(pawnPos.cx, pawnPos.cy);
    ctx.lineTo(lerp(pawnPos.cx, elitePos.cx, 0.72), lerp(pawnPos.cy, elitePos.cy, 0.72));
    ctx.stroke();
    ctx.setLineDash([]);

    const bx = lerp(pawnPos.cx, elitePos.cx, 0.65);
    const by = lerp(pawnPos.cy, elitePos.cy, 0.65);
    ctx.fillStyle = BLIND_WAR_THEME.royalCrimson;
    ctx.beginPath();
    ctx.arc(bx, by, 16, 0, Math.PI * 2);
    ctx.fill();
    drawTextWithShadow(ctx, '✕', bx, by + 1, {
      font: `700 18px ${FONT_SANS}`,
      color: '#FFFFFF',
    });
    ctx.restore();
  }

  if (royalCaptureT > 0.05) {
    ctx.save();
    ctx.strokeStyle = BLIND_WAR_THEME.emeraldReveal;
    ctx.lineWidth = 4.5;
    ctx.shadowColor = BLIND_WAR_THEME.emeraldReveal;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(kingPos.cx, kingPos.cy);
    ctx.lineTo(
      lerp(kingPos.cx, elitePos.cx, royalCaptureT),
      lerp(kingPos.cy, elitePos.cy, royalCaptureT),
    );
    ctx.stroke();
    ctx.restore();
  }

  drawTacticalPanelFrame(ctx, panelRect, BLIND_WAR_THEME.royalGold, 1);

  const px = panelRect.x;
  const py = panelRect.y;
  const pw = panelRect.w;
  const ph = panelRect.h;

  const leftCenterX = px + pw * 0.27;
  const rightCenterX = px + pw * 0.72;
  const cardCy = py + ph * 0.49;

  drawTextWithShadow(ctx, '1. CARTES DE POUVOIRS', leftCenterX, py + 38, {
    font: `700 17px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.cyanRune,
  });

  drawPowerCard(ctx, {
    cx: leftCenterX,
    cy: cardCy,
    width: isVertical ? 245 : 245,
    height: isVertical ? 310 : 340,
    flipT,
    cooldownProgress: cooldownSweep,
    cooldownTurns: 3,
    title: 'ÉCHANGE MIRAGE',
    subtitle: 'Permute 2 alliés',
  });

  drawTextWithShadow(ctx, 'Temps de recharge actif', leftCenterX, py + ph - 36, {
    font: `600 16px ${FONT_SANS}`,
    color: BLIND_WAR_THEME.textSoft,
    maxWidth: pw * 0.44,
  });

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.51, py + 36);
  ctx.lineTo(px + pw * 0.51, py + ph - 36);
  ctx.stroke();
  ctx.restore();

  drawTextWithShadow(ctx, '2. PIÈCE ÉLITE ROYALE', rightCenterX, py + 38, {
    font: `700 17px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.royalGold,
  });

  drawChessPiece(ctx, rightCenterX, py + ph * 0.27, isVertical ? 114 : 124, 'elite', 'dark', {
    royalShield: true,
    glowColor: BLIND_WAR_THEME.royalGold,
    timeSec,
  });

  drawTextWithShadow(ctx, 'BARRIÈRE ROYALE', rightCenterX, py + ph * 0.46, {
    font: `700 21px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.royalGold,
  });

  const allowY = py + ph * 0.62;
  traceRoundedRect(ctx, rightCenterX - 170, allowY - 32, 340, 64, 14);
  ctx.fillStyle = 'rgba(52, 211, 153, 0.14)';
  ctx.fill();
  ctx.strokeStyle = BLIND_WAR_THEME.emeraldReveal;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawChessPiece(ctx, rightCenterX - 122, allowY, 42, 'king', 'light', { timeSec });
  drawChessPiece(ctx, rightCenterX - 72, allowY, 42, 'queen', 'light', { timeSec });
  drawTextWithShadow(ctx, '✓  ROI OU REINE SEULS', rightCenterX + 44, allowY + 1, {
    font: `700 14px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.emeraldReveal,
    maxWidth: 195,
  });

  const denyY = py + ph * 0.8;
  traceRoundedRect(ctx, rightCenterX - 170, denyY - 28, 340, 56, 14);
  ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
  ctx.fill();
  ctx.strokeStyle = BLIND_WAR_THEME.royalCrimson;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  drawTextWithShadow(ctx, '✕  AUTRES PIÈCES BLOQUÉES', rightCenterX, denyY + 1, {
    font: `700 14px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.royalCrimson,
    maxWidth: 310,
  });
}

function renderRecapChapter(
  ctx: RenderContext2D,
  layout: LayoutZones,
  chapter: ResolvedChapter,
  chapterT: number,
  timeSec: number,
): void {
  const { width, height, isVertical } = layout;
  const splitRatio = lerp(0.2, 0.5, easeInOutQuart(segmentProgress(chapterT, 0, 0.28)));

  drawSplitDualityBackground(ctx, width, height, splitRatio, timeSec, 0.95);

  const emblemT = easeOutBack(segmentProgress(chapterT, 0.03, 0.24));
  const emblemX = isVertical ? width / 2 : width * 0.28;
  const emblemY = isVertical ? height * 0.19 : height * 0.42;
  drawWingedMasqueradeEmblem(
    ctx,
    emblemX,
    emblemY,
    (isVertical ? 1.0 : 1.22) * Math.max(0.01, emblemT),
    0.08,
    timeSec,
  );

  const textX = isVertical ? width / 2 : width * 0.67;
  const topY = isVertical ? height * 0.34 : 138;
  const hdrPlaqueW = isVertical ? 840 : 760;
  const hdrPlaqueH = 98;

  traceRoundedRect(ctx, textX - hdrPlaqueW / 2, topY - 58, hdrPlaqueW, hdrPlaqueH, 20);
  ctx.fillStyle = 'rgba(10, 8, 22, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 160, 57, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  drawTextWithShadow(ctx, 'MHLGAMES PRÉSENTE', textX, topY - 34, {
    font: `700 16px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.goldBright,
  });
  drawTextWithShadow(ctx, chapter.headline, textX, topY + 10, {
    font: `700 ${isVertical ? 50 : 48}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.textLight,
    shadowColor: 'rgba(124, 58, 237, 0.8)',
    shadowBlur: 20,
    maxWidth: hdrPlaqueW - 48,
  });

  const badges = [
    { title: 'ÉCHIQUIER 9×9', sub: 'Terrain élargi entre marbre et cosmos', color: BLIND_WAR_THEME.goldBright },
    { title: 'PIÈCES MASQUÉES', sub: 'Bluff et mémoire sous cape d’illusion', color: BLIND_WAR_THEME.violetGlow },
    { title: 'RÉVÉLATION PAR PION COLLÉ', sub: 'Placez un pion adjacent pour démasquer', color: BLIND_WAR_THEME.cyanRune },
    { title: 'CARTES DE POUVOIRS', sub: 'Capacités à temps de recharge tactique', color: BLIND_WAR_THEME.magentaAccent },
    { title: 'ÉLITE ROYALE', sub: 'Éliminable uniquement par Roi ou Reine', color: BLIND_WAR_THEME.royalGold },
  ] as const;

  const cardW = isVertical ? 840 : 760;
  const cardH = isVertical ? 88 : 76;
  const gap = isVertical ? 16 : 14;
  const listStartY = topY + (isVertical ? 66 : 64);

  for (let i = 0; i < badges.length; i++) {
    const item = badges[i]!;
    const itemT = easeOutCubic(segmentProgress(chapterT, 0.08 + i * 0.07, 0.18));
    const slideX = (1 - itemT) * 40;
    const bx = textX - cardW / 2 + slideX;
    const by = listStartY + i * (cardH + gap);

    ctx.save();
    ctx.globalAlpha = itemT;
    traceRoundedRect(ctx, bx, by, cardW, cardH, 16);
    ctx.fillStyle = 'rgba(10, 8, 22, 0.86)';
    ctx.fill();
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(bx + 34, by + cardH / 2, 15, 0, Math.PI * 2);
    ctx.fill();
    drawTextWithShadow(ctx, String(i + 1), bx + 34, by + cardH / 2 + 1, {
      font: `700 15px ${FONT_MONO}`,
      color: '#090714',
    });

    drawTextWithShadow(ctx, item.title, bx + 68, by + cardH * 0.36, {
      font: `700 ${isVertical ? 20 : 19}px ${FONT_MONO}`,
      color: item.color,
      align: 'left',
      maxWidth: cardW - 92,
    });
    drawTextWithShadow(ctx, item.sub, bx + 68, by + cardH * 0.7, {
      font: `500 ${isVertical ? 18 : 17}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.textSoft,
      align: 'left',
      maxWidth: cardW - 92,
    });
    ctx.restore();
  }

  const ctaY = listStartY + badges.length * (cardH + gap) + (isVertical ? 34 : 26);
  const ctaT = easeOutCubic(segmentProgress(chapterT, 0.45, 0.2));
  ctx.save();
  ctx.globalAlpha = ctaT;
  const ctaW = isVertical ? 760 : 660;
  const ctaH = 56;
  traceRoundedRect(ctx, textX - ctaW / 2, ctaY, ctaW, ctaH, 28);
  const ctaGrad = ctx.createLinearGradient(textX - ctaW / 2, 0, textX + ctaW / 2, 0);
  ctaGrad.addColorStop(0, BLIND_WAR_THEME.goldRich);
  ctaGrad.addColorStop(0.5, BLIND_WAR_THEME.nebulaViolet);
  ctaGrad.addColorStop(1, BLIND_WAR_THEME.cyanRune);
  ctx.fillStyle = ctaGrad;
  ctx.fill();
  drawTextWithShadow(ctx, 'JOUER À BLIND WAR  ·  PERCEZ LE MASQUE', textX, ctaY + ctaH / 2 + 1, {
    font: `700 ${isVertical ? 20 : 19}px ${FONT_MONO}`,
    color: '#FFFFFF',
    maxWidth: ctaW - 40,
  });
  ctx.restore();
}

/**
 * Pure deterministic frame renderer for BLIND WAR voiced & subtitled explainer video.
 * Supports 16:9 (1920x1080) and 9:16 (1080x1920) cleanly.
 */
export function renderFrame(
  ctx: RenderContext2D,
  frameIndex: number,
  timeline: MasterTimeline,
  aspectRatio: AspectMode,
  options: RenderOptions = {},
): void {
  const layout = computeLayout(aspectRatio);
  const clampedFrame = clamp(frameIndex, 0, Math.max(0.0001, timeline.totalFrames - 1e-6));
  const active = getChapterAtFrame(clampedFrame, timeline);
  const timeSec = clampedFrame / timeline.fps;

  ctx.save();
  ctx.clearRect(0, 0, layout.width, layout.height);

  switch (active.chapter.id) {
    case 'hook':
      renderHookChapter(ctx, layout, active.localProgress, timeSec);
      break;
    case 'board-fog':
      renderBoardAndFogChapter(ctx, layout, active.chapter, active.localProgress, timeSec);
      break;
    case 'pawn-scout':
      renderPawnScoutChapter(ctx, layout, active.chapter, active.localProgress, timeSec);
      break;
    case 'cards-elite':
      renderCardsAndEliteChapter(ctx, layout, active.chapter, active.localProgress, timeSec);
      break;
    case 'recap':
      renderRecapChapter(ctx, layout, active.chapter, active.localProgress, timeSec);
      break;
  }

  // Synchronized burned-in dynamic subtitles (safe-zone positioned for 16:9 and 9:16)
  const activeCue = getActiveSubtitleCue(timeline, timeSec);
  drawSubtitleOverlay(
    ctx,
    layout.width,
    layout.height,
    activeCue,
    layout.isVertical,
    options.showSubtitles ?? true,
  );

  // Bottom deterministic chapter progress HUD
  drawChapterProgressBar(
    ctx,
    layout.width,
    layout.height,
    timeline.chapters,
    clampedFrame,
    timeline.totalFrames,
    layout.isVertical,
  );

  ctx.restore();
}
