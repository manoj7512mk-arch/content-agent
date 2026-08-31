/**
 * imagegen.js — renders ready-to-post carousel slide IMAGES
 *
 * Reads dashboard/agent-outputs/hookscript.json and renders each script into
 * real PNG files: one cover slide (the hook) + one slide per item in the
 * "slides" array. Saved to dashboard/generated-images/<slug>/slide-01.png etc.
 *
 * These are TEXT-based graphic slides (typographic carousel design) — not
 * photos of real products, since we don't have real product photography
 * (no affiliate API access yet). This is an honest, common IG content
 * format on its own.
 *
 * Run: node scripts/agents/imagegen.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, registerFont } = require('canvas');

const HOOKSCRIPT_PATH = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs', 'hookscript.json');
const OUT_ROOT = path.join(__dirname, '..', '..', 'dashboard', 'generated-images');
const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');

const W = 1080;
const H = 1350;

const COLORS = {
  paper: '#FAFAF8',
  ink: '#111214',
  inkSoft: '#53555C',
  line: '#E2E0D6',
  lime: '#D7FF3D',
  tagOrange: '#FF4D1E',
};

function registerFonts() {
  registerFont(path.join(FONTS_DIR, 'Anton-Regular.ttf'), { family: 'Anton' });
  registerFont(path.join(FONTS_DIR, 'JetBrainsMono-Regular.ttf'), { family: 'JetBrains Mono' });
  registerFont(path.join(FONTS_DIR, 'JetBrainsMono-Bold.ttf'), { family: 'JetBrains Mono', weight: 'bold' });
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

/**
 * Strip emoji before rendering into the canvas — our fonts (Anton, JetBrains
 * Mono) have no emoji glyphs, so they'd render as broken/missing-glyph boxes.
 * Captions (posted as real Instagram text) keep their emoji fine; this only
 * affects text baked into the generated images.
 */
function stripEmoji(str) {
  return str
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{2190}-\u{21FF}]/gu, '')
    .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/[\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Safety net: strip a leading "Slide 2:" style prefix if the AI added one
 * anyway, since we already show the slide number visually. */
function stripSlidePrefix(str) {
  return str.replace(/^slide\s*\d+\s*[:.\-–]\s*/i, '');
}

/** Wrap text to fit maxWidth, returns array of lines. */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Find the largest font size (within a range) whose wrapped text fits the box. */
function fitText(ctx, text, { maxWidth, maxHeight, maxSize, minSize, lineHeightRatio, fontFamily }) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    ctx.font = `${size}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth);
    const totalHeight = lines.length * size * lineHeightRatio;
    if (totalHeight <= maxHeight) {
      return { size, lines, lineHeight: size * lineHeightRatio };
    }
  }
  // Fallback: smallest size regardless of overflow
  ctx.font = `${minSize}px ${fontFamily}`;
  const lines = wrapText(ctx, text, maxWidth);
  return { size: minSize, lines, lineHeight: minSize * lineHeightRatio };
}

function drawWatermark(ctx, handle, dark) {
  ctx.font = '20px JetBrains Mono';
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.55)' : COLORS.inkSoft;
  ctx.textAlign = 'right';
  ctx.fillText(`@${handle}`, W - 56, H - 56);
  ctx.textAlign = 'left';
}

function drawIndex(ctx, current, total, dark) {
  ctx.font = '22px JetBrains Mono';
  ctx.fillStyle = dark ? COLORS.lime : COLORS.tagOrange;
  const label = `${String(current).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  ctx.fillText(label, 56, 90);
}

function renderCoverSlide({ hook, index, total, handle }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Ink background — high-contrast cover, distinct from content slides
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, W, H);

  drawIndex(ctx, index, total, true);

  ctx.font = '18px JetBrains Mono';
  ctx.fillStyle = COLORS.lime;
  ctx.fillText('SWIPE →', W - 200, 90);

  // Big headline, vertically centered in the middle band
  const cleanHook = stripEmoji(hook);
  const fit = fitText(ctx, cleanHook.toUpperCase(), {
    maxWidth: W - 112,
    maxHeight: 720,
    maxSize: 96,
    minSize: 44,
    lineHeightRatio: 1.05,
    fontFamily: 'Anton',
  });
  ctx.font = `${fit.size}px Anton`;
  ctx.fillStyle = COLORS.paper;
  const totalTextHeight = fit.lines.length * fit.lineHeight;
  let y = (H - totalTextHeight) / 2 + fit.size * 0.8;
  for (const line of fit.lines) {
    ctx.fillText(line, 56, y);
    y += fit.lineHeight;
  }

  drawWatermark(ctx, handle, true);
  return canvas;
}

