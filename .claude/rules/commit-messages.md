# Commit Messages

Every commit message follows Conventional Commits. A commitlint hook (`.commitlintrc`, `@commitlint/config-conventional`) rejects anything else.

## Format

```text
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

## Rules

- **Type** is required, lower-case, and one of: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.
- **Scope** is optional and free-form (for example `ai`). Do not invent new scopes without need.
- **Subject** is required, imperative ("add", not "added"), starts lower-case, no trailing full stop.
- **Header** (`type(scope): subject`) is at most 100 characters.
- **Body and footer** lines are at most 100 characters. Put a blank line before the body and before the footer.
- Never skip the hook with `--no-verify`. If a message is rejected, fix the message.

## Examples

```text
feat(ai): add scene suggestions from a description
fix: stop the viewer from crashing on empty scenes
chore: update dependencies
```
