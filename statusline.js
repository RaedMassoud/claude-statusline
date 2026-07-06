#!/usr/bin/env node
'use strict';

// Claude Code statusline. Reads the session JSON on stdin and prints a
// compact, color-coded status. Pure Node built-ins, no dependencies, so it
// runs the same on Windows, macOS, and Linux.

const { execSync } = require('node:child_process');

const useColor = !process.env.NO_COLOR;
const ESC = '\x1b[';
const CODES = {
  reset: '0m',
  cyan: '36m',
  green: '32m',
  amber: '33m',
  red: '31m',
  purple: '35m',
  dim: '90m',
};

function paint(code, text) {
  if (!useColor || text === '') return text;
  return ESC + CODES[code] + text + ESC + CODES.reset;
}

const BAR_WIDTH = 10;

function barColor(pct) {
  if (pct >= 90) return 'red';
  if (pct >= 70) return 'amber';
  return 'green';
}

// A thin rule: heavy line for the filled portion, light line for the rest.
function thinBar(pct) {
  const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return paint(barColor(clamped), '━'.repeat(filled)) + paint('dim', '─'.repeat(empty));
}

// Compact "time remaining" from a Unix epoch (seconds). long adds a day unit.
function timeUntil(epochSeconds, now, long) {
  if (!epochSeconds) return '';
  const diff = epochSeconds - Math.floor(now / 1000);
  if (diff <= 0) return 'now';
  const totalH = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (long && totalH >= 24) {
    return `${Math.floor(totalH / 24)}d${totalH % 24}h`;
  }
  if (totalH > 0) return `${totalH}h${m}m`;
  return `${m}m`;
}

function basename(p) {
  if (!p) return '';
  const trimmed = String(p).replace(/[\\/]+$/, '');
  return trimmed.split(/[\\/]/).pop() || trimmed;
}

function rateSegment(label, data, now, long) {
  let out = paint('dim', label) + ' ' + thinBar(data.used_percentage) +
    ' ' + paint('dim', `${Math.round(data.used_percentage)}%`);
  const t = timeUntil(data.resets_at, now, long);
  if (t) out += ' ' + paint('dim', '⏳ ' + t);
  return out;
}

// Build the finished status string. Pure: no IO, so it is unit-testable.
// input  parsed statusline JSON payload
// git    { branch: string|null, dirty: boolean }
function render(input, git, now = Date.now()) {
  input = input || {};
  git = git || {};
  const lines = [];

  const model = (input.model && input.model.display_name) || 'Claude';
  let l1 = paint('cyan', model);
  if (input.effort && input.effort.level) {
    l1 += ' ' + paint('dim', '·') + ' ' + paint('purple', input.effort.level);
  }
  const dir = basename((input.workspace && input.workspace.current_dir) || input.cwd);
  if (dir) l1 += '   📁 ' + dir;
  if (git.branch) {
    l1 += '   🌿 ' + paint('green', git.branch) + (git.dirty ? paint('red', '*') : '');
  }
  lines.push(l1);

  const cw = input.context_window || {};
  const ctxPct = typeof cw.used_percentage === 'number' ? cw.used_percentage : 0;
  lines.push(paint('dim', 'ctx') + ' ' + thinBar(ctxPct) + ' ' + paint('dim', `${Math.round(ctxPct)}%`));

  const rl = input.rate_limits;
  if (rl && (rl.five_hour || rl.seven_day)) {
    const parts = [];
    if (rl.five_hour && typeof rl.five_hour.used_percentage === 'number') {
      parts.push(rateSegment('5h', rl.five_hour, now, false));
    }
    if (rl.seven_day && typeof rl.seven_day.used_percentage === 'number') {
      parts.push(rateSegment('7d', rl.seven_day, now, true));
    }
    if (parts.length) lines.push(parts.join('   '));
  }

  return lines.join('\n');
}

// Read branch and dirty state in a single git call, scoped to the session dir.
function detectGit(cwd) {
  try {
    const out = execSync('git status --porcelain --branch', {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000,
    });
    const rows = out.split('\n');
    let branch = null;
    const m = (rows[0] || '').match(/^## (.+)$/);
    if (m) {
      branch = m[1].split('...')[0].replace(/^No commits yet on /, '').trim();
      if (branch.includes('(no branch)')) branch = null;
    }
    const dirty = rows.slice(1).some((line) => line.trim().length > 0);
    return { branch, dirty };
  } catch (_) {
    return { branch: null, dirty: false };
  }
}

function main() {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => {
    let input = {};
    try {
      input = JSON.parse(data);
    } catch (_) {
      // Leave input empty; render still prints a safe first line.
    }
    const git = detectGit((input.workspace && input.workspace.current_dir) || input.cwd);
    try {
      process.stdout.write(render(input, git) + '\n');
    } catch (_) {
      const model = (input.model && input.model.display_name) || 'Claude';
      process.stdout.write(paint('cyan', model) + '\n');
    }
  });
}

if (require.main === module) main();

module.exports = { render, thinBar, timeUntil, basename, barColor };
