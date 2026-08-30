/**
 * ideator.js — the Ideator agent
 *
 * Reads dashboard/data.json plus the Analyst's findings (if available) and
 * generates concrete, ready-to-shoot content ideas tailored to what's
 * actually working in this niche right now — not generic advice.
 *
 * Run: GEMINI_API_KEY=xxx node scripts/agents/ideator.js
 */

const fs = require('fs');
const path = require('path');
const { callGemini, parseJsonResponse } = require('../lib/gemini');

const DATA_PATH = path.join(__dirname, '..', '..', 'dashboard', 'data.json');
const ANALYST_PATH = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs', 'analyst.json');
const OUT_DIR = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs');
const OUT_PATH = path.join(OUT_DIR, 'ideator.json');

function buildPrompt(data, analyst) {
  const lines = [];
  lines.push(
    `You are the Ideator agent on a content team for an Instagram creator (@${data.myUsername}). ` +
    `Generate specific, ready-to-shoot content ideas based on the real data below — not generic advice.`
  );

  if (analyst) {
    lines.push(`\n### Analyst's findings on this niche:`);
    lines.push(`Summary: ${analyst.summary}`);
    if (analyst.topPerformerInsights) lines.push(`What's working for competitors: ${analyst.topPerformerInsights.join(' | ')}`);
    if (analyst.ownAccountGaps) lines.push(`Gaps in the creator's account: ${analyst.ownAccountGaps.join(' | ')}`);
  }

  lines.push(`\n### Recent competitor posts (for reference on format/topics):`);
  for (const acc of Object.values(data.accounts)) {
    if (acc.role !== 'competitor') continue;
    lines.push(`\n@${acc.username}:`);
    for (const p of acc.posts.slice(0, 6)) {
      const caption = (p.caption || '').replace(/\n/g, ' ').slice(0, 100);
      lines.push(`- [${p.type}] likes=${p.likesCount ?? 'hidden'}: "${caption}"`);
    }
  }

  lines.push(`
Generate 6 specific content ideas for @${data.myUsername} to post next. Respond with ONLY valid JSON, no markdown fences, matching exactly:
{
  "ideas": [
    {
      "title": "short punchy working title",
      "format": "carousel | reel | single image",
      "concept": "1-2 sentence description of exactly what this post shows or says",
      "whyItWorks": "why this fits what's working in the niche right now, referencing specific competitor patterns",
      "suggestedCta": "the exact comment-gate or CTA line to use in the caption"
    }
  ]
}
Ideas must be specific to this niche and audience — not generic "post more reels" advice. Vary the formats and angles across the 6 ideas.`);

  return lines.join('\n');
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable is not set.');
    process.exit(1);
  }
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Data file not found at ${DATA_PATH}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

  let analyst = null;
  if (fs.existsSync(ANALYST_PATH)) {
    try {
      analyst = JSON.parse(fs.readFileSync(ANALYST_PATH, 'utf-8'));
    } catch (e) {
      console.warn('Could not parse analyst.json, proceeding without it.');
    }
  }

  const prompt = buildPrompt(data, analyst);

  console.log('Calling Gemini...');
  const raw = await callGemini({ apiKey, prompt });

  let parsed;
  try {
    parsed = parseJsonResponse(raw);
  } catch (e) {
    console.error('Failed to parse Gemini response as JSON.');
    console.error('Raw response was:\n', raw);
    process.exit(1);
  }

  const output = {
    agent: 'ideator',
    generatedAt: new Date().toISOString(),
    ...parsed,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\nWrote ${OUT_PATH}\n`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error('Ideator agent failed:', err.message);
  process.exit(1);
});
