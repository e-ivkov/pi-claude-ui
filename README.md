# pi-claude-ui

Claude Code–style UI for the [pi coding agent](https://github.com/earendil-works/pi):
flat transcript, status-bullet tool indicators, prompt markers, and expandable
call inspection.

Replaces pi's boxed tool-execution panels with compact one-line entries whose
status lives in a colored bullet, exactly like Claude Code's `⏺` markers.
Works with any pi theme — colors come from your theme's roles
(`success`, `error`, `accent`, `dim`, …).

## What it looks like

Default (collapsed) transcript:

```
❯ Fix the build error in cdbvar.c and run the tests

● read (src/backend/cdb/cdbvar.c) … 214 lines
● edit (src/backend/cdb/cdbvar.c) +12/−3
● bash (make -j8) ok (140 lines)
● bash (ctest -R cdb) error: 2 tests failed
```

- `❯ ` prefixes your prompts, so questions are instantly distinguishable from
  answers
- `●` bullet indicates state: **mauve** (accent) = running, **green** = success,
  **red** = failure, yellow = streaming partial output
- Bold tool name + dim argument summary (`path`, `command`, `url`, `query`, …)
- Smart result summaries: edit tools show `+N/−M` diff stats; others show the
  first output line and line count

Press `ctrl+o` (or click) on a tool entry to expand **both the call and its
output** — the full invocation (multi-line commands, file contents, JSON args)
plus the dimmed result body, with diff lines colored green/red:

```
● bash (gcc -Wall -o sample sample.c) ok
call:
  gcc -Wall -o /tmp/sample.c -o /tmp/sample &&
  ./sample && echo "exit: $?"
out:
  hello from the renderer test
  exit: 0
```

Applies to **every** tool via pi's global tool-renderer hook — built-ins,
extension tools, and MCP tools alike.

## Install

From npm:

```bash
pi install npm:pi-claude-ui
```

From GitHub:

```bash
pi install git:github.com/e-ivkov/pi-claude-ui
```

Try it once without installing:

```bash
pi -e npm:pi-claude-ui
```

Reload a running session with `/reload` after installing.

## Theme

Works with any pi theme (built-in `dark`/`light`, `system`, or custom) —
status colors come from theme roles. The screenshot above pairs it with a
[Catppuccin](https://catppuccin.com) palette; several Catppuccin ports for pi
exist on npm, e.g. `pi install npm:pi-catppuccin-tui`.

## Keybindings

| Key | Action |
|-----|--------|
| `ctrl+o` | Collapse/expand the selected tool entry (call + output) |
| `ctrl+t` | Collapse/expand thinking blocks |

## Customize

- Preview caps (`40` lines), bullet glyph (`●`), and the `❯` prompt marker:
  edit `extensions/claude-status.ts`, then `/reload`

## Uninstall

```bash
pi remove npm:pi-claude-ui
```

## License

MIT
