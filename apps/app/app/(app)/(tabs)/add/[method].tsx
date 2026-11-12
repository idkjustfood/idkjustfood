import { Redirect, router, useLocalSearchParams } from "expo-router"
import { Camera, ImagePlus } from "lucide-react-native"
import { useState } from "react"
import { Pressable, Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import {
  addMethods,
  checkLink,
  isAddMethod,
  type AddMethod,
} from "@/lib/add-methods"

const samples: Partial<Record<AddMethod, { good: string; bad: string }>> = {
  video: {
    good: "https://www.instagram.com/reel/example4",
    bad: "https://www.tiktok.com/@someone/video/123",
  },
  website: {
    good: "https://example-kitchen.com/salmon-traybake",
    bad: "not a link",
  },
}

export default function AddInput() {
  const { method } = useLocalSearchParams<{ method: string }>()
  if (!isAddMethod(method)) return <Redirect href="/add" />
  return <AddForm method={method} />
}

function AddForm({ method }: { method: AddMethod }) {
  const info = addMethods[method]
  const [link, setLink] = useState("")
  const [text, setText] = useState("")
  const [photo, setPhoto] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const isLink = method === "video" || method === "website"
  const ready = isLink
    ? link.trim() !== ""
    : method === "text"
      ? text.trim() !== ""
      : photo

  function submit() {
    if (isLink) {
      const issue = checkLink(method, link)
      if (issue === "invalid")
        return setProblem("That does not look like a link.")
      if (issue === "unsupported") {
        return router.push({
          pathname: "/add/error",
          params: { reason: "unsupported", link },
        })
      }
    }
    setProblem(null)
    router.push({ pathname: "/add/progress", params: { method } })
  }

  const sample = samples[method]

  return (
    <Screen
      title={info.title}
      subtitle={info.description}
      back="/add"
      narrow
      footer={<Button label="Get recipe" disabled={!ready} onPress={submit} />}
    >
      {isLink && (
        <View className="gap-3">
          <Input
            label={
              method === "video"
                ? "Link to the reel"
                : "Link to the recipe page"
            }
            value={link}
            onChangeText={(value) => {
              setLink(value)
              setProblem(null)
            }}
            placeholder="https://"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={submit}
          />
          {problem && (
            <Text role="alert" className="text-sm text-destructive">
              {problem}
            </Text>
          )}
          {sample && (
            <View className="gap-2">
              <Text className="text-sm text-muted-foreground">
                Try it with a sample link:
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label="Working link"
                  onPress={() => setLink(sample.good)}
                />
                <Chip
                  label={
                    method === "video" ? "Unsupported link" : "Broken link"
                  }
                  onPress={() => setLink(sample.bad)}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {method === "text" && (
        <Input
          label="Recipe text"
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          className="h-64 py-3"
          placeholder={
            "Paste the recipe here.\n\nFor example:\n2 eggs, 80 g oats…"
          }
        />
      )}

      {method === "photo" &&
        (photo ? (
          <Card className="gap-3 p-4">
            <View className="h-56 items-center justify-center rounded-md bg-muted">
              <Text className="text-muted-foreground">cookbook-page.jpg</Text>
            </View>
            <Button
              variant="outline"
              label="Choose a different photo"
              onPress={() => setPhoto(false)}
            />
          </Card>
        ) : (
          <View className="gap-3 md:flex-row">
            <PhotoOption
              icon={Camera}
              label="Take a photo"
              onPress={() => setPhoto(true)}
            />
            <PhotoOption
              icon={ImagePlus}
              label="Choose from library"
              onPress={() => setPhoto(true)}
            />
          </View>
        ))}
    </Screen>
  )
}

function PhotoOption({
  icon,
  label,
  onPress,
}: {
  icon: typeof Camera
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      role="button"
      onPress={onPress}
      className="h-40 flex-1 items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border active:bg-accent web:hover:bg-accent"
    >
      <Icon as={icon} size={32} className="text-primary" />
      <Text className="text-base font-medium text-foreground">{label}</Text>
    </Pressable>
  )
}
