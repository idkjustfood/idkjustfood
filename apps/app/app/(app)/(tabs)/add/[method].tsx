import * as ImagePicker from "expo-image-picker"
import { Redirect, router, useLocalSearchParams } from "expo-router"
import { Camera, ImagePlus } from "lucide-react-native"
import { useState } from "react"
import { Image, Pressable, Text, View } from "react-native"

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
import type { PickedImage } from "@/lib/api/client"
import { useAppState } from "@/lib/app-state"
import { useStartExtraction, type ExtractionRequest } from "@/lib/extractions"

/** Sample links for trying the clickable prototype (demo mode only). */
const samples: Partial<Record<AddMethod, { good: string; bad: string }>> = {
  video: {
    good: "https://www.instagram.com/reel/example4",
    bad: "https://vimeo.com/123",
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

function pickedImage(asset: ImagePicker.ImagePickerAsset): PickedImage {
  const mimeType = asset.mimeType ?? "image/jpeg"
  return {
    uri: asset.uri,
    mimeType,
    name: asset.fileName ?? `recipe.${mimeType.split("/")[1] ?? "jpg"}`,
    file: asset.file,
  }
}

function AddForm({ method }: { method: AddMethod }) {
  const info = addMethods[method]
  const { demo } = useAppState()
  const start = useStartExtraction()
  const [link, setLink] = useState("")
  const [text, setText] = useState("")
  const [photo, setPhoto] = useState<PickedImage | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const isLink = method === "video" || method === "website"
  const ready = isLink
    ? link.trim() !== ""
    : method === "text"
      ? text.trim() !== ""
      : photo !== null

  async function choosePhoto(source: "camera" | "library") {
    setProblem(null)
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) {
          return setProblem(
            "Allow camera access in your settings to take a photo."
          )
        }
      }
      // A quality below 1 also turns iPhone HEIC photos into JPEG, which the server reads.
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.8,
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options)
      const asset = result.canceled ? undefined : result.assets[0]
      if (asset) setPhoto(pickedImage(asset))
    } catch {
      setProblem("Could not open the photo. Try a different one.")
    }
  }

  function submit() {
    if (!ready || start.isPending) return
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

    const request: ExtractionRequest = isLink
      ? { type: "link", url: link }
      : method === "text"
        ? { type: "text", text }
        : { type: "photo", photo: photo! }

    start.mutate(request, {
      onSuccess: (job) =>
        router.push({
          pathname: "/add/progress",
          params: { method, job: job.id },
        }),
      onError: (error) => {
        if ("code" in error && error.code === "unsupported_link") {
          router.push({
            pathname: "/add/error",
            params: {
              reason: "unsupported",
              link: isLink ? link : undefined,
              message: error.message,
            },
          })
        } else {
          setProblem(error.message)
        }
      },
    })
  }

  const sample = demo ? samples[method] : undefined

  return (
    <Screen
      title={info.title}
      subtitle={info.description}
      back="/add"
      narrow
      footer={
        <View className="gap-3">
          {problem && method !== "video" && method !== "website" && (
            <Text role="alert" className="text-sm text-destructive">
              {problem}
            </Text>
          )}
          <Button
            label={start.isPending ? "Sending…" : "Get recipe"}
            disabled={!ready || start.isPending}
            onPress={submit}
          />
        </View>
      }
    >
      {isLink && (
        <View className="gap-3">
          <Input
            label={
              method === "video"
                ? "Link to the video"
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
          onChangeText={(value) => {
            setText(value)
            setProblem(null)
          }}
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
            <Image
              source={{ uri: photo.uri }}
              accessibilityLabel="The photo you chose"
              resizeMode="contain"
              className="h-56 w-full rounded-md bg-muted"
            />
            <Button
              variant="outline"
              label="Choose a different photo"
              onPress={() => setPhoto(null)}
            />
          </Card>
        ) : (
          <View className="gap-3 md:flex-row">
            <PhotoOption
              icon={Camera}
              label="Take a photo"
              onPress={() => void choosePhoto("camera")}
            />
            <PhotoOption
              icon={ImagePlus}
              label="Choose from library"
              onPress={() => void choosePhoto("library")}
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
