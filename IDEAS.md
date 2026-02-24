# MailNick — Feature Ideas

## High Value / Low Effort

### Rule live preview
When editing or creating a cleanup rule in the rule editor, show a live preview of which currently-synced emails would match. The matching logic already lives in `src/lib/utils/cleanup-matcher.ts` — it just needs to be called client-side as the user types.

### Rule match statistics
Track how many emails each cleanup rule has matched and acted on over time. The action history table (`actions` in DB) already records which emails were touched; a simple group-by query per rule would surface "this rule has archived 143 emails" in the UI. Useful for auditing and tuning rules.

### Dry-run / preview before applying rules
Before executing a cleanup task, show "this rule would affect N emails" with a preview list, and require an explicit confirm. Reduces anxiety about bulk operations. Builds naturally on the live preview above.

---

## High Value / Medium Effort

### Scheduled auto-sync
The sync logic is fully server-side and account-aware. A background job (e.g. `node-cron` triggered from `src/lib/server/init.ts`) could auto-sync every N hours per account, removing the need for manual sync clicks. Configurable interval per account stored in DB. Could add a "last synced" timestamp to the account list UI.

### Undo for batch AI actions
AI-grouped batch actions are already individually tracked in action history. Adding a "Undo last AI session" button that reverses all actions taken in a single AI grouping run would be a natural complement to the existing per-action undo. Group actions by a `sessionId` timestamp written at the time of the AI run.

### Unsubscribe suggestions
When a cleanup rule has archived/trashed emails from the same sender many times, suggest an unsubscribe link if one is present in the email body. Gmail API returns the `List-Unsubscribe` header — could surface these as a separate "suggested unsubscribes" panel.

---

## Medium Value / Medium Effort

### Cleanup rule templates
Pre-built rule templates for common patterns: newsletters, GitHub notifications, CI/CD emails, calendar invites, social media notifications. Presented as a "quick add" gallery when creating a new rule, since the rule schema (`matchCriteria`) already supports the needed fields.

### Email activity report / export
A summary of what was cleaned up per sync session — counts by rule, action type, and sender domain. Could export as CSV or display as a simple stats panel. All data is already in the `actions` table; needs aggregation queries and a UI.

### Multi-label support in cleanup rules
Currently a rule can apply one label. Extending `matchCriteria` to support applying multiple labels simultaneously would cover common workflows like "label as Newsletter AND Archive".

### Snooze action
Add a "snooze" action type that re-marks an email as unread after N hours/days. Requires a scheduled job to re-apply the mark-unread operation, but the action history + init.ts startup hook would support this pattern.

---

## Longer Term

### Browser extension / email triage mode
A minimal triage interface — keyboard-driven, one email at a time — optimized for quickly deciding archive/trash/keep for each unread email. The backend APIs already support all needed operations.

### Smart rule suggestions from AI
After accumulating action history, use Gemini to suggest new cleanup rules based on patterns it observes ("You've manually archived 20 emails from domain X — want to create a rule?"). Would reuse the existing Gemini integration.

### Multiple provider support
The architecture isolates Gmail API calls in `src/lib/server/gmail/`. Supporting Outlook/IMAP would require a provider abstraction layer but the DB schema and action model are already provider-agnostic.

### Mobile-optimized view
The current UI is desktop-first. A swipe-based mobile triage view would make the tool useful on the go, leveraging the existing REST APIs without backend changes.
