// One small logger for the API and the worker. It writes JSON lines to the standard
// output, so it works without any logging service. See docs/logging.md.

export type LogLevel = "debug" | "info" | "warn" | "error"
export type LogLevelSetting = LogLevel | "silent"
export type LogFields = Record<string, unknown>

export interface Logger {
  debug(msg: string, fields?: LogFields): void
  info(msg: string, fields?: LogFields): void
  warn(msg: string, fields?: LogFields): void
  error(msg: string, fields?: LogFields): void
  /** A logger that adds `fields` to every line it writes. */
  child(fields: LogFields): Logger
}

const rank: Record<LogLevelSetting, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

const maxText = 500
const maxDepth = 5
const maxItems = 20

/** Names whose values are secrets. */
const secretKey =
  /pass(word|wd)?|secret|token|api[-_]?key|authorization|cookie|credential|bearer|private[-_]?key|session/i
/** Names whose values are recipe or user content. */
const contentKey =
  /^(text|caption|body|html|image|images|audio|material|transcript|content|ingredients|steps|description|prompt|email)$/i
/** Secrets that show up inside normal texts, such as error messages. */
const secretInText: [RegExp, string][] = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redacted]"],
  [/\bsk-[A-Za-z0-9_-]{8,}/g, "[redacted]"],
  [/([?&](?:api[-_]?key|key|token|secret|password)=)[^&\s]+/gi, "$1[redacted]"],
]

function scrub(text: string) {
  let result = text
  for (const [pattern, replacement] of secretInText) {
    result = result.replace(pattern, replacement)
  }
  return result.length > maxText
    ? `${result.slice(0, maxText)}… (${result.length - maxText} more characters)`
    : result
}

function plain(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value
  switch (typeof value) {
    case "string":
      return scrub(value)
    case "number":
    case "boolean":
      return value
    case "bigint":
      return value.toString()
    case "function":
    case "symbol":
      return undefined
  }
  const object = value as object
  if (object instanceof Date) return object.toISOString()
  if (object instanceof Uint8Array || object instanceof ArrayBuffer) {
    return `[binary ${object.byteLength} bytes]`
  }
  if (seen.has(object)) return "[circular]"
  if (depth >= maxDepth) return "[too deep]"
  seen.add(object)
  try {
    if (object instanceof Error) return plainError(object, depth, seen)
    if (Array.isArray(object)) {
      const items = object
        .slice(0, maxItems)
        .map((item) => plain(item, depth + 1, seen))
      if (object.length > maxItems) {
        items.push(`… ${object.length - maxItems} more`)
      }
      return items
    }
    return plainFields(object as LogFields, depth, seen)
  } finally {
    seen.delete(object)
  }
}

function plainFields(fields: LogFields, depth: number, seen: WeakSet<object>) {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (secretKey.test(key)) result[key] = "[redacted]"
    else if (contentKey.test(key)) result[key] = "[left out]"
    else result[key] = plain(value, depth + 1, seen)
  }
  return result
}

function plainError(error: Error, depth: number, seen: WeakSet<object>) {
  const result: Record<string, unknown> = {
    name: error.name,
    message: scrub(error.message),
  }
  const code = (error as { code?: unknown }).code
  if (typeof code === "string" || typeof code === "number") result.code = code
  if (error.stack) result.stack = scrub(error.stack.slice(0, 4000))
  if (error.cause !== undefined) {
    result.cause = plain(error.cause, depth + 1, seen)
  }
  return result
}

export type LoggerOptions = {
  /** Messages below this level are not written. Default `info`. */
  level?: LogLevelSetting
  /** Fields added to every line. */
  fields?: LogFields
  /** Where a finished line goes. Default: the standard output. */
  write?: (line: string) => void
}

const writeToStdout = (line: string) => {
  process.stdout.write(`${line}\n`)
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const threshold = rank[options.level ?? "info"]
  const write = options.write ?? writeToStdout
  const base = options.fields ?? {}

  function log(level: LogLevel, msg: string, fields?: LogFields) {
    if (rank[level] < threshold) return
    try {
      const entry = {
        ...plainFields({ ...base, ...fields }, 0, new WeakSet()),
        // Last, so no field can replace them.
        time: new Date().toISOString(),
        level,
        msg: scrub(msg),
      }
      // Put them first in the line, so it reads well.
      const { time, level: lvl, msg: message, ...rest } = entry
      write(JSON.stringify({ time, level: lvl, msg: message, ...rest }))
    } catch {
      // Logging must never break the request or the job.
    }
  }

  return {
    debug: (msg, fields) => log("debug", msg, fields),
    info: (msg, fields) => log("info", msg, fields),
    warn: (msg, fields) => log("warn", msg, fields),
    error: (msg, fields) => log("error", msg, fields),
    child: (fields) =>
      createLogger({
        level: options.level,
        write,
        fields: { ...base, ...fields },
      }),
  }
}

const noop = () => {}

/** A logger that writes nothing. The default in tests and when no logger is given. */
export const silentLogger: Logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  child: () => silentLogger,
}

const levelNames = ["debug", "info", "warn", "error", "silent"] as const

/**
 * The logger the servers use. The level comes from `LOG_LEVEL`
 * (`debug`, `info`, `warn`, `error` or `silent`; default `info`).
 */
export function loggerFromEnv(
  env: Record<string, string | undefined>,
  write?: (line: string) => void,
  fields?: LogFields
): Logger {
  const wanted = env.LOG_LEVEL?.trim().toLowerCase()
  const level = levelNames.find((name) => name === wanted)
  const logger = createLogger({ level: level ?? "info", write, fields })
  if (wanted && !level) {
    logger.warn("LOG_LEVEL is not known, using info", {
      value: wanted.slice(0, 20),
      allowed: [...levelNames],
    })
  }
  return logger
}

/**
 * Logs errors nobody caught, then stops the process (it is not safe to go on).
 * Call once at start-up.
 */
export function logUncaughtErrors(logger: Logger) {
  process.on("uncaughtException", (err) => {
    logger.error("uncaught exception", { err })
    process.exit(1)
  })
  process.on("unhandledRejection", (err) => {
    logger.error("unhandled promise rejection", { err })
    process.exit(1)
  })
}
