import { Plus, StickyNote } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Text, TextInput, View } from "react-native"

import { noteHeading, searchNotes, type Note } from "@workspace/schemas"

import { ListGroup, ListRow } from "@/components/list-row"
import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import { Sheet } from "@/components/ui/sheet"
import { useHousehold } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { useNoteActions, useNoteState } from "@/lib/notes"
import { inSpace } from "@/lib/space"
import { useTheme } from "@/lib/theme"

/** Notes: plain text, newest first. Personal or shared with a household. */
export default function Notes() {
  const { t } = useTranslation("notes")
  const wide = useIsWide()
  const { household, ready } = useHousehold()
  const { items: all, loaded, error, online, pending } = useNoteState()
  const actions = useNoteActions()
  const [query, setQuery] = useState("")
  // "new" is the form for a new note, a note is the form for editing it.
  const [form, setForm] = useState<Note | "new" | null>(null)

  const notes = inSpace(all, household?.id ?? null).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
  const shown = searchNotes(notes, query)

  return (
    <Screen
      title={t("title")}
      subtitle={
        household ? t("sharedWith", { name: household.name }) : t("ownNotes")
      }
      narrow
      toolbar={
        <View className="gap-3">
          {!wide && <SpaceSwitcher />}
          {notes.length > 0 && (
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t("search")}
            />
          )}
        </View>
      }
      actions={
        <Button
          size="header"
          icon={Plus}
          label={t("add")}
          onPress={() => setForm("new")}
        />
      }
    >
      <OfflineBanner online={online} pending={pending} />
      {!loaded && !error && <LoadingState label={t("loading")} rows={3} />}
      {!loaded && error && (
        <ErrorState
          title={t("loadError.title")}
          message={t("loadError.message")}
          onRetry={() => void actions.sync()}
        />
      )}
      {loaded && notes.length === 0 && (
        <EmptyState
          icon={StickyNote}
          title={t("empty.title")}
          message={t("empty.message")}
          action={t("add")}
          onAction={() => setForm("new")}
        />
      )}
      {loaded && notes.length > 0 && shown.length === 0 && (
        <EmptyState
          icon={StickyNote}
          title={t("noMatch.title")}
          message={t("noMatch.message")}
        />
      )}
      {shown.length > 0 && (
        <ListGroup>
          {shown.map((note) => (
            <ListRow
              key={note.id}
              icon={StickyNote}
              title={noteHeading(note) || t("untitled")}
              detail={preview(note)}
              onPress={() => setForm(note)}
            />
          ))}
        </ListGroup>
      )}

      <NoteForm
        // A new key resets the fields each time the form opens for another note.
        key={form === null ? "closed" : form === "new" ? "new" : form.id}
        note={form === "new" || form === null ? null : form}
        open={form !== null}
        onClose={() => setForm(null)}
        householdName={household?.name}
        disabled={!ready}
        onSave={(fields) => {
          if (form && form !== "new") actions.edit(form.id, fields)
          else actions.add(fields, household?.id ?? null)
          setForm(null)
        }}
        onDelete={() => {
          if (form && form !== "new") actions.remove(form.id)
          setForm(null)
        }}
      />
    </Screen>
  )
}

/** The text under the heading: the body, or the lines after the heading when it came from the body. */
function preview(note: Note) {
  const lines = note.body.split("\n").filter((line) => line.trim() !== "")
  const rest = note.title.trim() ? lines : lines.slice(1)
  return rest.join(" ").slice(0, 120) || undefined
}

type Fields = Pick<Note, "title" | "body">

function NoteForm({
  note,
  open,
  onClose,
  onSave,
  onDelete,
  householdName,
  disabled,
}: {
  note: Note | null
  open: boolean
  onClose: () => void
  onSave: (fields: Fields) => void
  onDelete: () => void
  householdName?: string
  disabled: boolean
}) {
  const { t } = useTranslation("notes")
  const { color } = useTheme()
  const [title, setTitle] = useState(note?.title ?? "")
  const [body, setBody] = useState(note?.body ?? "")
  // A note needs a title or some text.
  const filled = title.trim() !== "" || body.trim() !== ""
  const save = () => {
    if (filled && !disabled) onSave({ title: title.trim(), body })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={note ? t("form.editTitle") : t("form.newTitle")}
    >
      <Input
        label={t("form.title")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("form.titlePlaceholder")}
        maxLength={200}
        autoFocus={!note}
      />
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">
          {t("form.body")}
        </Text>
        <TextInput
          accessibilityLabel={t("form.body")}
          value={body}
          onChangeText={setBody}
          placeholder={t("form.bodyPlaceholder")}
          multiline
          maxLength={20000}
          placeholderTextColor={color("muted-foreground")}
          className="min-h-40 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground"
        />
      </View>
      {!note && (
        <Text className="text-sm text-muted-foreground">
          {householdName
            ? t("form.visibleHousehold", { name: householdName })
            : t("form.visiblePersonal")}
        </Text>
      )}
      <View className="flex-row gap-3">
        {note && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={note ? t("form.save") : t("form.create")}
          className="flex-1"
          disabled={!filled || disabled}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
