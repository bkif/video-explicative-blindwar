export type AspectMode = '16:9' | '9:16';

export interface CanvasGradientLike {
  addColorStop(offset: number, color: string): void;
}

export interface CanvasTextMetricsLike {
  readonly width: number;
}

/**
 * Minimal structural 2D canvas context interface shared between browser
 * HTML5 CanvasRenderingContext2D and Node @napi-rs/canvas SKRSContext2D.
 */
export interface RenderContext2D {
  fillStyle: string | CanvasGradientLike;
  strokeStyle: string | CanvasGradientLike;
  lineWidth: number;
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'bevel' | 'round' | 'miter';
  globalAlpha: number;
  font: string;
  textAlign: 'left' | 'right' | 'center' | 'start' | 'end';
  textBaseline: 'top' | 'hanging' | 'middle' | 'alphabetic' | 'ideographic' | 'bottom';
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect?(x: number, y: number, w: number, h: number, radii?: number | number[]): void;
  clip(): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): CanvasTextMetricsLike;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradientLike;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): CanvasGradientLike;
  setLineDash(segments: number[]): void;
}

export const BLIND_WAR_THEME = {
  // Light / BLIND Side (Celestial Marble & Gold)
  marbleBase: '#F7F2E6',
  marbleWarm: '#EAE0CC',
  marbleShadow: '#D5C7AE',
  marbleVein: 'rgba(184, 144, 68, 0.22)',
  goldBright: '#F8D878',
  goldRich: '#D4A039',
  goldDeep: '#8B621B',
  lightRay: 'rgba(255, 226, 142, 0.22)',
  inkDark: '#191428',

  // Dark / WAR Side (Cosmic Obsidian & Violet/Cyan Nebula)
  obsidian: '#080612',
  obsidianMid: '#120D24',
  obsidianPanel: 'rgba(17, 13, 34, 0.86)',
  nebulaViolet: '#7C3AED',
  violetGlow: '#A855F7',
  cyanRune: '#22D3EE',
  magentaAccent: '#EC4899',
  starWhite: '#F8FAFC',

  // Gameplay Accents
  royalGold: '#FBBF24',
  royalCrimson: '#F43F5E',
  emeraldReveal: '#34D399',
  slateMuted: '#94A3B8',
  textLight: '#F8FAFC',
  textSoft: '#CBD5E1',
} as const;

export const FONT_DISPLAY = '"Liberation Serif", "DejaVu Serif", Georgia, serif';
export const FONT_SANS = '"Liberation Sans", "DejaVu Sans", system-ui, sans-serif';
export const FONT_MONO = '"Liberation Mono", "DejaVu Sans Mono", monospace';

export function getDimensions(aspectRatio: AspectMode): { width: number; height: number } {
  return aspectRatio === '16:9'
    ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1920 };
}

