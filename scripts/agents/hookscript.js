/**
 * hookscript.js — the Hook & Script agent
 *
 * Reads dashboard/agent-outputs/ideator.json (the content ideas) and writes
 * the actual scroll-stopping hook, slide-by-slide text, and ready-to-post
 * caption for each idea. This is the "write it for real" step — output is
 * meant to be copy-pasted straight into Instagram.
 *
 * Run: GEMINI_API_KEY=xxx node scripts/agents/hookscript.js
 */

const fs = require('fs');
const path = require('path');
const { callGemini, parseJsonResponse } = require('../lib/gemini');

const IDEATOR_PATH = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs', 'ideator.json');
const OUT_DIR = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs');
const OUT_PATH = path.join(OUT_DIR, 'hookscript.json');

function buildPrompt(ideator) {
  const lines = [];
  lines.push(
    `You are the Hook & Script agent on a content team for an Instagram creator. ` +
    `The Ideator agent has already picked the following content ideas. Your job is to ` +
    `write the ACTUAL text for each one — ready to copy-paste and post, not more suggestions.`
  );

  lines.push(`\n### Ideas to write for:`);
  for (const idea of ideator.ideas || []) {
    lines.push(`\n- Title: ${idea.title}`);
    lines.push(`  Format: ${idea.format}`);
    lines.push(`  Concept: ${idea.concept}`);
    if (idea.suggestedCta) lines.push(`  Suggested CTA: ${idea.suggestedCta}`);
  }

  lines.push(`
For EACH idea above, write:
- hook: the exact text for slide 1 (carousel) or the first 2 seconds of spoken/on-screen text (reel) — must stop the scroll, specific to this content, not a generic phrase
- slides: an array of the exact text for each subsequent slide (carousel) or each beat/moment (reel script) — write the real content, not placeholders like "show product here"
- caption: the full ready-to-post caption including the CTA

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "scripts": [
    {
      "ideaTitle": "must match the idea's title exactly",
      "hook": "exact slide 1 / opening text",
      "slides": ["exact text for slide 2", "exact text for slide 3", "..."],
      "caption": "full ready-to-post caption with CTA"
    }
  ]
}
Write real, specific, finished text — someone should be able to copy this straight into Instagram with zero editing.`);

  return lines.join('\n');
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  if (!fs.existsSync(IDEATOR_PATH)) {
    console.error(`Ideator output not found at ${IDEATOR_PATH}. Run ideator.js first.`);
    process.exit(1);
  }

  const ideator = JSON.parse(fs.readFileSync(IDEATOR_PATH, 'utf-8'));
  if (!ideator.ideas || ideator.ideas.length === 0) {
    console.error('Ideator output has no ideas to write for.');
    process.exit(1);
  }

  const prompt = buildPrompt(ideator);

  console.log(`Calling Gemini to write hooks/scripts for ${ideator.ideas.length} ideas...`);
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
    agent: 'hookscript',
    generatedAt: new Date().toISOString(),
    ...parsed,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\nWrote ${OUT_PATH}\n`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error('Hook & Script agent failed:', err.message);
  process.exit(1);
});
