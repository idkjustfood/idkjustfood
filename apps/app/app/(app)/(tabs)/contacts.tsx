import { Mail, Phone, Plus, UserRound } from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Linking, Pressable, Text, TextInput, View } from "react-native"

import { phoneHref, searchContacts, type Contact } from "@workspace/schemas"

import { ListGroup, ListRow } from "@/components/list-row"
import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { EmptyState, ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { SearchField } from "@/components/ui/search-field"
import { Sheet } from "@/components/ui/sheet"
import { useContactActions, useContactState } from "@/lib/contacts"
import { useHousehold } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { inSpace } from "@/lib/space"
import { useTheme } from "@/lib/theme"

const emailOk = (value: string) => value === "" || /^[^\s@]+@[^\s@]+$/.test(value)

/** Contacts: craftspeople, doctors, school. Tap the phone to call, the letter to write. */
export default function Contacts() {
  const { t } = useTranslation("contacts")
  const wide = useIsWide()
  const { household, ready } = useHousehold()
  const { items: all, loaded, error, online, pending } = useContactState()
  const actions = useContactActions()
  const [query, setQuery] = useState("")
  // "new" is the form for a new contact, a contact is the form for editing it.
  const [form, setForm] = useState<Contact | "new" | null>(null)

  const contacts = inSpace(all, household?.id ?? null)
  const shown = searchContacts(contacts, query)

  return (
    <Screen
      title={t("title")}
      subtitle={
        household ? t("sharedWith", { name: household.name }) : t("ownContacts")
      }
      narrow
      toolbar={
        <View className="gap-3">
          {!wide && <SpaceSwitcher />}
          {contacts.length > 0 && (
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
          size="sm"
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
      {loaded && contacts.length === 0 && (
        <EmptyState
          icon={UserRound}
          title={t("empty.title")}
          message={t("empty.message")}
          action={t("add")}
          onAction={() => setForm("new")}
        />
      )}
      {loaded && contacts.length > 0 && shown.length === 0 && (
        <EmptyState
          icon={UserRound}
          title={t("noMatch.title")}
          message={t("noMatch.message")}
        />
      )}
      {shown.length > 0 && (
        <ListGroup>
          {shown.map((contact) => (
            <ListRow
              key={contact.id}
              icon={UserRound}
              title={contact.name}
              detail={[contact.role, contact.phone].filter(Boolean).join(" · ")}
              onPress={() => setForm(contact)}
              right={<ContactActions contact={contact} />}
            />
          ))}
        </ListGroup>
      )}

      <ContactForm
        // A new key resets the fields each time the form opens for another contact.
        key={form === null ? "closed" : form === "new" ? "new" : form.id}
        contact={form === "new" || form === null ? null : form}
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

/** Call and write buttons of a contact. Only shown for what is filled in. */
function ContactActions({ contact }: { contact: Contact }) {
  const { t } = useTranslation("contacts")
  const tel = phoneHref(contact.phone)
  const open = (url: string) => void Linking.openURL(url).catch(() => {})
  return (
    <View className="-my-3 -mr-4 flex-row">
      {tel && (
        <Pressable
          role="button"
          accessibilityLabel={t("call", { name: contact.name })}
          onPress={() => open(tel)}
          className="min-h-14 min-w-14 items-center justify-center active:bg-accent"
        >
          <Icon as={Phone} size={20} className="text-foreground" />
        </Pressable>
      )}
      {contact.email !== "" && (
        <Pressable
          role="button"
          accessibilityLabel={t("write", { name: contact.name })}
          onPress={() => open(`mailto:${contact.email}`)}
          className="min-h-14 min-w-14 items-center justify-center active:bg-accent"
        >
          <Icon as={Mail} size={20} className="text-foreground" />
        </Pressable>
      )}
    </View>
  )
}

type Fields = Pick<Contact, "name" | "role" | "phone" | "email" | "note">

function ContactForm({
  contact,
  open,
  onClose,
  onSave,
  onDelete,
  householdName,
  disabled,
}: {
  contact: Contact | null
  open: boolean
  onClose: () => void
  onSave: (fields: Fields) => void
  onDelete: () => void
  householdName?: string
  disabled: boolean
}) {
  const { t } = useTranslation("contacts")
  const { color } = useTheme()
  const [name, setName] = useState(contact?.name ?? "")
  const [role, setRole] = useState(contact?.role ?? "")
  const [phone, setPhone] = useState(contact?.phone ?? "")
  const [email, setEmail] = useState(contact?.email ?? "")
  const [note, setNote] = useState(contact?.note ?? "")
  const trimmed = name.trim()
  const valid = emailOk(email.trim())
  const save = () => {
    if (trimmed && valid && !disabled) {
      onSave({
        name: trimmed,
        role: role.trim(),
        phone: phone.trim(),
        email: email.trim(),
        note: note.trim(),
      })
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={contact ? t("form.editTitle") : t("form.newTitle")}
    >
      <Input
        label={t("form.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("form.namePlaceholder")}
        maxLength={200}
        autoFocus={!contact}
      />
      <Input
        label={t("form.role")}
        value={role}
        onChangeText={setRole}
        placeholder={t("form.rolePlaceholder")}
        maxLength={200}
      />
      <Input
        label={t("form.phone")}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        maxLength={50}
      />
      <View className="gap-1.5">
        <Input
          label={t("form.email")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          maxLength={200}
        />
        {!valid && (
          <Text role="alert" className="text-sm text-destructive">
            {t("form.emailInvalid")}
          </Text>
        )}
      </View>
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-foreground">
          {t("form.note")}
        </Text>
        <TextInput
          accessibilityLabel={t("form.note")}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={2000}
          placeholderTextColor={color("muted-foreground")}
          className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-base text-foreground"
        />
      </View>
      {!contact && (
        <Text className="text-sm text-muted-foreground">
          {householdName
            ? t("form.visibleHousehold", { name: householdName })
            : t("form.visiblePersonal")}
        </Text>
      )}
      <View className="flex-row gap-3">
        {contact && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={contact ? t("form.save") : t("form.create")}
          className="flex-1"
          disabled={!trimmed || !valid || disabled}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
