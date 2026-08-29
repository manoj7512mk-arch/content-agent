# Content Agent Dashboard

## What this project is
A 5-agent content system for an Instagram creator, reporting to Telegram.

Agents:
1. **Ideator** — scouts content ideas from your + competitor data
2. **Hook & Script** — writes hooks/scripts for chosen ideas
3. **Planner** — builds a daily/weekly content calendar
4. **Analyst** — analyses your stats and competitor stats
5. **DM Manager** — handles/triages incoming DMs

## Accounts in scope
- **My handle:** trendstrykarle
- **Competitors:**
  - _esthetic.whispers
  - luxeryclubindia
  - manly.looks
- **Data source:** Apify (instagram-scraper actor)

## LLM provider
Using **Google Gemini API** (free tier — no credit card, ~1,500 req/day on
Flash) for all 5 agents, via GEMINI_API_KEY. Free-tier caveat: Google may use
inputs to improve their models — worth revisiting once the DM Manager agent
is processing real DMs.

## Hosting (phone-only setup)
- **GitHub** — stores the code (this repo, public)
- **GitHub Actions** — runs the pipeline on a schedule, free, no server
- **GitHub Pages** — serves the dashboard as a live webpage
- DM content never gets committed to this public repo — DM Manager reports
  privately to Telegram only.

## Project structure