export function traceRoundedRect(
  ctx: RenderContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

interface StarSpec {
  xFrac: number;
  yFrac: number;
  size: number;
  phase: number;
  cyan: boolean;
}

const COSMIC_STARS: readonly StarSpec[] = Array.from({ length: 48 }, (_, i) => {
  // Deterministic LCG-like distribution
  const s1 = ((i * 73 + 19) % 97) / 97;
  const s2 = ((i * 41 + 53) % 89) / 89;
  const s3 = ((i * 29 + 11) % 31) / 31;
  return {
    xFrac: s1,
    yFrac: s2,
    size: 1.2 + s3 * 2.6,
    phase: i * 0.7,
    cyan: i % 4 === 0,
  };
});

/**
 * Draws the signature BLIND WAR split-duality backdrop:
 * Left = Celestial White Marble + Gold Clockwork Filigree + Light Rays
 * Right = Cosmic Obsidian + Electric Violet/Cyan Nebula + Constellations & Runes
 */
export function drawSplitDualityBackground(
  ctx: RenderContext2D,
  width: number,
  height: number,
  splitRatio: number,
  timeSec: number,
  lightIntensity = 1,
): void {
  const splitX = width * Math.max(0, Math.min(1, splitRatio));

  // Base dark cosmic void across whole canvas
  const darkGrad = ctx.createLinearGradient(0, 0, width, height);
  darkGrad.addColorStop(0, '#070511');
  darkGrad.addColorStop(0.55, BLIND_WAR_THEME.obsidianMid);
  darkGrad.addColorStop(1, '#1A0F35');
  ctx.fillStyle = darkGrad;
  ctx.fillRect(0, 0, width, height);

  // Nebula glow clouds on dark side
  ctx.save();
  const neb1 = ctx.createRadialGradient(
    width * 0.78,
    height * 0.34,
    20,
    width * 0.78,
    height * 0.34,
    Math.max(width, height) * 0.45,
  );
  neb1.addColorStop(0, 'rgba(124, 58, 237, 0.34)');
  neb1.addColorStop(0.5, 'rgba(34, 211, 238, 0.10)');
  neb1.addColorStop(1, 'rgba(8, 6, 18, 0)');
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, width, height);

  const neb2 = ctx.createRadialGradient(
    width * 0.62,
    height * 0.78,
    10,
    width * 0.62,
    height * 0.78,
    Math.max(width, height) * 0.38,
  );
  neb2.addColorStop(0, 'rgba(236, 72, 153, 0.16)');
  neb2.addColorStop(0.6, 'rgba(109, 40, 217, 0.12)');
  neb2.addColorStop(1, 'rgba(8, 6, 18, 0)');
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, width, height);

  // Stars & constellation lines
  for (let i = 0; i < COSMIC_STARS.length; i++) {
    const star = COSMIC_STARS[i];
    if (!star) continue;
    const sx = star.xFrac * width;
    const sy = star.yFrac * height;
    const twinkle = 0.45 + 0.55 * Math.sin(timeSec * 2.2 + star.phase);
    ctx.fillStyle = star.cyan
      ? `rgba(34, 211, 238, ${0.4 + twinkle * 0.55})`
      : `rgba(248, 250, 252, ${0.3 + twinkle * 0.6})`;
    ctx.beginPath();
    ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
    ctx.fill();

    if (i > 0 && i % 5 === 0) {
      const prev = COSMIC_STARS[i - 1];
      if (prev) {
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(prev.xFrac * width, prev.yFrac * height);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
    }
  }

  // Faint arcane astrolabe circle on cosmic side
  const astroCx = width * 0.82;
  const astroCy = height * 0.52;
  const astroR = Math.min(width, height) * 0.28;
  ctx.save();
  ctx.translate(astroCx, astroCy);
  ctx.rotate(timeSec * 0.08);
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, astroR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([8, 12]);
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.22)';
  ctx.beginPath();
  ctx.arc(0, 0, astroR * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  ctx.restore();

  // Left Light / Marble side clipped cleanly along a subtle diagonal slash
  if (splitX > 2 && lightIntensity > 0.01) {
    const slashOffset = Math.min(width, height) * 0.055;
    ctx.save();
    ctx.globalAlpha = lightIntensity;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(splitX + slashOffset, 0);
    ctx.lineTo(splitX - slashOffset, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.clip();

    const marbleGrad = ctx.createLinearGradient(0, 0, splitX + slashOffset, height);
    marbleGrad.addColorStop(0, BLIND_WAR_THEME.marbleBase);
    marbleGrad.addColorStop(0.65, BLIND_WAR_THEME.marbleWarm);
    marbleGrad.addColorStop(1, BLIND_WAR_THEME.marbleShadow);
    ctx.fillStyle = marbleGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle marble veins
    ctx.strokeStyle = BLIND_WAR_THEME.marbleVein;
    ctx.lineWidth = 2;
    for (let v = 0; v < 5; v++) {
      const yStart = height * (0.12 + v * 0.19);
      ctx.beginPath();
      ctx.moveTo(-20, yStart);
      ctx.bezierCurveTo(
        splitX * 0.35,
        yStart - 45 + v * 14,
        splitX * 0.7,
        yStart + 55 - v * 12,
        splitX + 80,
        yStart - 20,
      );
      ctx.stroke();
    }

    // Classical clockwork / temple halo rings
    const haloCx = splitX * 0.38;
    const haloCy = height * 0.45;
    const haloR = Math.min(width, height) * 0.32;
    ctx.save();
    ctx.translate(haloCx, haloCy);
    ctx.rotate(-timeSec * 0.06);
    ctx.strokeStyle = 'rgba(212, 160, 57, 0.26)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, haloR * 0.84, 0, Math.PI * 2);
    ctx.stroke();
    for (let tick = 0; tick < 12; tick++) {
      const a = (tick * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * haloR * 0.84, Math.sin(a) * haloR * 0.84);
      ctx.lineTo(Math.cos(a) * haloR, Math.sin(a) * haloR);
      ctx.stroke();
    }
    ctx.restore();

    // Radiant golden rays
    for (let r = 0; r < 4; r++) {
      const rayGrad = ctx.createLinearGradient(0, 0, splitX * 1.1, height * 0.9);
      rayGrad.addColorStop(0, BLIND_WAR_THEME.lightRay);
      rayGrad.addColorStop(1, 'rgba(255, 226, 142, 0)');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      const baseX = width * (0.05 + r * 0.09);
      ctx.moveTo(baseX, 0);
      ctx.lineTo(baseX + 110, 0);
      ctx.lineTo(baseX - 140, height);
      ctx.lineTo(baseX - 240, height);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // Seam filigree glow line
    ctx.save();
    ctx.globalAlpha = lightIntensity;
    const seamGrad = ctx.createLinearGradient(0, 0, 0, height);
    seamGrad.addColorStop(0, BLIND_WAR_THEME.goldBright);
    seamGrad.addColorStop(0.5, BLIND_WAR_THEME.violetGlow);
    seamGrad.addColorStop(1, BLIND_WAR_THEME.cyanRune);
    ctx.strokeStyle = seamGrad;
    ctx.lineWidth = 4;
    ctx.shadowColor = BLIND_WAR_THEME.goldBright;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(splitX + slashOffset, 0);
    ctx.lineTo(splitX - slashOffset, height);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Draws the central BLIND WAR emblem:
 * Crowned chess silhouette wearing a split winged masquerade mask
 * (Left: ivory/gold filigree, Right: obsidian/violet/cyan runes).
 */
export function drawWingedMasqueradeEmblem(
  ctx: RenderContext2D,
  cx: number,
  cy: number,
  scale: number,
  maskReveal = 0,
  timeSec = 0,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const pulse = 1 + 0.03 * Math.sin(timeSec * 3);

  // Outer aura ring
  const aura = ctx.createRadialGradient(0, 0, 20, 0, 0, 175 * pulse);
  aura.addColorStop(0, 'rgba(248, 216, 120, 0.25)');
  aura.addColorStop(0.55, 'rgba(168, 85, 247, 0.22)');
  aura.addColorStop(1, 'rgba(8, 6, 18, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, 175 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Chess pedestal & robe body (split left/right)
  ctx.save();
  // Left body (Gold & Ivory)
  ctx.fillStyle = BLIND_WAR_THEME.marbleBase;
  ctx.strokeStyle = BLIND_WAR_THEME.goldRich;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(-34, -18);
  ctx.quadraticCurveTo(-48, 42, -62, 86);
  ctx.lineTo(0, 86);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right body (Obsidian & Violet)
  ctx.fillStyle = '#15102B';
  ctx.strokeStyle = BLIND_WAR_THEME.cyanRune;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(34, -18);
  ctx.quadraticCurveTo(48, 42, 62, 86);
  ctx.lineTo(0, 86);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Pedestal base
  traceRoundedRect(ctx, -74, 86, 148, 20, 8);
  const baseGrad = ctx.createLinearGradient(-74, 0, 74, 0);
  baseGrad.addColorStop(0, BLIND_WAR_THEME.goldRich);
  baseGrad.addColorStop(0.5, '#FDE68A');
  baseGrad.addColorStop(1, BLIND_WAR_THEME.nebulaViolet);
  ctx.fillStyle = baseGrad;
  ctx.fill();
  ctx.restore();

  // Crowned head behind mask
  ctx.save();
  ctx.fillStyle = '#241B42';
  ctx.beginPath();
  ctx.arc(0, -34, 34, 0, Math.PI * 2);
  ctx.fill();

  // Royal 3-spired crown
  const crownGrad = ctx.createLinearGradient(-44, -95, 44, -55);
  crownGrad.addColorStop(0, BLIND_WAR_THEME.goldBright);
  crownGrad.addColorStop(0.5, BLIND_WAR_THEME.goldRich);
  crownGrad.addColorStop(1, BLIND_WAR_THEME.violetGlow);
  ctx.fillStyle = crownGrad;
  ctx.strokeStyle = '#FEF3C7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-36, -60);
  ctx.lineTo(-44, -96);
  ctx.lineTo(-18, -76);
  ctx.lineTo(0, -108);
  ctx.lineTo(18, -76);
  ctx.lineTo(44, -96);
  ctx.lineTo(36, -60);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Crown center gem
  ctx.fillStyle = BLIND_WAR_THEME.cyanRune;
  ctx.beginPath();
  ctx.arc(0, -76, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Winged Masquerade Mask (parts slightly when maskReveal > 0)
  const splitGap = maskReveal * 18;
  const wingSpread = 1 + maskReveal * 0.08;

  // Left Wing + Mask Half (Ivory & Gold Filigree)
  ctx.save();
  ctx.translate(-splitGap, -maskReveal * 8);
  ctx.scale(wingSpread, 1);

  for (let f = 0; f < 3; f++) {
    ctx.fillStyle = f === 0 ? BLIND_WAR_THEME.goldBright : BLIND_WAR_THEME.marbleBase;
    ctx.strokeStyle = BLIND_WAR_THEME.goldDeep;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-42, -32 - f * 6);
    ctx.quadraticCurveTo(-105 - f * 12, -88 - f * 14, -142 + f * 14, -64 - f * 16);
    ctx.quadraticCurveTo(-92, -32 - f * 8, -44, -22 - f * 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = BLIND_WAR_THEME.marbleBase;
  ctx.strokeStyle = BLIND_WAR_THEME.goldRich;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.quadraticCurveTo(-28, -58, -48, -38);
  ctx.quadraticCurveTo(-46, -12, -18, -6);
  ctx.lineTo(0, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Left glowing gold eye slit
  ctx.fillStyle = BLIND_WAR_THEME.royalGold;
  ctx.shadowColor = BLIND_WAR_THEME.goldBright;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.ellipse(-22, -34, 11, 5, -0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right Wing + Mask Half (Obsidian, Violet & Cyan Runes)
  ctx.save();
  ctx.translate(splitGap, -maskReveal * 8);
  ctx.scale(wingSpread, 1);

  for (let f = 0; f < 3; f++) {
    ctx.fillStyle = f === 0 ? BLIND_WAR_THEME.nebulaViolet : '#15102B';
    ctx.strokeStyle = BLIND_WAR_THEME.cyanRune;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(42, -32 - f * 6);
    ctx.quadraticCurveTo(105 + f * 12, -88 - f * 14, 142 - f * 14, -64 - f * 16);
    ctx.quadraticCurveTo(92, -32 - f * 8, 44, -22 - f * 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = '#120D24';
  ctx.strokeStyle = BLIND_WAR_THEME.violetGlow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.quadraticCurveTo(28, -58, 48, -38);
  ctx.quadraticCurveTo(46, -12, 18, -6);
  ctx.lineTo(0, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right glowing cyan eye slit
  ctx.fillStyle = BLIND_WAR_THEME.cyanRune;
  ctx.shadowColor = BLIND_WAR_THEME.cyanRune;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.ellipse(22, -34, 11, 5, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

export interface TextDrawOptions {
  font: string;
  color: string;
  align?: 'left' | 'center' | 'right';
  baseline?: 'top' | 'middle' | 'alphabetic';
  shadowColor?: string;
  shadowBlur?: number;
  maxWidth?: number;
}

export function drawTextWithShadow(
  ctx: RenderContext2D,
  text: string,
  x: number,
  y: number,
  options: TextDrawOptions,
): void {
  ctx.save();
  ctx.font = options.font;
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = options.baseline ?? 'middle';
  ctx.fillStyle = options.color;
  if (options.shadowColor) {
    ctx.shadowColor = options.shadowColor;
    ctx.shadowBlur = options.shadowBlur ?? 12;
  }
  if (options.maxWidth !== undefined) {
    ctx.fillText(text, x, y, options.maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}
