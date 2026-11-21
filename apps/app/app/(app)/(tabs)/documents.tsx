import * as DocumentPicker from "expo-document-picker"
import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Plus,
} from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { documentKind, mayDeleteDocument } from "@/lib/document-view"
import {
  openDocument,
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
  type StoredFile,
} from "@/lib/documents"
import { formatFileSize } from "@/lib/format"
import { useHousehold, useMyUserId } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { cn } from "@/lib/utils"

const icons = {
  pdf: FileText,
  image: ImageIcon,
  text: FileText,
  other: FileIcon,
}

export default function Documents() {
  const { t } = useTranslation()
  const wide = useIsWide()
  const { household, ready } = useHousehold()
  const space = household?.id ?? null
  const userId = useMyUserId()
  const { data: files, isPending, error, refetch } = useDocuments(space)
  const upload = useUploadDocument(space)
  const remove = useDeleteDocument(space)
  const [selected, setSelected] = useState<StoredFile | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function pick() {
    setMessage(null)
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    })
    const asset = result.canceled ? undefined : result.assets[0]
    if (!asset) return
    upload.mutate(
      {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? "application/octet-stream",
        file: asset.file,
      },
      { onError: (e) => setMessage(e.message) }
    )
  }

  async function open(file: StoredFile) {
    setMessage(null)
    try {
      await openDocument(file)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("documents:openError"))
    }
  }

  return (
    <Screen
      title={t("documents:title")}
      subtitle={
        household
          ? t("documents:sharedWith", { name: household.name })
          : t("documents:ownDocuments")
      }
      narrow
      toolbar={!wide && <SpaceSwitcher />}
      actions={
        <Button
          size="sm"
          icon={Plus}
          label={t("documents:upload")}
          disabled={!ready || upload.isPending}
          onPress={() => void pick()}
        />
      }
    >
      <Text className="text-sm text-muted-foreground">
        {household
          ? t("documents:visibleHousehold", { name: household.name })
          : t("documents:visiblePersonal")}
      </Text>
      {upload.isPending && (
        <Text role="status" className="text-sm text-muted-foreground">
          {t("documents:uploading")}
        </Text>
      )}
      {message && (
        <Text role="alert" className="text-sm text-destructive">
          {message}
        </Text>
      )}
      {isPending && !error && (
        <LoadingState label={t("documents:loading")} rows={3} />
      )}
      {error && (
        <ErrorState
          title={t("documents:loadError.title")}
          message={t("documents:loadError.message")}
          onRetry={() => void refetch()}
        />
      )}
      {files && files.length === 0 && (
        <EmptyState
          icon={FileText}
          title={t("documents:empty.title")}
          message={t("documents:empty.message")}
          action={t("documents:upload")}
          onAction={() => void pick()}
        />
      )}
      {files && files.length > 0 && (
        <View className="overflow-hidden rounded-lg border border-border bg-card">
          {files.map((file, index) => (
            <DocumentRow
              key={file.id}
              file={file}
              first={index === 0}
              onPress={() => setSelected(file)}
            />
          ))}
        </View>
      )}

      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
      >
        {selected && (
          <>
            <Text className="text-sm text-muted-foreground">
              {formatFileSize(selected.sizeBytes)}
            </Text>
            <View className="flex-row gap-3">
              {mayDeleteDocument(selected, userId ?? "", household?.role) && (
                <Button
                  variant="outline"
                  label={t("documents:delete")}
                  className="flex-1"
                  disabled={remove.isPending}
                  onPress={() =>
                    remove.mutate(selected.id, {
                      onSuccess: () => setSelected(null),
                      onError: (e) => {
                        setSelected(null)
                        setMessage(e.message)
                      },
                    })
                  }
                />
              )}
              <Button
                label={t("documents:open")}
                className="flex-1"
                onPress={() => {
                  void open(selected)
                  setSelected(null)
                }}
              />
            </View>
          </>
        )}
      </Sheet>
    </Screen>
  )
}

function DocumentRow({
  file,
  first,
  onPress,
}: {
  file: StoredFile
  first: boolean
  onPress: () => void
}) {
  const { t } = useTranslation()
  return (
    <Pressable
      role="button"
      accessibilityLabel={t("documents:openDetails", { name: file.name })}
      onPress={onPress}
      className={cn(
        "min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-accent web:hover:bg-accent",
        !first && "border-t border-border"
      )}
    >
      <Icon
        as={icons[documentKind(file.mimeType)]}
        className="text-muted-foreground"
      />
      <View className="flex-1 gap-0.5">
        <Text className="text-base text-foreground" numberOfLines={2}>
          {file.name}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {formatFileSize(file.sizeBytes)}
        </Text>
      </View>
    </Pressable>
  )
}
