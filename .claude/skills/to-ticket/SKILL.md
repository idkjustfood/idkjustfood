---
name: to-ticket
description: Turn an idea, request, or conversation into a GitHub issue. Use when the user wants to write, file, or create a ticket from something they described.
---

# To ticket

Turns an idea into a GitHub issue. All issue rules (format, labels, approval, `gh` commands) live in the `issue-tracking` skill. Use it, do not repeat it here.

## Steps

1. Understand the idea. If the goal or the audience is unclear, ask one short question. Otherwise use sensible defaults.
2. Draft the ticket in the format from `issue-tracking` ("Ticket format"): title, body with Context, Goal, Tasks, Acceptance criteria, and Out of scope if needed.
3. Pick exactly one label from the `issue-tracking` label table.
4. Show the exact title, label, and body, and ask: "Should I create it like this?"
5. After a clear yes, create the issue with `gh issue create` as described in `issue-tracking`.
6. Reply with the issue link and nothing else that needs reading.

## Rules

- Write in plain language, no jargon. Ask: "Would someone without prior knowledge understand this?"
- One idea per ticket. If the request holds several independent ideas, suggest splitting and ask.
- Never create the issue before the user approved the shown text.
- Do not start implementing. That is the job of `implement-ticket`.
