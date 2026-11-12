# Better Auth Migrations

Never write Better Auth tables or migrations by hand. The Better Auth CLI creates them.

## Rules

- Whenever the auth setup changes (new plugin such as `organization`, new social provider that needs
  extra fields, new user fields), run the Better Auth CLI to update the schema:

  ```bash
  bunx @better-auth/cli generate --config <path to auth config> --output <path to drizzle auth schema>
  ```

- With Drizzle, the CLI generates the Drizzle schema file. Turn it into a SQL migration with the
  normal Drizzle command (`bun run db:generate` in `packages/database`), then apply it with
  `bun run db:migrate`. Do not write that SQL yourself.
- Do not edit the generated auth schema by hand. If something is wrong, fix the auth config and
  generate again.
- Never create or change `user`, `session`, `account`, `verification` or organization tables
  (`organization`, `member`, `invitation`, ...) in a hand-written migration.
- Commit the generated schema and migration files together with the auth config change.
- Check the CLI's current options with `bunx @better-auth/cli generate --help` before using a flag
  you are not sure about.
