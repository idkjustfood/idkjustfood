import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  api,
  call,
  uploadImage,
  type PickedImage,
  type Schemas,
} from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import i18n from "@/lib/i18n"
import { useRecipeSpace } from "@/lib/recipes"

export type ExtractionJob = Schemas["ExtractionJob"]

/** What to turn into a recipe. */
export type ExtractionRequest =
  | { type: "link"; url: string }
  | { type: "text"; text: string }
  | { type: "photo"; photo: PickedImage }

const knownErrorCodes = [
  "unsupported_link",
  "private_address",
  "invalid_input",
  "ai_not_configured",
  "model_cannot_read_images",
  "ai_failed",
  "video_unavailable",
  "video_too_long",
  "tools_missing",
  "page_unreachable",
  "no_recipe_found",
  "invalid_recipe",
]

/**
 * A translated text for a failed extraction, chosen by the server's error code. The
 * server's own message is English only, so it is never shown; an unknown code gets a
 * generic text.
 */
export function extractionErrorMessage(error?: unknown): string {
  const code =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined
  if (code && knownErrorCodes.includes(code)) {
    return i18n.t(`add:errors.${code}`)
  }
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status?: unknown }).status === 0
  ) {
    return i18n.t("add:errors.network")
  }
  return i18n.t("add:errors.generic")
}

/** The job is over, one way or the other. */
export const isFinished = (job: ExtractionJob | undefined) =>
  job?.status === "succeeded" || job?.status === "failed"

/**
 * Starts reading a link, a photo or a text. The server queues a job and answers at
 * once with its id; `useExtractionJob` follows it. The recipe lands in the current
 * space (yours, or the household's).
 */
export function useStartExtraction() {
  const { demo } = useAppState()
  const { householdId } = useRecipeSpace()
  return useMutation({
    mutationFn: async (request: ExtractionRequest): Promise<ExtractionJob> => {
      if (demo) {
        return {
          id: "demo",
          status: "queued",
          error: null,
          errorCode: null,
          recipe: null,
        }
      }
      const household = householdId ?? undefined
      if (request.type === "link") {
        return (
          await call(
            api.POST("/api/extractions/link", {
              body: { url: request.url.trim(), householdId: household },
            })
          )
        ).job
      }
      if (request.type === "text") {
        return (
          await call(
            api.POST("/api/extractions/text", {
              body: { text: request.text, householdId: household },
            })
          )
        ).job
      }
      return (
        await uploadImage<{ job: ExtractionJob }>(
          "/api/extractions/image",
          request.photo,
          { householdId: household }
        )
      ).job
    },
  })
}

/** Follows a job until it has succeeded or failed. */
export function useExtractionJob(id: string | undefined) {
  const client = useQueryClient()
  return useQuery({
    queryKey: ["extractions", id],
    enabled: !!id && id !== "demo",
    refetchInterval: (query) => (isFinished(query.state.data) ? false : 1500),
    queryFn: async (): Promise<ExtractionJob> => {
      const { job } = await call(
        api.GET("/api/extractions/{jobId}", {
          params: { path: { jobId: id! } },
        })
      )
      // The finished recipe is now in the user's list.
      if (job.status === "succeeded") {
        await client.invalidateQueries({ queryKey: ["recipes"] })
      }
      return job
    },
  })
}