function renderContentSlide({ text, index, total, handle }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, W, H);

  drawIndex(ctx, index, total, false);

  // Thin rule under the index
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, 116);
  ctx.lineTo(W - 56, 116);
  ctx.stroke();

  const cleanText = stripSlidePrefix(stripEmoji(text));
  const fit = fitText(ctx, cleanText, {
    maxWidth: W - 112,
    maxHeight: 950,
    maxSize: 56,
    minSize: 30,
    lineHeightRatio: 1.35,
    fontFamily: 'Inter, sans-serif',
  });
  // Canvas on Linux falls back to a default sans if "Inter" isn't registered;
  // that's an acceptable fallback for body copy (Anton/JetBrains Mono are
  // the two fonts doing the brand-identity work).
  ctx.font = `${fit.size}px sans-serif`;
  ctx.fillStyle = COLORS.ink;
  const totalTextHeight = fit.lines.length * fit.lineHeight;
  let y = (H - totalTextHeight) / 2 + fit.size * 0.8;
  for (const line of fit.lines) {
    ctx.fillText(line, 56, y);
    y += fit.lineHeight;
  }

  drawWatermark(ctx, handle, false);
  return canvas;
}

async function main() {
  if (!fs.existsSync(HOOKSCRIPT_PATH)) {
    console.error(`Hook & Script output not found at ${HOOKSCRIPT_PATH}. Run hookscript.js first.`);
    process.exit(1);
  }
  const hookscript = JSON.parse(fs.readFileSync(HOOKSCRIPT_PATH, 'utf-8'));
  if (!hookscript.scripts || hookscript.scripts.length === 0) {
    console.error('No scripts found to render.');
    process.exit(1);
  }

  registerFonts();

  // Try to get the handle from data.json; fall back to a generic label.
  let handle = 'creator';
  const dataPath = path.join(__dirname, '..', '..', 'dashboard', 'data.json');
  if (fs.existsSync(dataPath)) {
    try {
      handle = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).myUsername || handle;
    } catch (e) { /* ignore, use fallback */ }
  }

  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const manifest = [];

  for (const script of hookscript.scripts) {
    const slug = slugify(script.ideaTitle);
    const dir = path.join(OUT_ROOT, slug);
    fs.mkdirSync(dir, { recursive: true });

    const totalSlides = 1 + (script.slides ? script.slides.length : 0);
    const files = [];

    const cover = renderCoverSlide({ hook: script.hook, index: 1, total: totalSlides, handle });
    const coverPath = path.join(dir, 'slide-01.png');
    fs.writeFileSync(coverPath, cover.toBuffer('image/png'));
    files.push('slide-01.png');

    (script.slides || []).forEach((text, i) => {
      const canvas = renderContentSlide({ text, index: i + 2, total: totalSlides, handle });
      const fname = `slide-${String(i + 2).padStart(2, '0')}.png`;
      fs.writeFileSync(path.join(dir, fname), canvas.toBuffer('image/png'));
      files.push(fname);
    });

    manifest.push({ ideaTitle: script.ideaTitle, slug, files });
    console.log(`Rendered ${files.length} slides for "${script.ideaTitle}" -> dashboard/generated-images/${slug}/`);
  }

  fs.writeFileSync(path.join(OUT_ROOT, 'manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    items: manifest,
  }, null, 2));

  console.log(`\nDone. ${manifest.length} posts rendered.`);
}

main().catch(err => {
  console.error('Image generation failed:', err);
  process.exit(1);
});
