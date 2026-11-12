/**
 * "cloud" for our hosted build, anything else is a self-hosted install.
 * Cloud-only screens (billing, pricing) must never show up in a self-hosted build.
 */
export const isCloud = process.env.EXPO_PUBLIC_EDITION === "cloud"
