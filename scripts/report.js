/**
 * report.js — sends the daily content report to Telegram
 *
 * Reads all 4 agent outputs (analyst, ideator, hookscript, planner) and
 * sends a digest to Telegram: the Analyst's headline insight, plus full
 * details for whichever post is next up on the Planner's calendar.
 *
 * Run: TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=xxx node scripts/report.js
 */

const fs = require('fs');
const path = require('path');
const { sendTelegramMessage } = require('./lib/telegram');

const OUT_DIR = path.join(__dirname, '..', 'dashboard', 'agent-outputs');

function loadJsonIfExists(filename) {
  const p = path.join(OUT_DIR, filename);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    console.warn(`Could not parse ${filename}, skipping.`);
    return null;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildMessage({ analyst, hookscript, planner }) {
  const lines = [];
  lines.push('📊 CONTENT AGENT — DAILY REPORT');
  lines.push('');

  if (analyst) {
    lines.push('🔍 Analyst says:');
    lines.push(analyst.summary || '(no summary available)');
    lines.push('');
  }

  if (planner && planner.calendar && planner.calendar.length > 0) {
    const today = todayIso();
    const sorted = [...planner.calendar].sort((a, b) => (a.date > b.date ? 1 : -1));
    const next = sorted.find(c => c.date >= today) || sorted[0];

    lines.push(`📅 Next up: ${next.dayLabel || next.date} at ${next.suggestedTime || 'a good time'}`);
    lines.push(`"${next.ideaTitle}"`);
    if (next.note) lines.push(`Why: ${next.note}`);
    lines.push('');

    if (hookscript && hookscript.scripts) {
      const script = hookscript.scripts.find(s => s.ideaTitle === next.ideaTitle);
      if (script) {
        lines.push('✍️ Hook:');
        lines.push(script.hook);
        lines.push('');
        if (script.slides && script.slides.length > 0) {
          lines.push('📝 Slides:');
          script.slides.forEach((s, i) => lines.push(`${i + 2}. ${s}`));
          lines.push('');
        }
        lines.push('💬 Caption (copy-paste ready):');
        lines.push(script.caption);
      }
    }
  } else {
    lines.push('No scheduled posts found — run the agents to generate a plan.');
  }

  return lines.join('\n');
}

async function main() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be set.');
    process.exit(1);
  }

  const analyst = loadJsonIfExists('analyst.json');
  const hookscript = loadJsonIfExists('hookscript.json');
  const planner = loadJsonIfExists('planner.json');

  if (!analyst && !hookscript && !planner) {
    console.error('No agent outputs found — run the agents before sending a report.');
    process.exit(1);
  }

  const message = buildMessage({ analyst, hookscript, planner });

  console.log('Sending report to Telegram...\n');
  console.log(message);

  await sendTelegramMessage({ botToken, chatId, text: message });
  console.log('\nSent successfully.');
}

main().catch(err => {
  console.error('Telegram report failed:', err.message);
  process.exit(1);
});
