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

### Export (App → Raycast)
1. Query all snippets from Supabase
2. Map to Raycast JSON format
3. Write to `raycast-export/snippets.json`
4. User imports via Raycast "Import Snippets" command
5. Mark snippets as synced with timestamp

### Import (Raycast → App)
1. User exports Raycast settings (Settings > Export)
2. Decrypt .rayconfig:
   ```bash
   openssl enc -d -aes-256-cbc -nosalt \
     -in file.rayconfig -k PASSWORD | tail -c +17
   ```
3. Parse JSON, extract snippets
4. Diff against local DB
5. Show conflicts, user chooses resolution

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
