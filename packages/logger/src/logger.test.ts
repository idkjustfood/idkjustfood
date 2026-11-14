import { describe, expect, test } from "bun:test"

import {
  createLogger,
  loggerFromEnv,
  silentLogger,
  type LogLevelSetting,
} from "./index.js"

function capture(level?: LogLevelSetting) {
  const lines: string[] = []
  const logger = createLogger({ level, write: (line) => lines.push(line) })
  const entries = () => lines.map((line) => JSON.parse(line))
  return { logger, lines, entries }
}

describe("createLogger", () => {
  test("writes one JSON line with time, level and message", () => {
    const { logger, lines, entries } = capture()
    logger.info("hello", { jobId: "j1" })
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain("\n")
    const [entry] = entries()
    expect(entry.level).toBe("info")
    expect(entry.msg).toBe("hello")
    expect(entry.jobId).toBe("j1")
    expect(new Date(entry.time).toISOString()).toBe(entry.time)
  })

  test("the level hides quieter messages", () => {
    const { logger, entries } = capture("warn")
    logger.debug("a")
    logger.info("b")
    logger.warn("c")
    logger.error("d")
    expect(entries().map((entry) => entry.msg)).toEqual(["c", "d"])
  })

  test("debug level prints everything and silent prints nothing", () => {
    const loud = capture("debug")
    loud.logger.debug("a")
    expect(loud.lines).toHaveLength(1)
    const quiet = capture("silent")
    quiet.logger.error("a")
    expect(quiet.lines).toHaveLength(0)
  })

  test("a child logger adds its fields to every line", () => {
    const { logger, entries } = capture()
    const child = logger.child({ requestId: "r1" }).child({ jobId: "j1" })
    child.info("x", { step: "parse" })
    expect(entries()[0]).toMatchObject({
      requestId: "r1",
      jobId: "j1",
      step: "parse",
    })
  })

  test("fields cannot replace time, level or message", () => {
    const { logger, entries } = capture()
    logger.info("real", { level: "debug", msg: "fake", time: "never" })
    const [entry] = entries()
    expect(entry.level).toBe("info")
    expect(entry.msg).toBe("real")
    expect(entry.time).not.toBe("never")
  })

  test("errors are written with name, message and stack", () => {
    const { logger, entries } = capture()
    logger.error("boom", { err: new TypeError("bad thing") })
    const [entry] = entries()
    expect(entry.err.name).toBe("TypeError")
    expect(entry.err.message).toBe("bad thing")
    expect(entry.err.stack).toContain("bad thing")
  })

  test("the cause of an error is written too", () => {
    const { logger, entries } = capture()
    logger.error("boom", {
      err: new Error("outer", { cause: new Error("inner") }),
    })
    expect(entries()[0].err.cause.message).toBe("inner")
  })

  test("secrets are never written", () => {
    const { logger, lines } = capture()
    logger.info("settings", {
      apiKey: "sk-live-123456789",
      AI_API_KEY: "key-value",
      password: "hunter2",
      authorization: "Bearer abcdefghijkl",
      cookie: "better-auth.session_token=abc",
      nested: { clientSecret: "shh", token: "t0ken", fine: "ok" },
    })
    const text = lines.join("\n")
    for (const secret of [
      "sk-live-123456789",
      "key-value",
      "hunter2",
      "abcdefghijkl",
      "shh",
      "t0ken",
    ]) {
      expect(text).not.toContain(secret)
    }
    expect(text).toContain("[redacted]")
    expect(text).toContain('"fine":"ok"')
  })

  test("secrets inside messages and error texts are hidden", () => {
    const { logger, lines } = capture()
    logger.error("call failed with Bearer abcdefghijklmnop", {
      err: new Error("401 for key sk-or-v1-abcdef1234567890"),
    })
    const text = lines.join("\n")
    expect(text).not.toContain("abcdefghijklmnop")
    expect(text).not.toContain("sk-or-v1-abcdef1234567890")
  })

  test("recipe and user content is left out", () => {
    const { logger, lines } = capture()
    logger.info("job", {
      text: "2 cups of secret family flour",
      caption: "my caption",
      image: new Uint8Array([1, 2, 3]),
      ingredients: [{ name: "flour" }],
      kind: "text",
    })
    const text = lines.join("\n")
    expect(text).not.toContain("family flour")
    expect(text).not.toContain("my caption")
    expect(text).not.toContain("flour")
    expect(text).toContain('"kind":"text"')
  })

  test("long texts are cut", () => {
    const { logger, entries } = capture()
    logger.info("long", { detail: "a".repeat(5000) })
    expect(entries()[0].detail.length).toBeLessThan(700)
  })

  test("circular objects do not crash the logger", () => {
    const { logger, entries } = capture()
    const loop: Record<string, unknown> = { name: "loop" }
    loop.self = loop
    logger.info("circular", { loop })
    expect(entries()).toHaveLength(1)
  })

  test("a failing writer never throws into the caller", () => {
    const logger = createLogger({
      write: () => {
        throw new Error("disk full")
      },
    })
    expect(() => logger.info("x")).not.toThrow()
  })
})

describe("loggerFromEnv", () => {
  test("reads LOG_LEVEL, ignoring case", () => {
    const lines: string[] = []
    const logger = loggerFromEnv({ LOG_LEVEL: "DEBUG" }, (l) => lines.push(l))
    logger.debug("a")
    expect(lines).toHaveLength(1)
  })

  test("defaults to info", () => {
    const lines: string[] = []
    const logger = loggerFromEnv({}, (l) => lines.push(l))
    logger.debug("a")
    logger.info("b")
    expect(lines).toHaveLength(1)
  })

  test("an unknown LOG_LEVEL falls back to info and says so", () => {
    const lines: string[] = []
    const logger = loggerFromEnv({ LOG_LEVEL: "loud" }, (l) => lines.push(l))
    expect(JSON.parse(lines[0]!).level).toBe("warn")
    logger.debug("a")
    expect(lines).toHaveLength(1)
  })

  test("adds fixed fields such as the service name", () => {
    const lines: string[] = []
    const logger = loggerFromEnv({}, (l) => lines.push(l), { service: "api" })
    logger.info("a")
    expect(JSON.parse(lines[0]!).service).toBe("api")
  })
})

test("silentLogger writes nothing and has children", () => {
  expect(() => silentLogger.child({ a: 1 }).error("x")).not.toThrow()
})
