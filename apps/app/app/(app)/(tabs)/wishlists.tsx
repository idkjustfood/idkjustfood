import { ExternalLink, Gift, Pencil, Plus, UserRound } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Linking, Pressable, Text, TextInput, View } from "react-native"

import {
  openWishesFirst,
  searchWishes,
  type Wish,
  type WishPerson,
} from "@workspace/schemas"

import { ListGroup, ListRow } from "@/components/list-row"
import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { CheckboxBox } from "@/components/ui/checkbox"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import { Sheet } from "@/components/ui/sheet"
import { useHousehold } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { inSpace } from "@/lib/space"
import { useTheme } from "@/lib/theme"
import {
  useWishActions,
  useWishPersonActions,
  useWishPersonState,
  useWishState,
} from "@/lib/wishlists"

const linkOk = (value: string) => value === "" || /^https?:\/\/\S+$/i.test(value)

/** Which form is open: a new or existing wish (with the person it starts under), or a person. */
type Form =
  | { kind: "wish"; wish: Wish | null; personId: string | null }
  | { kind: "person"; person: WishPerson | null }

/**
 * Wishlists: wishes grouped per person. Wishes without a person sit at the root, on top.
 * Personal or shared with a household.
 */
export default function Wishlists() {
  const { t } = useTranslation("wishlists")
  const wide = useIsWide()
  const { household, ready } = useHousehold()
  const space = household?.id ?? null
  const peopleState = useWishPersonState()
  const wishState = useWishState()
  const personActions = useWishPersonActions()
  const wishActions = useWishActions()
  const [query, setQuery] = useState("")
  const [form, setForm] = useState<Form | null>(null)

  const loaded = peopleState.loaded && wishState.loaded
  const error = peopleState.error ?? wishState.error
  const online = peopleState.online && wishState.online
  const pending = peopleState.pending + wishState.pending

  const people = inSpace(peopleState.items, space).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  const wishes = inSpace(wishState.items, space)
  const searching = query.trim() !== ""
  const shown = searchWishes(wishes, query)
  const rootWishes = openWishesFirst(shown.filter((w) => w.personId === null))
  const groups = people
    .map((person) => ({
      person,
      wishes: openWishesFirst(shown.filter((w) => w.personId === person.id)),
    }))
    // While searching, only the people with a match are shown.
    .filter((group) => !searching || group.wishes.length > 0)

  const empty = people.length === 0 && wishes.length === 0
  const nothingFound = searching && rootWishes.length === 0 && groups.length === 0

  const sync = () => {
    void personActions.sync()
    void wishActions.sync()
  }

  return (
    <Screen
      title={t("title")}
      subtitle={
        household ? t("sharedWith", { name: household.name }) : t("ownWishes")
      }
      narrow
      toolbar={
        <View className="gap-3">
          {!wide && <SpaceSwitcher />}
          {!empty && (
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t("search")}
            />
          )}
        </View>
      }
      actions={
        <View className="flex-row gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={UserRound}
            label={t("addPerson")}
            onPress={() => setForm({ kind: "person", person: null })}
          />
          <Button
            size="sm"
            icon={Plus}
            label={t("addWish")}
            onPress={() => setForm({ kind: "wish", wish: null, personId: null })}
          />
        </View>
      }
    >
      <OfflineBanner online={online} pending={pending} />
      {!loaded && !error && <LoadingState label={t("loading")} rows={3} />}
      {!loaded && error && (
        <ErrorState
          title={t("loadError.title")}
          message={t("loadError.message")}
          onRetry={sync}
        />
      )}
      {loaded && empty && (
        <EmptyState
          icon={Gift}
          title={t("empty.title")}
          message={t("empty.message")}
          action={t("addWish")}
          onAction={() => setForm({ kind: "wish", wish: null, personId: null })}
        />
      )}
      {loaded && !empty && nothingFound && (
        <EmptyState
          icon={Gift}
          title={t("noMatch.title")}
          message={t("noMatch.message")}
        />
      )}

      {rootWishes.length > 0 && (
        <ListGroup title={t("general")}>
          {rootWishes.map((wish) => (
            <WishRow
              key={wish.id}
              wish={wish}
              onOpen={() => setForm({ kind: "wish", wish, personId: wish.personId })}
              onToggle={() => wishActions.edit(wish.id, { done: !wish.done })}
            />
          ))}
        </ListGroup>
      )}

      {groups.map(({ person, wishes: personWishes }) => (
        <View key={person.id} className="gap-2">
          <PersonHeader
            person={person}
            onEdit={() => setForm({ kind: "person", person })}
            onAdd={() =>
              setForm({ kind: "wish", wish: null, personId: person.id })
            }
          />
          {personWishes.length > 0 ? (
            <ListGroup>
              {personWishes.map((wish) => (
                <WishRow
                  key={wish.id}
                  wish={wish}
                  onOpen={() =>
                    setForm({ kind: "wish", wish, personId: wish.personId })
                  }
                  onToggle={() => wishActions.edit(wish.id, { done: !wish.done })}
                />
              ))}
            </ListGroup>
          ) : (
            <Text className="px-1 text-sm text-muted-foreground">
              {t("personEmpty")}
            </Text>
          )}
        </View>
      ))}

      <WishForm
        // A new key resets the fields each time the form opens for something else.
        key={
          form?.kind === "wish"
            ? `wish-${form.wish?.id ?? "new"}-${form.personId ?? "root"}`
            : "closed"
        }
        open={form?.kind === "wish"}
        wish={form?.kind === "wish" ? form.wish : null}
        startPersonId={form?.kind === "wish" ? form.personId : null}
        people={people}
        householdName={household?.name}
        disabled={!ready}
        onClose={() => setForm(null)}
        onSave={(fields) => {
          if (form?.kind === "wish" && form.wish) {
            wishActions.edit(form.wish.id, fields)
          } else {
            wishActions.add({ ...fields, done: false }, space)
          }
          setForm(null)
        }}
        onDelete={() => {
          if (form?.kind === "wish" && form.wish) wishActions.remove(form.wish.id)
          setForm(null)
        }}
      />
      <PersonForm
        key={
          form?.kind === "person" ? `person-${form.person?.id ?? "new"}` : "closed"
        }
        open={form?.kind === "person"}
        person={form?.kind === "person" ? form.person : null}
        wishCount={
          form?.kind === "person" && form.person
            ? wishes.filter((w) => w.personId === form.person?.id).length
            : 0
        }
        householdName={household?.name}
        disabled={!ready}
        onClose={() => setForm(null)}
        onSave={(name) => {
          if (form?.kind === "person" && form.person) {
            personActions.edit(form.person.id, { name })
          } else {
            personActions.add({ name }, space)
          }
          setForm(null)
        }}
        onDelete={() => {
          if (form?.kind === "person" && form.person) {
            // The server deletes the wishes with the person; do the same here at once.
            for (const wish of wishes) {
              if (wish.personId === form.person.id) wishActions.remove(wish.id)
            }
            personActions.remove(form.person.id)
          }
          setForm(null)
        }}
      />
    </Screen>
  )
}

