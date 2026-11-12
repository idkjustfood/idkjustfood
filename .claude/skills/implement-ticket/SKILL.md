---
name: implement-ticket
description: Implement an existing GitHub issue and keep its status up to date. Use when the user says "implement #12", "work on this ticket", or similar.
---

# Implement ticket

Builds what a GitHub issue asks for and keeps its status in sync. All issue rules (reading, assigning, project status, linking) live in the `issue-tracking` skill, section "Implementing a ticket". Use it, do not repeat it here.

## Steps

1. **Start.** Follow `issue-tracking`: read the issue with its comments, assign it to the current user, and set the status to **In Progress**. The request to implement is the approval for these steps. Do them before writing code.
2. **Branch.** ALWAYS run these four commands in exactly this order, every time, even if you think you are already on an up-to-date `main`:
   1. `git fetch`
   2. `git checkout main`
   3. `git pull`
   4. `git checkout -b <label>/<short-description>`, where the label is the issue's label (for example `feat/scene-suggestions`).

   Never create the branch before the fetch, checkout and pull have succeeded. If any of them fails (no network, uncommitted changes blocking the checkout, pull conflicts), stop and ask the user instead of branching from a stale or wrong base.
3. **Build.** Work through the tasks of the ticket one by one and tick them off. Follow the project rules in `.claude/rules/` (tests first, conventional commits). Stay inside the ticket's scope. Note anything out of scope instead of building it.
4. **Check.** Go through the acceptance criteria and verify each one. Say clearly if one cannot be verified.
5. **Finish.** Open a PR with `Closes #<number>` in the description. Set the status to **Done** (or **In review** if the user wants a review first) and leave a short comment on the issue saying what changed, as described in `issue-tracking`. Do not close the issue by hand.
6. **Report.** Tell the user what was done, what was checked, and the PR link.

## Rules

- Look up project and status ids each time, as `issue-tracking` says. If the board has no matching status, ask instead of guessing.
- If the ticket is unclear or contradicts the code, ask before building.
- Never skip the status updates, and never mark Done while acceptance criteria are open.
