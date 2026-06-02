// Pre-render an emoji glyph WITH its shadows baked into a bitmap, once, and cache
// it. Moving a baked <img> sprite costs nothing per frame, whereas `filter:
// drop-shadow` (or even `text-shadow`) re-runs a blur every time the region
// repaints — which the sweeping timing-bar needle forces on every frame.
//
// `shadows` is an array of { color, blur, dx, dy } painted under the glyph.
// Returns { url, w, h, anchorBottom } where anchorBottom is the gap (px) between
// the bitmap's bottom edge and the glyph's baseline, so callers can keep the
// glyph's "feet" on the same field spot the old emoji element used.

const cache = new Map();

export function emojiSprite(emoji, { size = 32, shadows = [] } = {}) {
  const key = `${emoji}|${size}|${shadows.map((s) => `${s.color}:${s.blur}:${s.dx || 0}:${s.dy || 0}`).join(';')}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // Pad so no shadow clips: sides/top by the largest blur, bottom also covers
  // any downward-offset contact shadow.
  const maxBlur = shadows.reduce((m, s) => Math.max(m, s.blur), 0);
  const padSide = Math.ceil(maxBlur) + 4;
  const padTop = padSide;
  const padBottom = Math.ceil(shadows.reduce((m, s) => Math.max(m, s.blur + (s.dy || 0)), 0)) + 4;

  const w = size + padSide * 2;
  const h = padTop + size + padBottom;
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;

  const gx = w / 2;          // glyph horizontal center
  const gy = padTop + size;  // glyph baseline (bottom)

  // Shadow passes: draw the glyph far off-canvas and use shadowOffsetX to bring
  // ONLY its blurred shadow into view — the standard "shadow without source" trick.
  const OFF = w + 200;
  for (const s of shadows) {
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.blur;
    ctx.shadowOffsetX = OFF + (s.dx || 0);
    ctx.shadowOffsetY = s.dy || 0;
    ctx.fillText(emoji, gx - OFF, gy);
    ctx.restore();
  }
  // Crisp glyph on top, no shadow.
  ctx.fillText(emoji, gx, gy);

  const sprite = { url: canvas.toDataURL(), w, h, anchorBottom: padBottom };
  cache.set(key, sprite);
  return sprite;
}
