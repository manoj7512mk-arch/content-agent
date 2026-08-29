/**
 * analyst.js — the Analyst agent
 *
 * Reads dashboard/data.json (your + competitor Instagram post data),
 * asks Gemini to find patterns and gaps, writes structured insights to
 * dashboard/agent-outputs/analyst.json for the dashboard to display.
 *
 * Run: GEMINI_API_KEY=xxx node scripts/agents/analyst.js
 */

const fs = require('fs');
const path = require('path');
const { callGemini, parseJsonResponse } = require('../lib/gemini');

const DATA_PATH = path.join(__dirname, '..', '..', 'dashboard', 'data.json');
const OUT_DIR = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs');
const OUT_PATH = path.join(OUT_DIR, 'analyst.json');

function buildPrompt(data) {
  const lines = [];
  lines.push(
    `You are the Analyst agent on a content team for an Instagram creator. ` +
    `Analyze the real post data below (the creator's own account + their competitors) ` +
    `and find concrete, specific patterns — not generic advice.`
  );

  for (const acc of Object.values(data.accounts)) {
    lines.push(
      `\n### @${acc.username} (${acc.role === 'own' ? 'THE CREATOR' : 'competitor'}) ` +
      `— ${acc.postCount} posts, avg likes ${acc.avgLikes ?? 'hidden'}, avg comments ${acc.avgComments}`
    );
    for (const p of acc.posts.slice(0, 10)) {
      const caption = (p.caption || '').replace(/\n/g, ' ').slice(0, 140);
      lines.push(`- [${p.type}] likes=${p.likesCount ?? 'hidden'} comments=${p.commentsCount}: "${caption}"`);
    }
  }

  lines.push(`
Respond with ONLY valid JSON, no markdown fences, no extra commentary, matching exactly this shape:
{
  "summary": "2-3 sentence overview of what's happening across these accounts right now",
  "topPerformerInsights": ["specific insight about what's driving competitor engagement", "..."],
  "ownAccountGaps": ["specific gap between the creator's account and competitors", "..."],
  "recommendations": ["specific, actionable recommendation", "..."]
}
Include 3-5 items in each array. Be specific — reference actual post types, caption patterns, or engagement numbers you see above, not generic social media advice.`);

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
  const prompt = buildPrompt(data);

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
    agent: 'analyst',
    generatedAt: new Date().toISOString(),
    ...parsed,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\nWrote ${OUT_PATH}\n`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error('Analyst agent failed:', err.message);
  process.exit(1);
});
