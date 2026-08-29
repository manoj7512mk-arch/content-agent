/**
 * transform-data.js
 *
 * Takes the raw Apify instagram-scraper export (dashboard/data_raw.json)
 * and turns it into a clean, normalized shape the dashboard can consume
 * (dashboard/data.json).
 *
 * Run: node scripts/transform-data.js
 */

const fs = require('fs');
const path = require('path');

const RAW_PATH = path.join(__dirname, '..', 'dashboard', 'data_raw.json');
const OUT_PATH = path.join(__dirname, '..', 'dashboard', 'data.json');

// Your account, for tagging role: 'own' vs 'competitor'
const MY_USERNAME = 'trendstrykarle';

// Handle mapping: some accounts show multiple ownerUsername values in raw
// data (e.g. after a handle change). Map any alias -> canonical handle here.
const USERNAME_ALIASES = {
  'manlylooks.ind': 'manly.looks',
};

function canonicalUsername(raw) {
  return USERNAME_ALIASES[raw] || raw;
}

function normalizePost(post) {
  return {
    shortCode: post.shortCode,
    url: post.url,
    type: post.type,               // Image / Video / Sidecar
    timestamp: post.timestamp,
    caption: post.caption || '',
    hashtags: post.hashtags || [],
    mentions: post.mentions || [],
    likesCount: post.likesCount === -1 ? null : post.likesCount, // -1 = hidden by creator
    commentsCount: post.commentsCount ?? null,
    videoViewCount: post.videoViewCount ?? null,
    productType: post.productType || null,
  };
}

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error(`Raw data not found at ${RAW_PATH}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf-8'));
  const accounts = {};

  for (const post of raw) {
    const username = canonicalUsername(post.ownerUsername);
    if (!accounts[username]) {
      accounts[username] = {
        username,
        role: username === MY_USERNAME ? 'own' : 'competitor',
        posts: [],
      };
    }
    accounts[username].posts.push(normalizePost(post));
  }

  // Sort each account's posts newest first
  for (const acc of Object.values(accounts)) {
    acc.posts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    acc.postCount = acc.posts.length;
    const likeVals = acc.posts.map(p => p.likesCount).filter(v => v !== null);
    const commentVals = acc.posts.map(p => p.commentsCount).filter(v => v !== null);
    acc.avgLikes = likeVals.length ? Math.round(likeVals.reduce((a, b) => a + b, 0) / likeVals.length) : null;
    acc.avgComments = commentVals.length ? Math.round(commentVals.reduce((a, b) => a + b, 0) / commentVals.length) : null;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    myUsername: MY_USERNAME,
    accounts,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUT_PATH}`);
  console.log('Accounts summary:');
  for (const acc of Object.values(accounts)) {
    console.log(`  ${acc.username} (${acc.role}): ${acc.postCount} posts, avg likes ${acc.avgLikes}, avg comments ${acc.avgComments}`);
  }
}

main();
