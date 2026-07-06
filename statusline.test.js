'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { render, timeUntil, basename, barColor } = require('./statusline.js');

const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const NOW = 1700000000000; // fixed clock so countdowns are deterministic

function base() {
  return {
    model: { display_name: 'Opus' },
    effort: { level: 'xhigh' },
    workspace: { current_dir: '/home/me/claude-statusline' },
    context_window: { used_percentage: 8 },
  };
}

test('line 1 shows model, effort, dir, and dirty branch', () => {
  const l1 = strip(render(base(), { branch: 'main', dirty: true }, NOW)).split('\n')[0];
  assert.match(l1, /Opus/);
  assert.match(l1, /· xhigh/);
  assert.match(l1, /claude-statusline/);
  assert.match(l1, /🌿 main\*/);
});

test('effort is omitted when absent', () => {
  const input = base();
  delete input.effort;
  const l1 = strip(render(input, { branch: 'main', dirty: false }, NOW)).split('\n')[0];
  assert.ok(!l1.includes('xhigh'));
  assert.ok(!l1.includes('·'));
});

test('branch is omitted when not in a repo', () => {
  const l1 = strip(render(base(), { branch: null, dirty: false }, NOW)).split('\n')[0];
  assert.ok(!l1.includes('🌿'));
});

test('clean tree shows no asterisk', () => {
  const l1 = strip(render(base(), { branch: 'main', dirty: false }, NOW)).split('\n')[0];
  assert.ok(l1.includes('main'));
  assert.ok(!l1.includes('main*'));
});

test('context line has percentage but no cost or elapsed time', () => {
  const l2 = strip(render(base(), { branch: null, dirty: false }, NOW)).split('\n')[1];
  assert.match(l2, /ctx/);
  assert.match(l2, /8%/);
  assert.ok(!l2.includes('$'));
  assert.ok(!/\dm\b/.test(l2));
});

test('bar fill is rounded: 8% gives one filled segment', () => {
  const l2 = strip(render(base(), { branch: null, dirty: false }, NOW)).split('\n')[1];
  assert.equal((l2.match(/━/g) || []).length, 1);
});

test('no rate-limit line when rate_limits is absent', () => {
  const out = strip(render(base(), { branch: null, dirty: false }, NOW));
  assert.equal(out.split('\n').length, 2);
  assert.ok(!out.includes('5h'));
});

test('both rate windows render with rounded percent and countdown', () => {
  const input = base();
  input.rate_limits = {
    five_hour: { used_percentage: 23.5, resets_at: NOW / 1000 + 2 * 3600 + 15 * 60 },
    seven_day: { used_percentage: 78, resets_at: NOW / 1000 + 3 * 86400 + 4 * 3600 },
  };
  const l3 = strip(render(input, { branch: null, dirty: false }, NOW)).split('\n')[2];
  assert.match(l3, /5h/);
  assert.match(l3, /24%/);
  assert.match(l3, /⏳ 2h15m/);
  assert.match(l3, /7d/);
  assert.match(l3, /78%/);
  assert.match(l3, /⏳ 3d4h/);
});

test('only five_hour present renders just the 5h window', () => {
  const input = base();
  input.rate_limits = { five_hour: { used_percentage: 40, resets_at: NOW / 1000 + 600 } };
  const l3 = strip(render(input, { branch: null, dirty: false }, NOW)).split('\n')[2];
  assert.match(l3, /5h/);
  assert.ok(!l3.includes('7d'));
});

test('null context_window falls back to 0%', () => {
  const input = base();
  input.context_window = null;
  const l2 = strip(render(input, { branch: null, dirty: false }, NOW)).split('\n')[1];
  assert.match(l2, /0%/);
});

test('bar color follows thresholds', () => {
  assert.equal(barColor(10), 'green');
  assert.equal(barColor(75), 'amber');
  assert.equal(barColor(95), 'red');
});

test('high usage colors the bar red', () => {
  const input = base();
  input.context_window = { used_percentage: 95 };
  const l2 = render(input, { branch: null, dirty: false }, NOW).split('\n')[1];
  assert.ok(l2.includes('\x1b[31m'));
});

test('timeUntil formats short, long, and past values', () => {
  assert.equal(timeUntil(NOW / 1000 + 90 * 60, NOW, false), '1h30m');
  assert.equal(timeUntil(NOW / 1000 + 45 * 60, NOW, false), '45m');
  assert.equal(timeUntil(NOW / 1000 + 3 * 86400 + 4 * 3600, NOW, true), '3d4h');
  assert.equal(timeUntil(NOW / 1000 - 10, NOW, false), 'now');
  assert.equal(timeUntil(undefined, NOW, false), '');
});

test('basename handles Windows and Unix paths', () => {
  assert.equal(basename('C:\\Users\\me\\proj'), 'proj');
  assert.equal(basename('/home/me/proj/'), 'proj');
});
