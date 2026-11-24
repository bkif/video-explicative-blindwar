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
  progress,
  spring,
} from './primitives';
import {
  STORYBOARD_CHAPTERS,
  VIDEO_FPS,
  getChapterAtFrame,
} from './storyboard';
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
      headerY: 74,
      boardRect: { x: 130, y: 190, size: 710 },
      panelRect: { x: 910, y: 190, w: 880, h: 710 },
    };
  }

  return {
    width,
    height,
    isVertical: true,
    headerY: 96,
    boardRect: { x: 150, y: 285, size: 780 },
    panelRect: { x: 76, y: 1100, w: 928, h: 645 },
  };
}

function drawChapterHeader(
  ctx: RenderContext2D,
  layout: LayoutZones,
  label: string,
  headline: string,
  caption: string,
  enterT: number,
): void {
  const { width, isVertical, headerY } = layout;
  const alpha = easeOutCubic(clamp(enterT * 2.2, 0, 1));
  const slideY = (1 - easeOutCubic(clamp(enterT * 1.8, 0, 1))) * 18;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Subtle dark glass header pill so white typography stays crisp across split seam
  if (isVertical) {
    const hdrW = width - 64;
    const hdrH = 172;
    traceRoundedRect(ctx, 32, headerY - 52 + slideY, hdrW, hdrH, 22);
    ctx.fillStyle = 'rgba(10, 8, 22, 0.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 160, 57, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Chapter pill + MHLGames studio tag
  const pillW = isVertical ? 300 : 280;
  const pillH = 34;
  const px = width / 2 - pillW / 2;
  const py = headerY - 38 + slideY;
  traceRoundedRect(ctx, px, py, pillW, pillH, 17);
  ctx.fillStyle = 'rgba(13, 10, 28, 0.85)';
  ctx.fill();
  ctx.strokeStyle = BLIND_WAR_THEME.goldRich;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  drawTextWithShadow(ctx, `${label}  ·  MHLGAMES`, width / 2, py + pillH / 2 + 0.5, {
    font: `700 13px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.goldBright,
    maxWidth: pillW - 24,
  });

  // Main chapter headline
  drawTextWithShadow(ctx, headline, width / 2, headerY + 26 + slideY, {
    font: `700 ${isVertical ? 46 : 44}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.textLight,
    shadowColor: 'rgba(124, 58, 237, 0.7)',
    shadowBlur: 18,
    maxWidth: width - (isVertical ? 96 : 240),
  });

  // Concise 1-line rule caption
  drawTextWithShadow(ctx, caption, width / 2, headerY + (isVertical ? 78 : 70) + slideY, {
    font: `500 ${isVertical ? 24 : 22}px ${FONT_SANS}`,
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
  localFrame: number,
  durationFrames: number,
  timeSec: number,
): void {
  const { width, height, isVertical } = layout;
  const wipeT = easeInOutQuart(progress(localFrame, 0, durationFrames * 0.34));
  const splitRatio = lerp(0.06, 0.5, wipeT);

  drawSplitDualityBackground(ctx, width, height, splitRatio, timeSec, 1);

  // Subtle side watermarks ("BLIND" on marble left, "WAR" on cosmic right)
  const wmAlpha = easeOutCubic(progress(localFrame, 12, 28)) * 0.14;
  ctx.save();
  ctx.globalAlpha = wmAlpha;
  drawTextWithShadow(ctx, 'BLIND', width * 0.22, height * (isVertical ? 0.24 : 0.48), {
    font: `700 ${isVertical ? 110 : 148}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.goldDeep,
  });
  drawTextWithShadow(ctx, 'WAR', width * 0.78, height * (isVertical ? 0.24 : 0.48), {
    font: `700 ${isVertical ? 110 : 148}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.cyanRune,
  });
  ctx.restore();

  // Central winged masquerade crown emblem
  const emblemT = spring(progress(localFrame, 10, 42));
  const maskTease = Math.sin(progress(localFrame, 48, 55) * Math.PI) * 0.32;
  const emblemScale = (isVertical ? 1.55 : 1.45) * Math.max(0.01, emblemT);
  const emblemY = height * (isVertical ? 0.36 : 0.39);

  ctx.save();
  ctx.globalAlpha = easeOutCubic(progress(localFrame, 8, 22));
  drawWingedMasqueradeEmblem(ctx, width / 2, emblemY, emblemScale, maskTease, timeSec);
  ctx.restore();

  // Title plaque
  const titleT = easeOutCubic(progress(localFrame, 26, 28));
  const titleY = emblemY + (isVertical ? 265 : 222);

  ctx.save();
  ctx.globalAlpha = titleT;

  const plaqueW = isVertical ? 840 : 860;
  const plaqueH = isVertical ? 262 : 244;
  traceRoundedRect(ctx, width / 2 - plaqueW / 2, titleY - 64, plaqueW, plaqueH, 24);
  ctx.fillStyle = 'rgba(10, 8, 22, 0.84)';
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

  drawTextWithShadow(ctx, 'HOW TO PLAY  ·  MHLGAMES', width / 2, titleY - 26, {
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
    'Strategy · Memory · Bluffing · Arcane Powers',
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
    'Tactical Chess Variant  ·  Ages 10–50',
    width / 2,
    titleY + 142,
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
  localFrame: number,
  durationFrames: number,
  timeSec: number,
): void {
  const { width, height, boardRect, panelRect, isVertical } = layout;
  const ch = STORYBOARD_CHAPTERS[1]!;

  drawSplitDualityBackground(ctx, width, height, 0.22, timeSec, 0.72);
  const enterT = progress(localFrame, 0, 28);
  drawChapterHeader(ctx, layout, ch.label, ch.headline, ch.caption, enterT);

  const boardFade = easeOutCubic(progress(localFrame, 0, 22));
  drawBoard9x9(ctx, boardRect, { fadeIn: boardFade, showGridBadge: true });

  // Fog toggle progress: 0..0.38 = Your View (revealed), 0.38..0.62 = transforms to Masked Pawns!
  const disguiseT = easeInOutQuart(progress(localFrame, durationFrames * 0.34, durationFrames * 0.24));
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
    // Staggered fog descent
    const localDisguise = clamp((disguiseT - i * 0.04) / 0.68, 0, 1);
    drawChessPiece(ctx, pos.cx, pos.cy, pos.cellSize, p.type, 'dark', {
      masked: localDisguise > 0.02,
      maskLift: 1 - localDisguise,
      glowColor: localDisguise > 0.5 ? BLIND_WAR_THEME.violetGlow : undefined,
      timeSec,
    });
  }

  // Right / Bottom Tactical Panel explaining Fog of Deception
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

  // POV Switch Pill
  const pillW = Math.min(pw - 80, 420);
  const pillH = 48;
  const pillX = px + pw / 2 - pillW / 2;
  const pillY = py + 34;
  traceRoundedRect(ctx, pillX, pillY, pillW, pillH, 24);
  ctx.fillStyle = isOpponentView ? 'rgba(124, 58, 237, 0.3)' : 'rgba(212, 160, 57, 0.24)';
  ctx.fill();
  ctx.strokeStyle = isOpponentView ? BLIND_WAR_THEME.cyanRune : BLIND_WAR_THEME.goldBright;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawTextWithShadow(
    ctx,
    isOpponentView ? "OPPONENT'S VIEW: ALL MASKED" : 'TRUE BOARD IDENTITIES',
    px + pw / 2,
    pillY + pillH / 2 + 1,
    {
      font: `700 18px ${FONT_MONO}`,
      color: isOpponentView ? BLIND_WAR_THEME.cyanRune : BLIND_WAR_THEME.goldBright,
      maxWidth: pillW - 28,
    },
  );

  // Showcase transformation row inside panel
  const rowY = py + (isVertical ? 215 : 240);
  const sampleTypes: readonly PieceType[] = ['queen', 'elite', 'knight'];
  const sampleNames = ['QUEEN', 'ELITE', 'KNIGHT'] as const;
  const colSpan = (pw - 120) / 3;

  for (let i = 0; i < 3; i++) {
    const scx = px + 60 + colSpan * (i + 0.5);
    const pt = sampleTypes[i]!;
    const pName = sampleNames[i]!;

    // Card slot
    traceRoundedRect(ctx, scx - 86, rowY - 78, 172, 174, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    ctx.strokeStyle = isOpponentView ? 'rgba(168, 85, 247, 0.45)' : 'rgba(248, 216, 120, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawChessPiece(ctx, scx, rowY - 12, 86, pt, 'dark', {
      masked: disguiseT > 0.05,
      maskLift: 1 - disguiseT,
      timeSec,
    });

    drawTextWithShadow(ctx, isOpponentView ? 'MASKED PAWN ?' : pName, scx, rowY + 66, {
      font: `700 15px ${FONT_MONO}`,
      color: isOpponentView ? BLIND_WAR_THEME.violetGlow : BLIND_WAR_THEME.goldBright,
      maxWidth: 156,
    });
  }

  // Key takeaway lines at bottom of panel
  const infoY = py + ph - (isVertical ? 145 : 175);
  drawTextWithShadow(ctx, 'FOG OF DECEPTION', px + pw / 2, infoY, {
    font: `700 ${isVertical ? 28 : 30}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.textLight,
    maxWidth: pw - 72,
  });
  drawTextWithShadow(
    ctx,
    'Expanded 9×9 battlefield hides Queens & Elite threats.',
    px + pw / 2,
    infoY + 46,
    {
      font: `500 ${isVertical ? 21 : 22}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.textSoft,
      maxWidth: pw - 72,
    },
  );
  drawTextWithShadow(
    ctx,
    'Use memory & bluffing to track disguised enemy ranks.',
    px + pw / 2,
    infoY + 84,
    {
      font: `600 ${isVertical ? 21 : 22}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.cyanRune,
      maxWidth: pw - 72,
    },
  );
}

function renderPawnScoutChapter(
  ctx: RenderContext2D,
  layout: LayoutZones,
  localFrame: number,
  durationFrames: number,
  timeSec: number,
): void {
  const { width, height, boardRect, panelRect, isVertical } = layout;
  const ch = STORYBOARD_CHAPTERS[2]!;

  drawSplitDualityBackground(ctx, width, height, 0.25, timeSec, 0.78);
  drawChapterHeader(ctx, layout, ch.label, ch.headline, ch.caption, progress(localFrame, 0, 24));

  // Pawn moves from (5, 6) -> (5, 4) adjacent to masked enemy at (5, 3)
  const moveT = easeInOutQuart(progress(localFrame, 12, durationFrames * 0.3));
  const pawnCol = 5;
  const pawnRow = lerp(6, 4, moveT);

  const scanT = progress(localFrame, durationFrames * 0.36, durationFrames * 0.32);
  const maskLift = easeOutCubic(progress(localFrame, durationFrames * 0.44, durationFrames * 0.24));

  // Highlight adjacent squares around Pawn once arrived
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

  // Supporting pieces on board
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

  // Target disguised Queen at (5, 3)
  const targetPos = boardSquareCenter(boardRect, 5, 3);
  drawChessPiece(ctx, targetPos.cx, targetPos.cy, targetPos.cellSize, 'queen', 'dark', {
    masked: true,
    maskLift,
    glowColor: maskLift > 0.2 ? BLIND_WAR_THEME.emeraldReveal : BLIND_WAR_THEME.violetGlow,
    timeSec,
  });

  // Moving Light Scouting Pawn
  const pawnPos = boardSquareCenter(boardRect, pawnCol, pawnRow);
  drawChessPiece(ctx, pawnPos.cx, pawnPos.cy, pawnPos.cellSize, 'pawn', 'light', {
    glowColor: BLIND_WAR_THEME.goldBright,
    scale: 1.06,
    timeSec,
  });

  if (scanT > 0.01) {
    drawAdjacencyScannerPulse(ctx, boardRect, 5, 4, 5, 3, scanT);
  }

  // Tactical Rule Panel
  drawTacticalPanelFrame(ctx, panelRect, BLIND_WAR_THEME.cyanRune, 1);

  const px = panelRect.x;
  const py = panelRect.y;
  const pw = panelRect.w;
  const ph = panelRect.h;

  drawTextWithShadow(ctx, 'THE "COLLAGE" SCOUT MECHANIC', px + pw / 2, py + 54, {
    font: `700 ${isVertical ? 26 : 28}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.goldBright,
    maxWidth: pw - 64,
  });

  // Visual equation: [Light Pawn] + [Adjacent Link] -> [Revealed Queen]
  const diagY = py + (isVertical ? 220 : 250);
  const leftX = px + pw * 0.23;
  const midX = px + pw * 0.5;
  const rightX = px + pw * 0.77;

  // Left box: Pawn Scout
  traceRoundedRect(ctx, leftX - 95, diagY - 82, 190, 175, 18);
  ctx.fillStyle = 'rgba(248, 216, 120, 0.1)';
  ctx.fill();
  ctx.strokeStyle = BLIND_WAR_THEME.goldBright;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawChessPiece(ctx, leftX, diagY - 12, 92, 'pawn', 'light', { timeSec });
  drawTextWithShadow(ctx, 'YOUR PAWN', leftX, diagY + 66, {
    font: `700 15px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.goldBright,
  });

  // Center arrow + "ADJACENT"
  drawTextWithShadow(ctx, 'ADJACENT', midX, diagY - 26, {
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

  // Right box: Target Unmasked!
  traceRoundedRect(ctx, rightX - 95, diagY - 82, 190, 175, 18);
  ctx.fillStyle = maskLift > 0.5 ? 'rgba(52, 211, 153, 0.14)' : 'rgba(168, 85, 247, 0.12)';
  ctx.fill();
  ctx.strokeStyle =
    maskLift > 0.5 ? BLIND_WAR_THEME.emeraldReveal : BLIND_WAR_THEME.violetGlow;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawChessPiece(ctx, rightX, diagY - 12, 92, 'queen', 'dark', {
    masked: true,
    maskLift,
    timeSec,
  });
  drawTextWithShadow(
    ctx,
    maskLift > 0.5 ? 'TRUE QUEEN!' : 'DISGUISED FOE',
    rightX,
    diagY + 66,
    {
      font: `700 15px ${FONT_MONO}`,
      color: maskLift > 0.5 ? BLIND_WAR_THEME.emeraldReveal : BLIND_WAR_THEME.violetGlow,
    },
  );

  const footY = py + ph - (isVertical ? 145 : 175);
  drawTextWithShadow(
    ctx,
    'PAWNS ARE YOUR EYES ON THE BOARD',
    px + pw / 2,
    footY,
    {
      font: `700 ${isVertical ? 24 : 25}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.textLight,
      maxWidth: pw - 72,
    },
  );
  drawTextWithShadow(
    ctx,
    'The enemy piece stays revealed as long as your Pawn remains adjacent.',
    px + pw / 2,
    footY + 46,
    {
      font: `500 ${isVertical ? 20 : 21}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.textSoft,
      maxWidth: pw - 72,
    },
  );
}

function renderCardsAndEliteChapter(
  ctx: RenderContext2D,
  layout: LayoutZones,
  localFrame: number,
  durationFrames: number,
  timeSec: number,
): void {
  const { width, height, boardRect, panelRect, isVertical } = layout;
  const ch = STORYBOARD_CHAPTERS[3]!;

  drawSplitDualityBackground(ctx, width, height, 0.2, timeSec, 0.65);
  drawChapterHeader(ctx, layout, ch.label, ch.headline, ch.caption, progress(localFrame, 0, 22));

  // Beat A (0..0.52): Power Card flip + swap on board + cooldown ring
  // Beat B (0.48..1.0): Royal-Only Elite shield + King/Queen capture vs Pawn blocked
  const swapT = easeInOutQuart(progress(localFrame, 28, 40));
  const flipT = easeOutCubic(progress(localFrame, 8, 28));
  const cooldownSweep = 1 - progress(localFrame, 34, 70) * 0.45;
  const eliteFocusT = easeOutCubic(progress(localFrame, durationFrames * 0.48, 24));
  const blockT = progress(localFrame, durationFrames * 0.56, 36);
  const royalCaptureT = progress(localFrame, durationFrames * 0.72, 42);

  // Board highlights
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

  // Power card swap arc between (2,6) and (6,6)
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

  // Light King at (4,5) & Light Pawn at (3,4)
  const kingPos = boardSquareCenter(boardRect, 4, 5);
  drawChessPiece(ctx, kingPos.cx, kingPos.cy, kingPos.cellSize, 'king', 'light', { timeSec });

  const pawnPos = boardSquareCenter(boardRect, 3, 4);
  drawChessPiece(ctx, pawnPos.cx, pawnPos.cy, pawnPos.cellSize, 'pawn', 'light', { timeSec });

  // Enemy pieces + Royal-Only Elite at (4, 3)
  const darkKing = boardSquareCenter(boardRect, 4, 0);
  drawChessPiece(ctx, darkKing.cx, darkKing.cy, darkKing.cellSize, 'king', 'dark', { timeSec });

  const elitePos = boardSquareCenter(boardRect, 4, 3);
  drawChessPiece(ctx, elitePos.cx, elitePos.cy, elitePos.cellSize, 'elite', 'dark', {
    royalShield: true,
    glowColor: BLIND_WAR_THEME.royalGold,
    scale: 1 + 0.08 * eliteFocusT,
    timeSec,
  });

  // Pawn attack blocked by Elite Royal Barrier
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

    // Crimson X badge
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

  // King / Queen Royal Capture Allowed arc
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

  // Tactical Panel: Power Card (left/top) + Royal Elite Rule (right/bottom)
  drawTacticalPanelFrame(ctx, panelRect, BLIND_WAR_THEME.royalGold, 1);

  const px = panelRect.x;
  const py = panelRect.y;
  const pw = panelRect.w;
  const ph = panelRect.h;

  // Divide panel into 2 clean columns (both 16:9 and 9:16 have wide panelRect >= 880px!)
  const leftCenterX = px + pw * 0.27;
  const rightCenterX = px + pw * 0.72;
  const cardCy = py + ph * 0.48;

  drawTextWithShadow(ctx, '1. POWER CARDS', leftCenterX, py + 44, {
    font: `700 18px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.cyanRune,
  });

  drawPowerCard(ctx, {
    cx: leftCenterX,
    cy: cardCy,
    width: isVertical ? 260 : 250,
    height: isVertical ? 340 : 350,
    flipT,
    cooldownProgress: cooldownSweep,
    cooldownTurns: 3,
    title: 'MIRAGE SWAP',
    subtitle: 'Swap 2 allies & reverse',
  });

  drawTextWithShadow(ctx, 'Powered by cooldown timers', leftCenterX, py + ph - 44, {
    font: `600 17px ${FONT_SANS}`,
    color: BLIND_WAR_THEME.textSoft,
    maxWidth: pw * 0.44,
  });

  // Vertical divider inside panel
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.51, py + 40);
  ctx.lineTo(px + pw * 0.51, py + ph - 40);
  ctx.stroke();
  ctx.restore();

  // Right side: Royal-Only Elite Rule Box
  drawTextWithShadow(ctx, '2. ROYAL-ONLY ELITE', rightCenterX, py + 44, {
    font: `700 18px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.royalGold,
  });

  drawChessPiece(ctx, rightCenterX, py + ph * 0.28, 128, 'elite', 'dark', {
    royalShield: true,
    glowColor: BLIND_WAR_THEME.royalGold,
    timeSec,
  });

  drawTextWithShadow(ctx, 'ROYAL BARRIER', rightCenterX, py + ph * 0.47, {
    font: `700 22px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.royalGold,
  });

  // Allowed vs Blocked rows
  const allowY = py + ph * 0.62;
  traceRoundedRect(ctx, rightCenterX - 170, allowY - 34, 340, 68, 14);
  ctx.fillStyle = 'rgba(52, 211, 153, 0.14)';
  ctx.fill();
  ctx.strokeStyle = BLIND_WAR_THEME.emeraldReveal;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawChessPiece(ctx, rightCenterX - 122, allowY, 44, 'king', 'light', { timeSec });
  drawChessPiece(ctx, rightCenterX - 72, allowY, 44, 'queen', 'light', { timeSec });
  drawTextWithShadow(ctx, '✓  KING OR QUEEN ONLY', rightCenterX + 44, allowY + 1, {
    font: `700 15px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.emeraldReveal,
    maxWidth: 195,
  });

  const denyY = py + ph * 0.79;
  traceRoundedRect(ctx, rightCenterX - 170, denyY - 30, 340, 60, 14);
  ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
  ctx.fill();
  ctx.strokeStyle = BLIND_WAR_THEME.royalCrimson;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  drawTextWithShadow(ctx, '✕  ALL OTHER UNITS BLOCKED', rightCenterX, denyY + 1, {
    font: `700 15px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.royalCrimson,
    maxWidth: 310,
  });
}

function renderRecapChapter(
  ctx: RenderContext2D,
  layout: LayoutZones,
  localFrame: number,
  timeSec: number,
): void {
  const { width, height, isVertical } = layout;
  const ch = STORYBOARD_CHAPTERS[4]!;
  const splitRatio = lerp(0.2, 0.5, easeInOutQuart(progress(localFrame, 0, 35)));

  drawSplitDualityBackground(ctx, width, height, splitRatio, timeSec, 0.95);

  // Emblem on top/left
  const emblemT = easeOutBack(progress(localFrame, 4, 28));
  const emblemX = isVertical ? width / 2 : width * 0.28;
  const emblemY = isVertical ? height * 0.21 : height * 0.44;
  drawWingedMasqueradeEmblem(
    ctx,
    emblemX,
    emblemY,
    (isVertical ? 1.05 : 1.25) * Math.max(0.01, emblemT),
    0.08,
    timeSec,
  );

  // Title plaque below/right of emblem
  const textX = isVertical ? width / 2 : width * 0.67;
  const topY = isVertical ? height * 0.37 : 155;
  const hdrPlaqueW = isVertical ? 840 : 760;
  const hdrPlaqueH = 104;

  traceRoundedRect(ctx, textX - hdrPlaqueW / 2, topY - 62, hdrPlaqueW, hdrPlaqueH, 20);
  ctx.fillStyle = 'rgba(10, 8, 22, 0.84)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 160, 57, 0.45)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  drawTextWithShadow(ctx, 'MHLGAMES PRESENTS', textX, topY - 36, {
    font: `700 16px ${FONT_MONO}`,
    color: BLIND_WAR_THEME.goldBright,
  });
  drawTextWithShadow(ctx, ch.headline, textX, topY + 10, {
    font: `700 ${isVertical ? 52 : 50}px ${FONT_DISPLAY}`,
    color: BLIND_WAR_THEME.textLight,
    shadowColor: 'rgba(124, 58, 237, 0.8)',
    shadowBlur: 20,
    maxWidth: hdrPlaqueW - 48,
  });

  const badges = [
    { title: '9×9 TACTICAL GRID', sub: 'Expanded arena with classic chess roots', color: BLIND_WAR_THEME.goldBright },
    { title: 'HIDDEN IDENTITIES', sub: 'Opponents disguised as masked Pawns', color: BLIND_WAR_THEME.violetGlow },
    { title: 'ADJACENT PAWN REVEAL', sub: 'Move a Pawn adjacent to unmask foes', color: BLIND_WAR_THEME.cyanRune },
    { title: 'POWER CARDS & COOLDOWNS', sub: 'Arcane abilities to turn the tide', color: BLIND_WAR_THEME.magentaAccent },
    { title: 'ROYAL-ONLY ELITE', sub: 'Only King or Queen can eliminate', color: BLIND_WAR_THEME.royalGold },
  ] as const;

  const cardW = isVertical ? 840 : 760;
  const cardH = isVertical ? 96 : 82;
  const gap = isVertical ? 20 : 16;
  const listStartY = topY + (isVertical ? 76 : 74);

  for (let i = 0; i < badges.length; i++) {
    const item = badges[i]!;
    const itemT = easeOutCubic(progress(localFrame, 10 + i * 9, 22));
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

    // Index badge
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(bx + 36, by + cardH / 2, 16, 0, Math.PI * 2);
    ctx.fill();
    drawTextWithShadow(ctx, String(i + 1), bx + 36, by + cardH / 2 + 1, {
      font: `700 15px ${FONT_MONO}`,
      color: '#090714',
    });

    drawTextWithShadow(ctx, item.title, bx + 72, by + cardH * 0.36, {
      font: `700 ${isVertical ? 22 : 20}px ${FONT_MONO}`,
      color: item.color,
      align: 'left',
      maxWidth: cardW - 96,
    });
    drawTextWithShadow(ctx, item.sub, bx + 72, by + cardH * 0.7, {
      font: `500 ${isVertical ? 19 : 18}px ${FONT_SANS}`,
      color: BLIND_WAR_THEME.textSoft,
      align: 'left',
      maxWidth: cardW - 96,
    });
    ctx.restore();
  }

  // Call-to-Play footer banner
  const ctaY = listStartY + badges.length * (cardH + gap) + (isVertical ? 46 : 36);
  const ctaT = easeOutCubic(progress(localFrame, 58, 24));
  ctx.save();
  ctx.globalAlpha = ctaT;
  const ctaW = isVertical ? 760 : 660;
  const ctaH = 62;
  traceRoundedRect(ctx, textX - ctaW / 2, ctaY, ctaW, ctaH, 31);
  const ctaGrad = ctx.createLinearGradient(textX - ctaW / 2, 0, textX + ctaW / 2, 0);
  ctaGrad.addColorStop(0, BLIND_WAR_THEME.goldRich);
  ctaGrad.addColorStop(0.5, BLIND_WAR_THEME.nebulaViolet);
  ctaGrad.addColorStop(1, BLIND_WAR_THEME.cyanRune);
  ctx.fillStyle = ctaGrad;
  ctx.fill();
  drawTextWithShadow(ctx, 'PLAY BLIND WAR  ·  OUTSMART THE MASK', textX, ctaY + ctaH / 2 + 1, {
    font: `700 ${isVertical ? 22 : 20}px ${FONT_MONO}`,
    color: '#FFFFFF',
    maxWidth: ctaW - 40,
  });
  ctx.restore();
}

