import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  User,
  Users,
} from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, Text, View } from "react-native"

import {
  addDays,
  addMonths,
  calendarColors,
  entriesByDate,
  entriesOn,
  monthGrid,
  monthOf,
  todayString,
  type CalendarColor,
  type CalendarEntry,
} from "@workspace/schemas"

import { CalendarSwatch } from "@/components/calendar-swatch"
import { OfflineBanner } from "@/components/offline-banner"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { ErrorState, LoadingState } from "@/components/states"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Sheet } from "@/components/ui/sheet"
import { useCalendarActions, useCalendarState } from "@/lib/calendar"
import { calendarTone } from "@/lib/calendar-colors"
import {
  dayNumber,
  longDayLabel,
  monthLabel,
  weekdayLabels,
} from "@/lib/calendar-format"
import { useToday } from "@/lib/chores"
import { formatNumber } from "@/lib/format"
import { useHousehold, useHouseholds } from "@/lib/households"
import { useIsWide } from "@/lib/layout"
import { cn } from "@/lib/utils"

/** The most colour dots shown under a day. More entries still count, they just do not fit. */
const MAX_DOTS = 3

/**
 * The calendar: a month, a list of the entries of the selected day, and a form to add or change
 * one. Personal entries and the entries of all households are shown together; every entry says
 * which of them it is. A new entry is for the selected space (personal or one household) unless
 * the person chooses another in the form.
 */
