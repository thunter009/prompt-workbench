# Raycast Integration

## Snippet Format

Raycast expects JSON array:
```json
[
  {
    "name": "Personal Email",
    "text": "sherlock@gmail.com",
    "keyword": "@@"
  }
]
```

**Constraints:**
- 65,536 char limit per snippet
- `name` and `text` required, `keyword` optional

## Dynamic Placeholders

### Core Placeholders
| Placeholder | Syntax | Purpose |
|---|---|---|
| Clipboard | `{clipboard}` | Last copied text |
| Cursor | `{cursor}` | Cursor position after paste |
| Date | `{date}` | Current date |
| Time | `{time}` | Current time |
| DateTime | `{datetime}` | Combined |
| Weekday | `{day}` | Day of week |
| UUID | `{uuid}` | Random UUID |
| Selection | `{selection}` | Selected text |
| Argument | `{argument}` | User input (max 3) |
| Snippet | `{snippet name="..."}` | Reference other snippet |

### Modifiers
- `uppercase`, `lowercase`, `trim`
- `percent-encode`, `json-stringify`, `raw`

### Date/Time Formatting
- Offsets: `{date offset="+2y +5M"}`
- Custom format: `{date format="yyyy-MM-dd"}`

## Two-Way Sync

### Default Path
All sync uses `~/.prompt-workbench/raycast-snippets.json` as the default location.

### Export (App → Raycast)
1. Click Export or Quick Export (⌘⇧E)
2. Saves to `~/.prompt-workbench/raycast-snippets.json`
3. AppleScript auto-opens Raycast import dialog
4. AppleScript navigates to file and triggers import
5. Requires macOS Accessibility permissions for full automation

**Browser support:**
- Chromium: File System Access API for custom paths
- Firefox/Safari: Server-side export to default path

### Import (Raycast → App)
1. Click Import button (↑) in header
2. Click "Open Raycast Export" - triggers deeplink `raycast://extensions/raycast/snippets/export-snippets`
3. AppleScript auto-saves to `~/.prompt-workbench/`
4. App polls for file, auto-detects when ready
5. Select snippets → Import

**Deeplinks used:**
- Export: `raycast://extensions/raycast/snippets/export-snippets`
- Import: `raycast://extensions/raycast/snippets/import-snippets`

**Note:** Raycast stores snippets in encrypted SQLite - can't read directly.

## Sync Scheduling

### File Watcher (Primary)
- Uses chokidar to watch `~/Library/Application Support/Raycast/`
- Triggers sync on file changes (debounced 1s)
- Near real-time, minimal overhead
- Can be toggled off in settings

### Interval Backup (Secondary)
- Uses node-cron for scheduled sync
- Default: every 30 minutes
- Configurable via settings UI (5m, 15m, 30m, 1h, 4h)
- Catches any changes watcher missed

### Settings UI
- Toggle: Enable file watcher (default: on)
- Toggle: Enable interval sync (default: on)
- Dropdown: Interval frequency
- Display: Last sync timestamp
- Button: Manual sync now

## Character Limit Handling

If snippet exceeds 65,536 chars:
- Warn user in editor
- Block export until resolved
- Suggest splitting into multiple snippets
