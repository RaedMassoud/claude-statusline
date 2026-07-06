# Claude Code Statusline

A compact, color-coded statusline for [Claude Code](https://claude.ai/code). It
shows your model and effort level, context-window usage, rate limits, and git
branch, right at the bottom of your session.

Runs on Windows, macOS, and Linux with nothing to install. It is a single
Node.js file, and Node ships with Claude Code, so there is no `jq`, no Homebrew,
and no shell-specific setup.

## What it looks like

```
Opus · xhigh   📁 claude-statusline   🌿 main*
ctx ━───────── 8%
5h ━━──────── 24% ⏳ 2h15m   7d ━━━━━━━━── 78% ⏳ 3d4h
```

(Colors are not visible above. Bars run green below 70%, amber from 70 to 89%,
and red at 90% and over.)

## What it shows

Line 1, session:
- Model name (for example, Opus)
- Effort level (for example, xhigh), shown when the model reports one
- Current directory
- Git branch, with a trailing `*` when the working tree has uncommitted changes

Line 2, context:
- Context-window usage bar
- Used percentage

Line 3, rate limits (shown only when Claude Code provides them, which is on
Pro and Max plans):
- 5-hour bar, percentage, and time until reset
- 7-day bar, percentage, and time until reset

Any segment is skipped when its data is missing, so the line never shows blanks
or `null`.

## Install

### 1. Save the script

Save `statusline.js` into your Claude Code config directory, for example
`~/.claude/statusline.js`.

```bash
curl -o ~/.claude/statusline.js \
  https://raw.githubusercontent.com/AliT-Hammoud/claude-statusline/main/statusline.js
```

Windows PowerShell:

```powershell
curl.exe -o "$env:USERPROFILE\.claude\statusline.js" `
  https://raw.githubusercontent.com/AliT-Hammoud/claude-statusline/main/statusline.js
```

Or clone and copy:

```bash
git clone https://github.com/AliT-Hammoud/claude-statusline.git
cp claude-statusline/statusline.js ~/.claude/statusline.js
```

### 2. Point Claude Code at it

Add a `statusLine` block to `~/.claude/settings.json`. Use an absolute path so
it works no matter which shell runs the command:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /Users/you/.claude/statusline.js",
    "refreshInterval": 10
  }
}
```

On Windows, use forward slashes (Node accepts them, so no backslash escaping):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:/Users/you/.claude/statusline.js",
    "refreshInterval": 10
  }
}
```

`refreshInterval` re-runs the script every N seconds so the reset countdowns
stay current while you are idle. The statusline is otherwise event-driven (it
updates on new messages, `/compact`, and similar), so without it the countdowns
freeze between actions. The minimum is `1`; remove the field to update on events
only.

### 3. Restart Claude Code

The statusline appears at the bottom of your session.

## Requirements

- Claude Code (it brings its own Node.js runtime)
- git, only for the branch segment; it is skipped cleanly when absent

If `node` is not on your PATH (some native installs keep it private), point the
command at a full Node path. Find one with `which node` (macOS and Linux) or
`where node` (Windows), then use it in place of `node` above.

## Customization

Colors and thresholds live near the top of `statusline.js`. For example, to warn
earlier, lower the amber threshold in `barColor()`:

```js
if (pct >= 60) return 'amber';
```

`BAR_WIDTH` sets the bar length. Set `NO_COLOR=1` in your environment to turn
colors off.

## Tests

The behavior is covered by a dependency-free test suite. Run it with:

```bash
node --test
```
