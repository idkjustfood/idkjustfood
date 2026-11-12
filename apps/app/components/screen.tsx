import { router, type Href } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import type { ReactNode } from "react"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Button } from "@/components/ui/button"
import { useIsWide } from "@/lib/layout"
import { cn } from "@/lib/utils"

type ScreenProps = {
  title: string
  subtitle?: string
  /** Shows a back button. Goes back in history, or to this screen when there is none (deep links). */
  back?: Href
  /** Buttons on the right of the header. */
  actions?: ReactNode
  /** Content right under the header that does not scroll, like a search field. */
  toolbar?: ReactNode
  /** Content pinned to the bottom, like a save button. */
  footer?: ReactNode
  children: ReactNode
  scroll?: boolean
  /** Narrow content (forms) instead of the wide default. */
  narrow?: boolean
  contentClassName?: string
}

/**
 * The frame for every screen: safe area, header, scrolling content with a sensible
 * maximum width so the layout does not stretch on desktop.
 */
export function Screen({
  title,
  subtitle,
  back,
  actions,
  toolbar,
  footer,
  children,
  scroll = true,
  narrow,
  contentClassName,
}: ScreenProps) {
  const wide = useIsWide()
  const width = cn("w-full self-center", narrow ? "max-w-2xl" : "max-w-6xl")

  const content = (
    <View className={cn(width, "gap-6 px-4 pb-10 md:px-8", contentClassName)}>
      {children}
    </View>
  )

  return (
    // On phones the tab bar handles the bottom safe area.
    <SafeAreaView
      edges={wide ? ["top", "right"] : ["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      <View className={cn(width, "gap-3 px-4 pb-3 pt-2 md:px-8 md:pt-6")}>
        <View className="min-h-12 flex-row items-center gap-2">
          {back && (
            <Button
              variant="ghost"
              size="icon"
              icon={ChevronLeft}
              label="Back"
              className="-ml-3"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace(back)
              }
            />
          )}
          <View className="flex-1">
            <Text
              role="heading"
              numberOfLines={2}
              className={cn(
                "font-bold text-foreground",
                back ? "text-xl md:text-2xl" : "text-3xl"
              )}
            >
              {title}
            </Text>
            {subtitle && (
              <Text className="text-sm text-muted-foreground">{subtitle}</Text>
            )}
          </View>
          {actions && (
            <View className="flex-row items-center gap-1">{actions}</View>
          )}
        </View>
        {toolbar}
      </View>
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pt-2"
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        <View className="flex-1">{content}</View>
      )}
      {footer && (
        <View className="border-t border-border bg-background">
          <View className={cn(width, "px-4 py-3 md:px-8")}>{footer}</View>
        </View>
      )}
    </SafeAreaView>
  )
}
