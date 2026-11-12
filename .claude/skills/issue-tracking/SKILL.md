---
name: issue-tracking
description: Create, read, list, edit, comment on, and close GitHub issues with the `gh` CLI. Use when the user asks to write, file, publish, fetch, update, or close a ticket or issue, or when another skill says "publish to the issue tracker" or "fetch the relevant ticket".
---

# Issue tracker: GitHub

Issues for this repo live on GitHub. Use the `gh` CLI for everything. Inside a clone, `gh` finds the repo from `git remote -v`. If `gh auth status` fails, ask the user to run `gh auth login` and stop.

## Ask before you act

Creating, editing, commenting on, and closing issues are visible to others. Show the exact title and body (or the exact change) first, then wait for a clear yes. One approval covers one action. Reading and listing never need approval. Exception: when the user asks to implement a ticket, assigning and status changes are already approved (see "Implementing a ticket").

## Commands

- **Create**: `gh issue create --title "..." --body "$(cat <<'EOF' ... EOF)"` (heredoc for multi-line bodies), plus `--label "..."`
- **Read**: `gh issue view <number> --comments`
- **List**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with `--label` / `--state` filters as needed
- **Edit**: `gh issue edit <number> --title "..." --body "..."`, `--add-label "..."`, `--remove-label "..."`
- **Comment**: `gh issue comment <number> --body "..."`
- **Close**: `gh issue close <number> --comment "..."` (reopen: `gh issue reopen <number>`)

## Ticket format

Title: short, imperative, no full stop (like a commit subject, e.g. "Add scene suggestions from a description").

Body:

```markdown
## Context
Why this matters, for whom.

## Goal
What should be true when it is done.

## Tasks
- [ ] Small, checkable steps

## Acceptance criteria
- Observable results someone can verify

## Out of scope
What this ticket does not cover (omit if nothing).
```

Write in plain language, no jargon. Ask: "Would someone without prior knowledge understand this?" (see CLAUDE.md).

## Labels

Give each issue one label. They match the commit types in `.claude/rules/commit-messages.md`:

| Label | Use for |
| --- | --- |
| `feat` | New feature or improvement for users |
| `fix` | Something is broken and needs repair |
| `chore` | Maintenance, dependencies, tooling |
| `docs` | Documentation only |
| `perf` | Makes something faster or lighter |
| `refactor` | Cleans up code without changing behavior |
| `test` | Adds or improves tests |
| `build` | Build system or dependencies |
| `ci` | Automated checks and pipelines |

Do not create new labels without asking.

## Implementing a ticket

When the user asks to implement an issue ("work on #12", "implement this ticket"), the request itself is the approval for the steps below. Do them before writing code:

1. Read it: `gh issue view <number> --comments`.
2. Assign it to the current user: `gh issue edit <number> --add-assignee "@me"`.
3. Set its project status to **In Progress** (see below).

When the work is finished, set the status to **Done** and leave a short comment saying what changed. Closing happens through the PR (`Closes #<number>`); do not close the issue by hand unless the user asks.

### Setting the status

Status lives in the repo's GitHub Project, not on the issue. This needs the `project` scope once: `gh auth refresh -s project`. If a command fails on missing scopes, ask the user to run that and stop.

```bash
OWNER=$(gh repo view --json owner --jq .owner.login)
gh project list --owner "$OWNER"                                  # find the project <num>
PROJECT_ID=$(gh project view <num> --owner "$OWNER" --format json --jq .id)
gh project field-list <num> --owner "$OWNER" --format json        # find the "Status" field id and option ids
ITEM_ID=$(gh project item-add <num> --owner "$OWNER" --url <issue-url> --format json --jq .id)   # safe if already on the board
gh project item-edit --id "$ITEM_ID" --project-id "$PROJECT_ID" \
  --field-id <status-field-id> --single-select-option-id <option-id>
```

Look up the ids each time; do not hard-code them. If there is more than one project, or no "In Progress" / "Done" option, ask the user which to use instead of guessing.

## Linking work

Put `Closes #<number>` in the PR description so the issue closes on merge. A bare `#42` may be an issue or a PR (one shared number space): try `gh issue view 42`, and fall back to `gh pr view 42`.

## Pull requests

PRs are not a request surface here. For a PR, use `gh pr view <number> --comments` and `gh pr diff <number>` to read it.

## Other skills' wording

- "Publish to the issue tracker" means create a GitHub issue (after approval).
- "Fetch the relevant ticket" means `gh issue view <number> --comments`.