/**
 * Pure deterministic frame renderer for BLIND WAR How-to-Play explainer video.
 * Supports 16:9 (1920x1080) and 9:16 (1080x1920) cleanly.
 */
export function renderFrame(
  ctx: RenderContext2D,
  frameIndex: number,
  totalFrames: number,
  aspectRatio: AspectMode,
): void {
  const layout = computeLayout(aspectRatio);
  const clampedTotal = Math.max(1, totalFrames);
  const clampedFrame = clamp(frameIndex, 0, clampedTotal - 1e-6);
  const normalizedFrame = (clampedFrame / clampedTotal) * 720;

  const active = getChapterAtFrame(normalizedFrame);
  const timeSec = normalizedFrame / VIDEO_FPS;

  ctx.save();
  ctx.clearRect(0, 0, layout.width, layout.height);

  switch (active.chapter.id) {
    case 'hook':
      renderHookChapter(ctx, layout, active.localFrame, active.chapter.durationFrames, timeSec);
      break;
    case 'board-fog':
      renderBoardAndFogChapter(
        ctx,
        layout,
        active.localFrame,
        active.chapter.durationFrames,
        timeSec,
      );
      break;
    case 'pawn-scout':
      renderPawnScoutChapter(
        ctx,
        layout,
        active.localFrame,
        active.chapter.durationFrames,
        timeSec,
      );
      break;
    case 'cards-elite':
      renderCardsAndEliteChapter(
        ctx,
        layout,
        active.localFrame,
        active.chapter.durationFrames,
        timeSec,
      );
      break;
    case 'recap':
      renderRecapChapter(ctx, layout, active.localFrame, timeSec);
      break;
  }

  // Bottom deterministic chapter progress HUD
  drawChapterProgressBar(
    ctx,
    layout.width,
    layout.height,
    STORYBOARD_CHAPTERS,
    normalizedFrame,
    720,
    layout.isVertical,
  );

  ctx.restore();
}
