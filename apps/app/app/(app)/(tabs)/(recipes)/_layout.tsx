import { Stack } from "expo-router"

// A deep link to a recipe still gets the list underneath, so "back" works.
export const unstable_settings = { initialRouteName: "index" }

export default function RecipesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
