# Logging

The api and the worker write **JSON log lines** to the standard output, one line per event. There
is no logging service to set up: with Docker Compose, read them with

```bash
docker compose logs -f api worker
```

and send them wherever you like (a log shipper can read the container output). Sending logs to an
external service is not built in.

```json
{
  "time": "2026-11-14T09:30:01.120Z",
  "level": "info",
  "msg": "request",
  "service": "api",
  "requestId": "5b0c…",
  "method": "POST",
  "path": "/api/extractions/link",
  "status": 202,
  "durationMs": 41,
  "userId": "u1"
}
```

Every line has `time`, `level` and `msg`. The rest are fields that belong to the event.

## Settings

| Variable    | Values                                     | Default |
| ----------- | ------------------------------------------ | ------- |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error`, `silent` | `info`  |

- `info`: requests, jobs and the steps of each extraction.
- `debug`: also the start of every step, the health check and skipped jobs.
- `warn` / `error`: only problems. `silent`: nothing.

An unknown value falls back to `info` and prints a warning at start-up.

## What is logged

**API**

- `request`: method, path (never the query), status, duration, `requestId`, and `userId` when signed
  in. 4xx answers are `warn`, 5xx are `error`.
- `unhandled error`: the error with its stack trace, the `requestId`, method and path. The person gets
  a plain `500` answer.
- `extraction queued`: the new `jobId`, with the `requestId` of the request.

Each response has an `X-Request-Id` header. If a reverse proxy already sends one (letters, digits,
`.`, `_`, `-`, 8 to 64 characters) it is kept, otherwise the api makes one.

**Worker and extraction**

- `job started`, `job finished` (with `durationMs` and `recipeId`), `job failed` (an expected
  problem such as a private video, with `code` and `reason`) and `job crashed` (anything else, with
  the stack trace).
- One line per step: `step done`, or `step failed`. The `step` field is `gather` (download of the
  video or page), `transcription`, `vision` or `parsing`. The AI steps also have `provider` and
  `model`. `source` is the input module (`instagram`, `website`, ...).
- All of them carry `jobId` and the `requestId` of the request that started the job.

## Following a request to its job

The API passes the request ID to the job queue, so the worker logs it too. To see everything about
one request:

```bash
docker compose logs api worker | grep 5b0c3f2e
```

To see why a job failed, search for its `jobId` and look at the `step failed` line.

## What is never logged

- Values of fields named like `password`, `token`, `secret`, `api_key`, `authorization`, `cookie` or
  `session` are replaced by `[redacted]`. Patterns such as `Bearer …` and `sk-…` are hidden inside
  messages and error texts too.
- Recipe and user content (`text`, `caption`, `image`, `ingredients`, `steps`, `email`, ...) is
  replaced by `[left out]`. Texts longer than 500 characters are cut.
- AI provider addresses and keys are not logged, only the provider ID and the model name.

When you add logging, put such values in the fields as they are: the logger takes care of this
for field names. Do not build them into the message text.

## For developers

The logger is in `packages/logger`.

```ts
import { loggerFromEnv } from "@workspace/logger"

const logger = loggerFromEnv(process.env, undefined, { service: "api" })
logger.info("something happened", { jobId, durationMs })
const jobLog = logger.child({ jobId }) // adds jobId to every line
```

- Code that logs takes a `logger` as an option and defaults to `silentLogger`, so tests stay quiet.
  The servers (`apps/api/src/index.ts`, `apps/worker/src/index.ts`) create the real one.
- Pass errors as `err` so the stack trace is written: `logger.error("failed", { err })`.