function PersonHeader({
  person,
  onEdit,
  onAdd,
}: {
  person: WishPerson
  onEdit: () => void
  onAdd: () => void
}) {
  const { t } = useTranslation("wishlists")
  return (
    <View className="min-h-12 flex-row items-center gap-1 px-1">
      <Icon as={UserRound} className="text-muted-foreground" />
      <Text
        className="flex-1 px-2 text-lg font-semibold text-foreground"
        numberOfLines={1}
      >
        {person.name}
      </Text>
      <Pressable
        role="button"
        accessibilityLabel={t("editPerson", { name: person.name })}
        onPress={onEdit}
        className="h-12 w-12 items-center justify-center rounded-md active:bg-accent"
      >
        <Icon as={Pencil} size={20} className="text-foreground" />
      </Pressable>
      <Pressable
        role="button"
        accessibilityLabel={t("addWishFor", { name: person.name })}
        onPress={onAdd}
        className="h-12 w-12 items-center justify-center rounded-md active:bg-accent"
      >
        <Icon as={Plus} size={22} className="text-foreground" />
      </Pressable>
    </View>
  )
}

function WishRow({
  wish,
  onOpen,
  onToggle,
}: {
  wish: Wish
  onOpen: () => void
  onToggle: () => void
}) {
  const { t } = useTranslation("wishlists")
  const open = () => void Linking.openURL(wish.link).catch(() => {})
  return (
    <ListRow
      leading={
        <Pressable
          role="checkbox"
          aria-checked={wish.done}
          accessibilityLabel={t(wish.done ? "markOpen" : "markGot", {
            title: wish.title,
          })}
          onPress={onToggle}
          className="-my-3 -ml-4 h-14 w-14 items-center justify-center"
        >
          <CheckboxBox checked={wish.done} />
        </Pressable>
      }
      title={wish.title}
      detail={wish.done ? t("gotLabel") : wish.note || undefined}
      onPress={onOpen}
      right={
        wish.link !== "" ? (
          <Pressable
            role="button"
            accessibilityLabel={t("openLink", { title: wish.title })}
            onPress={open}
            className="-my-3 -mr-4 min-h-14 min-w-14 items-center justify-center active:bg-accent"
          >
            <Icon as={ExternalLink} size={20} className="text-foreground" />
          </Pressable>
        ) : undefined
      }
    />
  )
}

