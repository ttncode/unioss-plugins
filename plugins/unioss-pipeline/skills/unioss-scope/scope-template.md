# <PREFIX>#[IID] - SCOPE

### 1. Objectives:

- [one bullet per goal — the problem this ticket solves, in business terms. No file/class/method names.]

### 2. Content:

- [one bullet per discrete change, in business/functional terms — what changed, not how. Name a symbol only when the ticket itself IS the refactor of that symbol.]

### 3. Scope:

**Affected Features**

[App name — omit this sub-heading only when a single app is touched AND the change is a brand-new, isolated feature with nothing to nest under an app. Otherwise always show the app heading(s), even for a single app.]

- [feature/screen name — Japanese screen name in parens if the codebase names it that way]

**Affected URLs:**

[App name — same rule as above]

- `METHOD /path/{param}` - [one-line effect: what happens at this URL that ties to the change, e.g. "Send mail to Producer". Drop the METHOD prefix for normal GET page routes; keep it for API-style routes.]

## Filling this in

- **Title**: `<PREFIX>` is `AP` for AdminPage-origin tickets (`# AP#1585 - SCOPE`), `FE` for FrontEnd-origin (`# FE#391 - SCOPE`) — matches `REFERENCE.md` → Repos & prefixes.
- **When multiple apps are touched** (any change under `common-models`/`common-helper` counts as touching every app that consumes it): repeat the `AdminPage` / `FrontEnd` sub-heading under BOTH Affected Features and Affected URLs, each with its own bullet list. Never merge them into one unlabeled list.
- **URL list ordering**: group by controller/module the way the existing examples do (blank line between groups is fine); don't alphabetize away that grouping.
- **File location**: `.walkthrough/<PREFIX>#[IID]/<PREFIX>#[IID]_SCOPE.md` — the ticket folder, a sibling of `round-<N>/`, not inside one. One file per ticket; overwrite it in place on every round, don't version it (no `_V2`, no `ROUND_BRIEF`-style history).
