const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(process.cwd(), 'logs', 'ws-diff.log');
const OUT_PATH = path.join(process.cwd(), 'logs', 'ws-diff-transformed.log');
const IMAGE_MAP_PATH = path.join(process.cwd(), 'obs-megabonk-overlay', 'image_map.json');

if (!fs.existsSync(LOG_PATH)) {
  console.error('Log file not found:', LOG_PATH);
  process.exit(1);
}

let imageMap = null;
try {
  imageMap = JSON.parse(fs.readFileSync(IMAGE_MAP_PATH, 'utf8'));
} catch (err) {
  console.warn('image_map.json not found or invalid. Item/Tome/Weapon name resolution will be best-effort.');
  imageMap = {};
}

const normalize = (s) => (String(s || '').trim().toLowerCase());

const buildNameSet = (list) => {
  const set = new Set();
  if (!Array.isArray(list)) return set;
  for (const it of list) {
    if (it?.name) set.add(normalize(it.name));
    if (it?.ingameId) set.add(String(it.ingameId));
  }
  return set;
};

const itemNames = buildNameSet(imageMap.items || []);
const tomeNames = buildNameSet(imageMap.tomes || []);
const weaponNames = buildNameSet(imageMap.weapons || []);

const lines = fs.readFileSync(LOG_PATH, 'utf8').split(/\r?\n/);
const out = [];
let counts = { Item:0, Tome:0, Weapon:0, Stat:0, Interaction:0, Other:0, Unchanged:0 };

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) { out.push(line); continue; }

  // Parse prefix: optional [N(update)] then [timestamp] then optional [Category]
  // e.g. [50(update)] [1/31/2026, 08:34:03] [Stat] AttackSpeed — 0.13 — ...
  const m = line.match(/^(\s*\[\d+\(update\)\]\s*)?\[([^\]]+)\]\s*(?:\[([^\]]+)\]\s*)?(.*)$/);
  if (!m) { out.push(line); counts.Unchanged++; continue; }
  const updatePrefix = m[1] || '';
  const timestamp = m[2];
  const existingCategory = m[3] || null;
  const rest = m[4] || '';

  // If category already present and it's one of desired, leave it
  const desiredCats = new Set(['Stat','Item','Tome','Weapon','Interaction']);
  if (existingCategory && desiredCats.has(existingCategory)) {
    out.push(line);
    counts.Unchanged++;
    continue;
  }

  // Extract label (before first ' — ')
  const parts = rest.split(/\s+—\s+/);
  const label = parts[0] ? parts[0].trim() : rest.trim();
  const restAfter = parts.slice(1).join(' — ');

  // Decide category
  const lnorm = normalize(label);
  let category = 'Other';
  if (itemNames.has(lnorm)) category = 'Item';
  else if (tomeNames.has(lnorm)) category = 'Tome';
  else if (weaponNames.has(lnorm)) category = 'Weapon';
  else if (/\b(chest|shady|shady guy|shady guy|shady|microwave|free chest|corrupt chest|shrine)\b/i.test(label)) category = 'Interaction';
  else if (/^[A-Za-z0-9_]+$/.test(label)) category = 'Stat'; // fallback: single token likely stat
  else category = 'Other';

  // Build new line
  const newLine = `${updatePrefix}[${timestamp}] [${category}] ${label} — ${restAfter}`;
  out.push(newLine);
  if (counts[category] != null) counts[category]++; else counts.Other++;
}

fs.writeFileSync(OUT_PATH, out.join('\n'), 'utf8');
console.log('Transformed log written to', OUT_PATH);
console.log('Counts:', counts);
