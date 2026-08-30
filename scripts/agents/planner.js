/**
 * planner.js — the Planner agent
 *
 * Reads dashboard/agent-outputs/hookscript.json (the finished, ready-to-post
 * scripts) and lays them out at 3 fixed posting times per day (morning,
 * afternoon, evening IST) across as many days as needed. Writes
 * dashboard/agent-outputs/planner.json.
 *
 * Slot dates/times are generated in code (not by the AI) so they're always
 * consistent — the AI's job is just matching which idea fits which slot.
 *
 * Note: the 3 time slots are general best-practice defaults, not derived
 * from hour-level engagement data — we don't have that data from the
 * scraper. This is flagged in the output.
 *
 * Run: GEMINI_API_KEY=xxx node scripts/agents/planner.js
 */

const fs = require('fs');
const path = require('path');
const { callGemini, parseJsonResponse } = require('../lib/gemini');

const HOOKSCRIPT_PATH = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs', 'hookscript.json');
const OUT_DIR = path.join(__dirname, '..', '..', 'dashboard', 'agent-outputs');
const OUT_PATH = path.join(OUT_DIR, 'planner.json');

const TIME_SLOTS = ['11:00 AM IST', '4:00 PM IST', '8:00 PM IST'];

function buildSlots(scriptCount) {
  const days = Math.ceil(scriptCount / TIME_SLOTS.length);
  const slots = [];
  const today = new Date();
  for (let d = 1; d <= days; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const iso = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    for (const time of TIME_SLOTS) {
      slots.push({ date: iso, dayLabel: label, suggestedTime: time });
    }
  }
  return slots;
}

function buildPrompt(hookscript, slots) {
  const lines = [];
  lines.push(
    `You are the Planner agent on a content team for an Instagram creator who posts 3x/day. ` +
    `The team has already written ${hookscript.scripts.length} ready-to-post scripts, and there are ` +
    `${slots.length} fixed posting slots (date + time already set). Your only job is matching which ` +
    `script fits which slot best — do not invent new dates or times.`
  );

  lines.push(`\n### Fixed posting slots:`);
  slots.forEach((s, i) => lines.push(`${i + 1}. ${s.date} (${s.dayLabel}) at ${s.suggestedTime}`));

  lines.push(`\n### Ready scripts to place:`);
  for (const s of hookscript.scripts) {
    lines.push(`- "${s.ideaTitle}" — hook: "${s.hook.slice(0, 80)}..."`);
  }

  lines.push(`
Assign each script to exactly one slot, filling slots in order (don't skip slots unless you run out of
scripts). If there are more slots than scripts, leave the extra slots unused. Pick which script suits
morning vs. evening if there's a sensible reason (e.g. lighter/quicker content in the morning, high-intent
buying content in the evening) — otherwise just fill in a sensible order.

Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{
  "cadenceNote": "1-2 sentence note on this 3x/day posting cadence",
  "calendar": [
    {
      "date": "must exactly match one of the fixed slot dates given above",
      "dayLabel": "must exactly match that slot's day label",
      "suggestedTime": "must exactly match that slot's time",
      "ideaTitle": "must match one of the script titles exactly",
      "note": "short reason for this placement"
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

  const slots = buildSlots(hookscript.scripts.length);
  const prompt = buildPrompt(hookscript, slots);

  console.log(`Calling Gemini to place ${hookscript.scripts.length} scripts into ${slots.length} slots (3/day)...`);
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
