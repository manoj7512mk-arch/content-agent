/**
 * gemini.js
 *
 * Tiny shared helper for calling the Gemini API from any agent script.
 * Uses Node's built-in fetch (Node 18+, GitHub Actions runners have this).
 *
 * Model: gemini-3.5-flash-lite — chosen for free-tier friendliness (highest
 * daily request quota of the free-tier models as of Aug 2026). If Google
 * deprecates this model later, check https://ai.google.dev/gemini-api/docs/models
 * for the current stable Flash-Lite model ID and update MODEL below.
 */

const MODEL = 'gemini-3.5-flash-lite';

async function callGemini({ apiKey, prompt, retries = 3 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
      if (!text) {
        throw new Error(`Gemini returned no text. Full response: ${JSON.stringify(data)}`);
      }
      return text;
    }

    // Retry on transient errors: 503 (overloaded), 429 (rate limited)
    const isTransient = res.status === 503 || res.status === 429;
    const errText = await res.text();

    if (isTransient && attempt < retries) {
      const waitMs = attempt * 5000; // 5s, then 10s
      console.log(`Gemini API returned ${res.status} (attempt ${attempt}/${retries}), retrying in ${waitMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }

    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }
}

/**
 * Gemini sometimes wraps JSON responses in markdown code fences even when
 * asked not to. This strips those before parsing.
 */
function parseJsonResponse(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(cleaned);
}

module.exports = { callGemini, parseJsonResponse, MODEL };