type WishFields = Pick<Wish, "title" | "note" | "link" | "personId">

function WishForm({
  open,
  wish,
  startPersonId,
  people,
  householdName,
  disabled,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  wish: Wish | null
  startPersonId: string | null
  people: WishPerson[]
  householdName?: string
  disabled: boolean
  onClose: () => void
  onSave: (fields: WishFields) => void
  onDelete: () => void
}) {
  const { t } = useTranslation("wishlists")
  const { color } = useTheme()
  const [title, setTitle] = useState(wish?.title ?? "")
  const [note, setNote] = useState(wish?.note ?? "")
  const [link, setLink] = useState(wish?.link ?? "")
  const [personId, setPersonId] = useState<string | null>(startPersonId)
  const trimmed = title.trim()
  const valid = linkOk(link.trim())

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={wish ? t("wish.editTitle") : t("wish.newTitle")}
    >
      <Input
        label={t("wish.title")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("wish.titlePlaceholder")}
        maxLength={300}
        autoFocus={!wish}
      />
      {people.length > 0 && (
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">
            {t("wish.for")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t("wish.nobody")}
              selected={personId === null}
              onPress={() => setPersonId(null)}
            />
            {people.map((person) => (
              <Chip
                key={person.id}
                label={person.name}
                selected={personId === person.id}
                onPress={() => setPersonId(person.id)}
              />
            ))}
          </View>
        </View>
      )}
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">
          {t("wish.note")}
        </Text>
        <TextInput
          accessibilityLabel={t("wish.note")}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={2000}
          placeholderTextColor={color("muted-foreground")}
          className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground"
        />
      </View>
      <View className="gap-1.5">
        <Input
          label={t("wish.link")}
          value={link}
          onChangeText={setLink}
          placeholder={t("wish.linkPlaceholder")}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={2000}
        />
        {!valid && (
          <Text role="alert" className="text-sm text-destructive">
            {t("wish.linkInvalid")}
          </Text>
        )}
      </View>
      {!wish && (
        <Text className="text-sm text-muted-foreground">
          {householdName
            ? t("wish.visibleHousehold", { name: householdName })
            : t("wish.visiblePersonal")}
        </Text>
      )}
      <View className="flex-row gap-3">
        {wish && (
          <Button
            variant="outline"
            label={t("wish.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={wish ? t("wish.save") : t("wish.create")}
          className="flex-1"
          disabled={!trimmed || !valid || disabled}
          onPress={() =>
            onSave({ title: trimmed, note: note.trim(), link: link.trim(), personId })
          }
        />
      </View>
    </Sheet>
  )
}

function PersonForm({
  open,
  person,
  wishCount,
  householdName,
  disabled,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  person: WishPerson | null
  wishCount: number
  householdName?: string
  disabled: boolean
  onClose: () => void
  onSave: (name: string) => void
  onDelete: () => void
}) {
  const { t } = useTranslation("wishlists")
  const [name, setName] = useState(person?.name ?? "")
  const trimmed = name.trim()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={person ? t("person.editTitle") : t("person.newTitle")}
    >
      <Input
        label={t("person.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("person.namePlaceholder")}
        maxLength={200}
        autoFocus={!person}
      />
      {!person && (
        <Text className="text-sm text-muted-foreground">
          {householdName
            ? t("person.visibleHousehold", { name: householdName })
            : t("person.visiblePersonal")}
        </Text>
      )}
      {person && wishCount > 0 && (
        <Text className="text-sm text-muted-foreground">
          {t("person.deleteWarning", { name: person.name, count: wishCount })}
        </Text>
      )}
      <View className="flex-row gap-3">
        {person && (
          <Button
            variant="outline"
            label={t("person.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={person ? t("person.save") : t("person.create")}
          className="flex-1"
          disabled={!trimmed || disabled}
          onPress={() => onSave(trimmed)}
        />
      </View>
    </Sheet>
  )
}
