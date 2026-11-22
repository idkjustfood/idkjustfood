import * as DocumentPicker from "expo-document-picker"
import {
  ChevronLeft,
  File as FileIcon,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Image as ImageIcon,
  Pencil,
  Plus,
} from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import {
  documentKind,
  filesInFolder,
  folderColors,
  folderToneClasses,
  isValidName,
  mayDeleteDocument,
  sortFolders,
  suggestedName,
  type FolderColor,
} from "@/lib/document-view"
import {
  openDocument,
  useCreateFolder,
  useDeleteDocument,
  useDeleteFolder,
  useDocumentFolders,
  useDocuments,
  useRenameDocument,
  useUpdateFolder,
  useUploadDocument,
  type FileFolder,
  type StoredFile,
} from "@/lib/documents"
import { formatFileSize } from "@/lib/format"
import { useHousehold, useMyUserId } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import type { PickedImage } from "@/lib/api/client"
import { cn } from "@/lib/utils"

const icons = {
  pdf: FileText,
  image: ImageIcon,
  text: FileText,
  other: FileIcon,
}

/** The folder sheet: a new folder, or an existing one to edit. */
type FolderSheet = { folder: FileFolder | null } | null

export default function Documents() {
  const { t } = useTranslation()
  const wide = useIsWide()
  const { household, ready } = useHousehold()
  const space = household?.id ?? null
  const userId = useMyUserId()
  const files = useDocuments(space)
  const folders = useDocumentFolders(space)
  const upload = useUploadDocument(space)
  const rename = useRenameDocument(space)
  const remove = useDeleteDocument(space)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [selected, setSelected] = useState<StoredFile | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [picked, setPicked] = useState<PickedImage | null>(null)
  const [uploadName, setUploadName] = useState("")
  const [uploadFolder, setUploadFolder] = useState<string | null>(null)
  const [folderSheet, setFolderSheet] = useState<FolderSheet>(null)
  const [message, setMessage] = useState<string | null>(null)

  const allFolders = sortFolders(folders.data ?? [])
  // A folder that is gone (deleted, or another space) shows the root again.
  const current = allFolders.find((folder) => folder.id === folderId) ?? null
  const visibleFiles = filesInFolder(files.data ?? [], current?.id ?? null)
  const isPending = files.isPending || folders.isPending
  const error = files.error ?? folders.error

  async function pick() {
    setMessage(null)
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    })
    const asset = result.canceled ? undefined : result.assets[0]
    if (!asset) return
    setPicked({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      file: asset.file,
    })
    setUploadName(suggestedName(asset.name))
    setUploadFolder(current?.id ?? null)
  }

  function confirmUpload() {
    if (!picked || !isValidName(uploadName)) return
    upload.mutate(
      { file: picked, name: uploadName, folderId: uploadFolder },
      {
        onSuccess: () => setPicked(null),
        onError: (e) => {
          setPicked(null)
          setMessage(e.message)
        },
      }
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

  function closeFile() {
    setSelected(null)
    setRenaming(null)
  }

  function saveRename() {
    if (!selected || renaming === null || !isValidName(renaming)) return
    rename.mutate(
      { fileId: selected.id, name: renaming },
      {
        onSuccess: closeFile,
        onError: (e) => {
          closeFile()
          setMessage(e.message)
        },
      }
    )
  }

  const empty = allFolders.length === 0 && (files.data ?? []).length === 0

  return (
    <Screen
      title={current?.name ?? t("documents:title")}
      subtitle={
        household
          ? t("documents:sharedWith", { name: household.name })
          : t("documents:ownDocuments")
      }
      narrow
      toolbar={!wide && <SpaceSwitcher />}
      actions={
        <View className="flex-row gap-2">
          {!current && (
            <Button
              size={wide ? "sm" : "icon"}
              variant="outline"
              icon={FolderPlus}
              label={t("documents:newFolder")}
              disabled={!ready}
              onPress={() => setFolderSheet({ folder: null })}
            />
          )}
          <Button
            size={wide ? "sm" : "icon"}
            icon={Plus}
            label={t("documents:upload")}
            disabled={!ready || upload.isPending}
            onPress={() => void pick()}
          />
        </View>
      }
    >
      {current && (
        <View className="flex-row items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronLeft}
            label={t("documents:allDocuments")}
            onPress={() => setFolderId(null)}
          />
          <Button
            variant="outline"
            size="sm"
            icon={Pencil}
            label={t("documents:editFolder")}
            onPress={() => setFolderSheet({ folder: current })}
          />
        </View>
      )}
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
          onRetry={() => {
            void files.refetch()
            void folders.refetch()
          }}
        />
      )}
      {!isPending && !error && empty && (
        <EmptyState
          icon={FileText}
          title={t("documents:empty.title")}
          message={t("documents:empty.message")}
          action={t("documents:upload")}
          onAction={() => void pick()}
        />
      )}
      {!isPending && !error && !current && allFolders.length > 0 && (
        <View className="overflow-hidden rounded-lg border border-border bg-card">
          {allFolders.map((folder, index) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              first={index === 0}
              count={filesInFolder(files.data ?? [], folder.id).length}
              onPress={() => setFolderId(folder.id)}
            />
          ))}
        </View>
      )}
      {!isPending && !error && current && visibleFiles.length === 0 && (
        <EmptyState
          icon={FolderIcon}
          title={t("documents:emptyFolder.title")}
          message={t("documents:emptyFolder.message")}
          action={t("documents:upload")}
          onAction={() => void pick()}
        />
      )}
      {visibleFiles.length > 0 && (
        <View className="overflow-hidden rounded-lg border border-border bg-card">
          {visibleFiles.map((file, index) => (
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
        onClose={closeFile}
        title={selected?.name ?? ""}
      >
        {selected && (
          <>
            <Text className="text-sm text-muted-foreground">
              {formatFileSize(selected.sizeBytes)}
            </Text>
            {renaming !== null ? (
              <>
                <Input
                  label={t("documents:nameLabel")}
                  value={renaming}
                  onChangeText={setRenaming}
                  autoFocus
                  maxLength={200}
                  returnKeyType="done"
                  onSubmitEditing={saveRename}
                />
                <View className="flex-row gap-3">
                  <Button
                    variant="outline"
                    label={t("documents:cancel")}
                    className="flex-1"
                    onPress={() => setRenaming(null)}
                  />
                  <Button
                    label={t("documents:save")}
                    className="flex-1"
                    disabled={!isValidName(renaming) || rename.isPending}
                    onPress={saveRename}
                  />
                </View>
              </>
            ) : (
              <>
                {mayDeleteDocument(selected, userId ?? "", household?.role) && (
                  <Button
                    variant="outline"
                    icon={Pencil}
                    label={t("documents:rename")}
                    onPress={() => setRenaming(selected.name)}
                  />
                )}
                <View className="flex-row gap-3">
                  {mayDeleteDocument(
                    selected,
                    userId ?? "",
                    household?.role
                  ) && (
                    <Button
                      variant="outline"
                      label={t("documents:delete")}
                      className="flex-1"
                      disabled={remove.isPending}
                      onPress={() =>
                        remove.mutate(selected.id, {
                          onSuccess: closeFile,
                          onError: (e) => {
                            closeFile()
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
                      closeFile()
                    }}
                  />
                </View>
              </>
            )}
          </>
        )}
      </Sheet>

      <Sheet
        open={picked !== null}
        onClose={() => setPicked(null)}
        title={t("documents:uploadTitle")}
      >
        <Input
          label={t("documents:nameLabel")}
          value={uploadName}
          onChangeText={setUploadName}
          autoFocus
          maxLength={200}
          returnKeyType="done"
          onSubmitEditing={confirmUpload}
        />
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">
            {t("documents:folderLabel")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t("documents:noFolder")}
              selected={uploadFolder === null}
              onPress={() => setUploadFolder(null)}
            />
            {allFolders.map((folder) => (
              <Chip
                key={folder.id}
                label={folder.name}
                selected={uploadFolder === folder.id}
                onPress={() => setUploadFolder(folder.id)}
              />
            ))}
          </View>
        </View>
        <View className="flex-row gap-3">
          <Button
            variant="outline"
            label={t("documents:cancel")}
            className="flex-1"
            onPress={() => setPicked(null)}
          />
          <Button
            label={t("documents:upload")}
            className="flex-1"
            disabled={!isValidName(uploadName) || upload.isPending}
            onPress={confirmUpload}
          />
        </View>
      </Sheet>

      <FolderEditor
        key={folderSheet?.folder?.id ?? (folderSheet ? "new" : "closed")}
        space={space}
        state={folderSheet}
        mayManage={
          !folderSheet?.folder ||
          mayDeleteDocument(
            {
              uploadedBy: folderSheet.folder.createdBy,
              householdId: folderSheet.folder.householdId,
            },
            userId ?? "",
            household?.role
          )
        }
        onClose={() => setFolderSheet(null)}
        onDeleted={() => setFolderId(null)}
        onError={setMessage}
      />
    </Screen>
  )
}

/** The dialog to make a folder, or to rename, recolour and delete one. */
function FolderEditor({
  space,
  state,
  mayManage,
  onClose,
  onDeleted,
  onError,
}: {
  space: string | null
  state: FolderSheet
  mayManage: boolean
  onClose: () => void
  onDeleted: () => void
  onError: (message: string) => void
}) {
  const { t } = useTranslation()
  const folder = state?.folder ?? null
  const create = useCreateFolder(space)
  const update = useUpdateFolder(space)
  const remove = useDeleteFolder(space)
  const [name, setName] = useState(folder?.name ?? "")
  const [color, setColor] = useState<FolderColor | null>(folder?.color ?? null)
  const [confirming, setConfirming] = useState(false)
  const busy = create.isPending || update.isPending || remove.isPending

  function fail(e: Error) {
    onClose()
    onError(e.message)
  }

  function save() {
    if (!isValidName(name)) return
    if (folder) {
      update.mutate(
        { folderId: folder.id, name, color },
        { onSuccess: onClose, onError: fail }
      )
    } else {
      create.mutate({ name, color }, { onSuccess: onClose, onError: fail })
    }
  }

  return (
    <Sheet
      open={state !== null}
      onClose={onClose}
      title={folder ? t("documents:editFolder") : t("documents:newFolder")}
    >
      {confirming && folder ? (
        <>
          <Text className="text-base text-foreground">
            {t("documents:deleteFolderConfirm", { name: folder.name })}
          </Text>
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              label={t("documents:cancel")}
              className="flex-1"
              onPress={() => setConfirming(false)}
            />
            <Button
              variant="destructive"
              label={t("documents:deleteFolder")}
              className="flex-1"
              disabled={busy}
              onPress={() =>
                remove.mutate(folder.id, {
                  onSuccess: () => {
                    onDeleted()
                    onClose()
                  },
                  onError: fail,
                })
              }
            />
          </View>
        </>
      ) : mayManage ? (
        <>
          <Input
            label={t("documents:folderName")}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={200}
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-foreground">
              {t("documents:colorLabel")}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              <ColorDot
                color={null}
                selected={color === null}
                label={t("documents:color.none")}
                onPress={() => setColor(null)}
              />
              {folderColors.map((option) => (
                <ColorDot
                  key={option}
                  color={option}
                  selected={color === option}
                  label={t(`documents:color.${option}`)}
                  onPress={() => setColor(option)}
                />
              ))}
            </View>
          </View>
          <View className="flex-row gap-3">
            {folder && (
              <Button
                variant="outline"
                label={t("documents:deleteFolder")}
                className="flex-1"
                disabled={busy}
                onPress={() => setConfirming(true)}
              />
            )}
            <Button
              label={t("documents:save")}
              className="flex-1"
              disabled={!isValidName(name) || busy}
              onPress={save}
            />
          </View>
        </>
      ) : (
        <Text className="text-base text-muted-foreground">
          {t("documents:folderNotAllowed")}
        </Text>
      )}
    </Sheet>
  )
}

function ColorDot({
  color,
  selected,
  label,
  onPress,
}: {
  color: FolderColor | null
  selected: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      onPress={onPress}
      className={cn(
        "size-11 items-center justify-center rounded-full border-2",
        selected ? "border-primary" : "border-border",
        color ? folderToneClasses[color].background : "bg-card"
      )}
    >
      {color === null && (
        <Icon as={FolderIcon} className="text-muted-foreground" size={18} />
      )}
    </Pressable>
  )
}

function FolderRow({
  folder,
  first,
  count,
  onPress,
}: {
  folder: FileFolder
  first: boolean
  count: number
  onPress: () => void
}) {
  const { t } = useTranslation()
  const tone = folder.color ? folderToneClasses[folder.color] : null
  return (
    <Pressable
      role="button"
      accessibilityLabel={t("documents:openFolder", { name: folder.name })}
      onPress={onPress}
      className={cn(
        "min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-accent web:hover:bg-accent",
        !first && "border-t border-border"
      )}
    >
      <View
        className={cn(
          "size-10 items-center justify-center rounded-md",
          tone ? tone.background : "bg-muted"
        )}
      >
        <Icon
          as={FolderIcon}
          className={tone ? tone.icon : "text-muted-foreground"}
        />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base text-foreground" numberOfLines={2}>
          {folder.name}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {t("documents:fileCount", { count })}
        </Text>
      </View>
    </Pressable>
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
