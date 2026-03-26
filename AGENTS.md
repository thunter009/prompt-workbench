# Agent Instructions

This project uses **br** (beads_rust) for issue tracking.

## Quick Reference

```bash
bv --robot-triage     # Graph-aware work selection (preferred)
br ready              # Fallback: simple unblocked list
br show <id>          # View issue details
br update <id> --status in_progress  # Claim work
br close <id>         # Complete work
```

## Repository Layout

- `ralph-tui` is tracked as a git submodule; keep `.gitmodules` aligned with that path.

## Landing the Plane (Session Completion)

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Sync beads** - `br sync --flush-only && git add .beads/ && git commit -m "sync beads"`
5. **Push only when user/task explicitly requires remote landing.** If not pushing, leave exact next commands in handoff.
6. **Hand off** - Provide context for next session
