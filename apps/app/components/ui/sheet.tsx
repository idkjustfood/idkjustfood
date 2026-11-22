import { useEffect, useMemo, useRef, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useIsWide } from "@/lib/layout"
import { cn } from "@/lib/utils"
import { Heading } from "@/components/ui/heading"

/**
 * A panel that slides up from the bottom on phones and shows as a centred dialog on wide screens.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const { t } = useTranslation("common")
  const wide = useIsWide()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const translateY = useRef(new Animated.Value(0)).current
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) translateY.setValue(0)
  }, [open, translateY])

  // Dragging the header downwards closes the sheet; a short drag springs back.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
        onPanResponderMove: (_, g) => translateY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 100 || g.vy > 0.8) onCloseRef.current()
          else
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: false,
            }).start()
        },
        onPanResponderTerminate: () =>
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: false,
          }).start(),
      }),
    [translateY]
  )
  const maxHeight = Math.round(height * (wide ? 0.85 : 0.9))

  return (
    <Modal
      visible={open}
      transparent
      animationType={wide ? "fade" : "slide"}
      onRequestClose={onClose}
    >
      <View
        className={cn(
          "flex-1",
          wide ? "items-center justify-center p-6" : "justify-end"
        )}
      >
        <Pressable
          accessibilityLabel={t("close")}
          onPress={onClose}
          className="absolute inset-0 bg-foreground/50"
        />
        <Animated.View
          role="dialog"
          aria-label={title}
          style={{
            maxHeight,
            transform: [{ translateY }],
            ...(wide ? null : { paddingBottom: insets.bottom + 16 }),
          }}
          className={cn(
            "w-full gap-4 border-border bg-background p-5",
            wide ? "max-w-md rounded-lg border" : "rounded-t-2xl border-t"
          )}
        >
          <View {...pan.panHandlers} className="gap-4">
            {!wide && (
              <View className="h-1.5 w-10 self-center rounded-full bg-muted" />
            )}
            <Heading className="text-lg font-semibold text-foreground">
              {title}
            </Heading>
          </View>
          <ScrollView
            className="shrink"
            contentContainerClassName="gap-4"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}