export default function Calendar() {
  const { t } = useTranslation("calendar")
  const wide = useIsWide()
  const today = useToday()
  const { household } = useHousehold()
  const { households } = useHouseholds()
  const { entries, loaded, error, online, pending } = useCalendarState()
  const actions = useCalendarActions()

  const [month, setMonth] = useState(() => monthOf(todayString()))
  const [selected, setSelected] = useState(() => todayString())
  // "new" is the form for a new entry, an entry is the form for changing it.
  const [form, setForm] = useState<CalendarEntry | "new" | null>(null)

  const byDate = entriesByDate(entries)
  const dayEntries = entriesOn(entries, selected)
  const nameOf = (id: string | null) =>
    id ? (households.find((h) => h.id === id)?.name ?? t("household")) : null

  const showMonth = (next: string) => {
    setMonth(next)
    // Keep the same day number in the new month, or its last day when the month is shorter.
    const last = addDays(`${addMonths(next, 1)}-01`, -1)
    const day = Math.min(Number(selected.slice(8, 10)), Number(last.slice(8, 10)))
    setSelected(`${next}-${String(day).padStart(2, "0")}`)
  }
  const goToday = () => {
    setMonth(monthOf(today))
    setSelected(today)
  }

  return (
    <Screen
      title={t("title")}
      subtitle={t("subtitle")}
      narrow
      toolbar={!wide && <SpaceSwitcher />}
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
      {loaded && (
        <>
          <View className="flex-row items-center gap-2">
            <Pressable
              role="button"
              accessibilityLabel={t("previousMonth")}
              onPress={() => showMonth(addMonths(month, -1))}
              className="h-12 w-12 items-center justify-center rounded-md border border-border bg-card active:bg-accent"
            >
              <Icon as={ChevronLeft} className="text-foreground" />
            </Pressable>
            <Text
              role="heading"
              aria-live="polite"
              className="flex-1 text-center text-lg font-semibold text-foreground"
            >
              {monthLabel(month)}
            </Text>
            <Pressable
              role="button"
              accessibilityLabel={t("nextMonth")}
              onPress={() => showMonth(addMonths(month, 1))}
              className="h-12 w-12 items-center justify-center rounded-md border border-border bg-card active:bg-accent"
            >
              <Icon as={ChevronRight} className="text-foreground" />
            </Pressable>
          </View>
          <View className="flex-row justify-center">
            <Button
              size="sm"
              variant="outline"
              label={t("goToToday")}
              disabled={month === monthOf(today) && selected === today}
              onPress={goToday}
            />
          </View>

          <View className="gap-1">
            <View className="flex-row">
              {weekdayLabels().map((label, i) => (
                <Text
                  key={i}
                  className="flex-1 py-1 text-center text-xs font-medium text-muted-foreground"
                >
                  {label}
                </Text>
              ))}
            </View>
            {monthGrid(month).map((week) => (
              <View key={week[0]!.date} className="flex-row gap-1">
                {week.map(({ date, inMonth }) => (
                  <DayCell
                    key={date}
                    date={date}
                    inMonth={inMonth}
                    isToday={date === today}
                    isSelected={date === selected}
                    entries={byDate.get(date) ?? []}
                    onPress={() => {
                      setSelected(date)
                      if (!inMonth) setMonth(monthOf(date))
                    }}
                  />
                ))}
              </View>
            ))}
          </View>

          <View className="gap-2">
            <Text
              role="heading"
              className="text-base font-semibold text-foreground"
            >
              {longDayLabel(selected)}
            </Text>
            {dayEntries.length === 0 ? (
              <Text className="text-muted-foreground">{t("noEntries")}</Text>
            ) : (
              dayEntries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  owner={nameOf(entry.householdId)}
                  onPress={() => setForm(entry)}
                />
              ))
            )}
            <Button
              variant="outline"
              icon={Plus}
              label={t("addOnDay", { day: longDayLabel(selected) })}
              onPress={() => setForm("new")}
            />
          </View>
        </>
      )}

      <EntryForm
        // A new key resets the fields each time the form opens for another entry.
        key={form === null ? "closed" : form === "new" ? `new-${selected}` : form.id}
        entry={form === "new" || form === null ? null : form}
        open={form !== null}
        day={selected}
        households={households}
        defaultHouseholdId={household?.id ?? null}
        ownerName={
          form && form !== "new" ? nameOf(form.householdId) : null
        }
        onClose={() => setForm(null)}
        onSave={(values, householdId) => {
          if (form && form !== "new") actions.edit(form.id, values)
          else actions.add(values, householdId)
          // Show the day the entry is on.
          setSelected(values.date)
          setMonth(monthOf(values.date))
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

/** One day of the month grid: the number, and a dot in the colour of each entry. */
function DayCell({
  date,
  inMonth,
  isToday,
  isSelected,
  entries,
  onPress,
}: {
  date: string
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  entries: CalendarEntry[]
  onPress: () => void
}) {
  const { t } = useTranslation("calendar")
  return (
    <Pressable
      role="button"
      aria-pressed={isSelected}
      accessibilityLabel={`${longDayLabel(date)}${
        entries.length > 0 ? `, ${t("entryCount", { count: entries.length })}` : ""
      }`}
      onPress={onPress}
      className={cn(
        "min-h-14 flex-1 items-center gap-1 rounded-md border py-1.5 active:bg-accent",
        isSelected ? "border-primary bg-accent" : "border-transparent",
        isToday && !isSelected && "border-border"
      )}
    >
      <View
        className={cn(
          "h-7 min-w-7 items-center justify-center rounded-full px-1",
          isToday && "bg-primary"
        )}
      >
        <Text
          className={cn(
            "text-sm",
            isToday
              ? "font-semibold text-primary-foreground"
              : inMonth
                ? "text-foreground"
                : "text-muted-foreground/60"
          )}
        >
          {formatNumber(dayNumber(date))}
        </Text>
      </View>
      <View className="h-2 flex-row gap-0.5">
        {entries.slice(0, MAX_DOTS).map((entry) => (
          <View
            key={entry.id}
            className={cn(
              "h-2 w-2 rounded-full border",
              calendarTone[entry.color].bg,
              calendarTone[entry.color].border
            )}
          />
        ))}
      </View>
    </Pressable>
  )
}

/** An entry of the selected day: its colour, title and whether it is personal or a household's. */
function EntryRow({
  entry,
  owner,
  onPress,
}: {
  entry: CalendarEntry
  owner: string | null
  onPress: () => void
}) {
  const { t } = useTranslation("calendar")
  return (
    <Pressable
      role="button"
      accessibilityLabel={t("edit", { title: entry.title })}
      onPress={onPress}
      className="min-h-16 flex-row items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 active:bg-accent"
    >
      <CalendarSwatch color={entry.color} />
      <View className="flex-1 gap-0.5">
        <Text className="text-base text-foreground">{entry.title}</Text>
        <View className="flex-row items-center gap-1">
          <Icon
            as={owner ? Users : User}
            size={14}
            className="text-muted-foreground"
          />
          <Text className="text-sm text-muted-foreground">
            {owner ?? t("personal")}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

type Values = { title: string; color: CalendarColor; date: string }

function EntryForm({
  entry,
  open,
  day,
  households,
  defaultHouseholdId,
  ownerName,
  onClose,
  onSave,
  onDelete,
}: {
  entry: CalendarEntry | null
  open: boolean
  day: string
  households: { id: string; name: string }[]
  defaultHouseholdId: string | null
  /** The household name of an existing entry, or null when it is personal. */
  ownerName: string | null
  onClose: () => void
  onSave: (values: Values, householdId: string | null) => void
  onDelete: () => void
}) {
  const { t } = useTranslation("calendar")
  const [title, setTitle] = useState(entry?.title ?? "")
  const [color, setColor] = useState<CalendarColor>(entry?.color ?? "sky")
  const [date, setDate] = useState(entry?.date ?? day)
  const [householdId, setHouseholdId] = useState<string | null>(
    defaultHouseholdId
  )
  const trimmed = title.trim()
  const save = () => {
    if (trimmed) onSave({ title: trimmed, color, date }, householdId)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? t("form.editTitle") : t("form.newTitle")}
    >
      <Input
        label={t("form.title")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("form.placeholder")}
        maxLength={200}
        autoFocus={!entry}
        onSubmitEditing={save}
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("form.color")}
        </Text>
        <View role="radiogroup" accessibilityLabel={t("form.color")} className="flex-row flex-wrap gap-3">
          {calendarColors.map((name) => (
            <Pressable
              key={name}
              role="radio"
              aria-checked={name === color}
              accessibilityLabel={t(`colors.${name}`)}
              onPress={() => setColor(name)}
              className={cn(
                "h-12 w-12 items-center justify-center rounded-full border-2",
                calendarTone[name].bg,
                name === color
                  ? calendarTone[name].border
                  : "border-transparent"
              )}
            >
              {name === color && (
                <Icon
                  as={Check}
                  size={20}
                  strokeWidth={3}
                  className={calendarTone[name].text}
                />
              )}
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">
          {t("form.day")}
        </Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            role="button"
            accessibilityLabel={t("form.dayBefore")}
            onPress={() => setDate(addDays(date, -1))}
            className="h-12 w-12 items-center justify-center rounded-md border border-border bg-card active:bg-accent"
          >
            <Icon as={ChevronLeft} className="text-foreground" />
          </Pressable>
          <Text className="flex-1 text-center text-base text-foreground">
            {longDayLabel(date)}
          </Text>
          <Pressable
            role="button"
            accessibilityLabel={t("form.dayAfter")}
            onPress={() => setDate(addDays(date, 1))}
            className="h-12 w-12 items-center justify-center rounded-md border border-border bg-card active:bg-accent"
          >
            <Icon as={ChevronRight} className="text-foreground" />
          </Pressable>
        </View>
      </View>

      {entry ? (
        <Text className="text-sm text-muted-foreground">
          {ownerName
            ? t("form.visibleHousehold", { name: ownerName })
            : t("form.visiblePersonal")}
        </Text>
      ) : (
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">
            {t("form.for")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t("personal")}
              selected={householdId === null}
              onPress={() => setHouseholdId(null)}
            />
            {households.map((h) => (
              <Chip
                key={h.id}
                label={h.name}
                selected={householdId === h.id}
                onPress={() => setHouseholdId(h.id)}
              />
            ))}
          </View>
          <Text className="text-sm text-muted-foreground">
            {householdId
              ? t("form.visibleHousehold", {
                  name:
                    households.find((h) => h.id === householdId)?.name ??
                    t("household"),
                })
              : t("form.visiblePersonal")}
          </Text>
        </View>
      )}

      <View className="flex-row gap-3">
        {entry && (
          <Button
            variant="outline"
            label={t("form.delete")}
            className="flex-1"
            onPress={onDelete}
          />
        )}
        <Button
          label={entry ? t("form.save") : t("form.create")}
          className="flex-1"
          disabled={!trimmed}
          onPress={save}
        />
      </View>
    </Sheet>
  )
}
