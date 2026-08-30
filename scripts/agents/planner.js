/**
 * planner.js — the Planner agent
 *
 * Reads dashboard/agent-outputs/hookscript.json (the finished, ready-to-post
 * scripts) and lays them out across the next 7 days with suggested posting
 * times. Writes dashboard/agent-outputs/planner.json.
 *
 * Note: suggested times are general best-practice defaults (evening IST
 * hours), not derived from hour-level engagement data — we don't have
 * that data from the scraper. This is flagged in the output.
 *
 * Run: GEMINI_API_KEY=xxx node scripts/agents/planner.js
 */

const fs = require('fs');
const path = require('path');
const { callGemini, parseJsonResponse } = require('../lib/gemini');

const HOOKSCRIPT_PATH = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs', 'hookscript.json');
const OUT_DIR = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs');
const OUT_PATH = path.join(OUT_DIR, 'planner.json');

function nextNDates(n) {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    dates.push({ iso: d.toISOString().slice(0, 10), label });
  }
  return dates;
}

function buildPrompt(hookscript, dates) {
  const lines = [];
  lines.push(
    `You are the Planner agent on a content team for an Instagram creator. ` +
    `The team has already written ${hookscript.scripts.length} ready-to-post scripts. ` +
    `Your job is to schedule them across the next 7 days.`
  );

  lines.push(`\n### Available dates:`);
  for (const d of dates) lines.push(`- ${d.iso} (${d.label})`);

  lines.push(`\n### Ready scripts to schedule:`);
  for (const s of hookscript.scripts) {
    lines.push(`- "${s.ideaTitle}" — hook: "${s.hook.slice(0, 80)}..."`);
  }

  lines.push(`
Assign each script to one of the available dates (don't reuse a date unless there are more scripts than
dates — in that case spread them as evenly as possible, doubling up only the latest dates). Suggest a
posting time for each using general Instagram best practice (evening hours tend to work well for most
audiences) — be upfront this is a general default, not derived from this account's own engagement-by-hour
data, since that data isn't available yet.

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "cadenceNote": "1-2 sentence note on posting frequency/cadence for this schedule",
  "calendar": [
    {
      "date": "YYYY-MM-DD from the available dates list",
      "dayLabel": "e.g. Monday, Sep 1",
      "ideaTitle": "must match one of the script titles exactly",
      "suggestedTime": "e.g. 7:00 PM IST",
      "note": "short reason for this placement, if any (e.g. spacing, variety)"
    }
  ]
}`);

  return lines.join('\n');
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable is not set.');
    process.exit(1);
  }

  if (!fs.existsSync(HOOKSCRIPT_PATH)) {
    console.error(`Hook & Script output not found at ${HOOKSCRIPT_PATH}. Run hookscript.js first.`);
    process.exit(1);
  }

  const hookscript = JSON.parse(fs.readFileSync(HOOKSCRIPT_PATH, 'utf-8'));
  if (!hookscript.scripts || hookscript.scripts.length === 0) {
    console.error('Hook & Script output has no scripts to schedule.');
    process.exit(1);
  }

  const dates = nextNDates(7);
  const prompt = buildPrompt(hookscript, dates);

  console.log(`Calling Gemini to schedule ${hookscript.scripts.length} scripts across ${dates.length} days...`);
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
    agent: 'planner',
    generatedAt: new Date().toISOString(),
    ...parsed,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\nWrote ${OUT_PATH}\n`);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error('Planner agent failed:', err.message);
  process.exit(1);
});
