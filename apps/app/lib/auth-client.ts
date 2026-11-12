import { expoClient } from "@better-auth/expo/client"
import { createAuthClient } from "better-auth/react"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001"

/**
 * Mobile keeps the session in secure storage (Keychain / Keystore).
 * The web uses the normal browser cookie that the API sets.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins:
    Platform.OS === "web"
      ? []
      : [
          expoClient({
            scheme: "idkjustfood",
            storagePrefix: "idkjustfood",
            storage: SecureStore,
          }),
        ],
})
