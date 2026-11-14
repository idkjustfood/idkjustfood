import { router } from "expo-router"
import {
  AudioLines,
  Check,
  CreditCard,
  Download,
  FileCode,
  FileJson,
  FileText,
  Code,
  Globe,
  Home,
  Languages,
  LogOut,
  Package,
  Server,
  Sparkles,
  Upload,
  User,
} from "lucide-react-native"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Switch, Text, View } from "react-native"

import { ListGroup, ListRow } from "@/components/list-row"
import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Segmented } from "@/components/ui/segmented"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { API_URL, authClient } from "@/lib/auth-client"
import { isCloud } from "@/lib/edition"
import { useHouseholds } from "@/lib/households"
import i18n, { supportedLanguages } from "@/lib/i18n"
import { aiProviders } from "@/lib/mock-data"

type Open = "language" | "export" | "import" | null

/** A language's own name, in that language. */
function languageName(code: string) {
  return i18n.getFixedT(code, "common")("languageName")
}

export default function Settings() {
  const { t } = useTranslation()
  const state = useAppState()
  const { data: session } = authClient.useSession()
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)
  const { households, isPending: householdPending } = useHouseholds()

  const name = state.demo
    ? t("settings:account.demoName")
    : (session?.user.name ?? t("settings:account.defaultName"))
  const email = state.demo
    ? t("settings:account.demoEmail")
    : session?.user.email

  return (
    <Screen title={t("settings:title")} narrow>
      <ListGroup title={t("settings:account.title")}>
        <ListRow icon={User} title={name} detail={email} />
        <ListRow
          icon={LogOut}
          title={
            state.demo
              ? t("settings:account.leaveDemo")
              : t("settings:account.logOut")
          }
          destructive
          onPress={() =>
            state.demo ? state.setDemo(false) : authClient.signOut()
          }
        />
      </ListGroup>

      <ListGroup title={t("settings:household.title")}>
        <ListRow
          icon={Home}
          title={
            households.length > 1
              ? t("settings:household.count", { count: households.length })
              : (households[0]?.name ??
                (householdPending
                  ? t("settings:household.title")
                  : t("settings:household.none")))
          }
          detail={
            households.length > 0
              ? t("settings:household.detailHas")
              : t("settings:household.detailNone")
          }
          onPress={() => router.push("/settings/household")}
        />
        <ListRow
          icon={Package}
          title={t("settings:pantry.title")}
          detail={t("settings:pantry.rowDetail")}
          onPress={() => router.push("/settings/pantry")}
        />
      </ListGroup>

      <ListGroup title={t("settings:preferences.title")}>
        <View className="gap-2 px-4 py-3">
          <Text className="text-base text-foreground">
            {t("settings:preferences.units")}
          </Text>
          <Segmented
            label={t("settings:preferences.units")}
            value={state.units}
            onChange={state.setUnits}
            options={[
              { value: "metric", label: t("settings:preferences.metric") },
              { value: "imperial", label: t("settings:preferences.imperial") },
            ]}
          />
        </View>
        <View className="gap-2 px-4 py-3">
          <Text className="text-base text-foreground">
            {t("settings:preferences.appearance")}
          </Text>
          <Segmented
            label={t("settings:preferences.appearance")}
            value={state.appearance}
            onChange={state.setAppearance}
            options={[
              { value: "system", label: t("settings:preferences.system") },
              { value: "light", label: t("settings:preferences.light") },
              { value: "dark", label: t("settings:preferences.dark") },
            ]}
          />
        </View>
        <ListRow
          icon={Languages}
          title={t("settings:preferences.language")}
          detail={
            state.language === "system"
              ? t("settings:language.system")
              : languageName(state.language)
          }
          onPress={() => setOpen("language")}
        />
      </ListGroup>

      <ListGroup title={t("settings:data.title")}>
        <ListRow
          icon={Download}
          title={t("settings:data.exportTitle")}
          detail={t("settings:data.exportDetail")}
          onPress={() => setOpen("export")}
        />
        <ListRow
          icon={Upload}
          title={t("settings:data.importTitle")}
          detail={t("settings:data.importDetail")}
          onPress={() => setOpen("import")}
        />
      </ListGroup>

      {isCloud ? (
        <ListGroup title={t("settings:plan.title")}>
          <ListRow
            icon={CreditCard}
            title={t("settings:plan.billing")}
            onPress={() => router.push("/billing")}
          />
        </ListGroup>
      ) : (
        <ListGroup title={t("settings:server.title")}>
          <ListRow icon={Server} title={t("settings:server.address")} detail={API_URL} />
          <ListRow
            icon={AudioLines}
            title={t("settings:server.transcription")}
            detail={`${aiProviders.transcription.provider} · ${aiProviders.transcription.model}`}
          />
          <ListRow
            icon={Sparkles}
            title={t("settings:server.parsing")}
            detail={`${aiProviders.parsing.provider} · ${aiProviders.parsing.model}`}
          />
          <View className="px-4 py-3">
            <Text className="text-sm text-muted-foreground">
              {t("settings:server.note")}
            </Text>
          </View>
        </ListGroup>
      )}

      <ListGroup title={t("settings:prototype.title")}>
        <View className="gap-2 px-4 py-3">
          <Text className="text-base text-foreground">
            {t("settings:prototype.listStateLabel")}
          </Text>
          <Segmented
            label={t("settings:prototype.listState")}
            value={state.listState}
            onChange={state.setListState}
            options={[
              { value: "ready", label: t("settings:prototype.normal") },
              { value: "loading", label: t("settings:prototype.loading") },
              { value: "empty", label: t("settings:prototype.empty") },
              { value: "error", label: t("settings:prototype.error") },
            ]}
          />
        </View>
        <ListRow
          title={t("settings:prototype.offline")}
          detail={t("settings:prototype.offlineDetail")}
          right={
            <Switch
              accessibilityLabel={t("settings:prototype.offline")}
              value={state.offline}
              onValueChange={state.setOffline}
            />
          }
        />
      </ListGroup>

      <ListGroup title={t("settings:about.title")}>
        <ListRow
          icon={Code}
          title={t("settings:about.openSource")}
          detail={t("settings:about.version", { version: "0.0.1" })}
        />
      </ListGroup>

      <Sheet
        open={open === "language"}
        onClose={close}
        title={t("settings:language.title")}
      >
        <ListGroup>
          {["system", ...supportedLanguages].map((code) => (
            <ListRow
              key={code}
              icon={Globe}
              title={
                code === "system"
                  ? t("settings:language.system")
                  : languageName(code)
              }
              right={
                state.language === code ? (
                  <Icon as={Check} className="text-primary" />
                ) : undefined
              }
              onPress={() => {
                state.setLanguage(code)
                close()
              }}
            />
          ))}
        </ListGroup>
        <Button
          variant="outline"
          label={t("settings:language.close")}
          onPress={close}
        />
      </Sheet>

      <Sheet
        open={open === "export"}
        onClose={close}
        title={t("settings:data.exportTitle")}
      >
        <ListGroup>
          <ListRow
            icon={FileJson}
            title={t("settings:data.json")}
            detail={t("settings:data.jsonDetail")}
            onPress={close}
          />
          <ListRow
            icon={FileText}
            title={t("settings:data.markdown")}
            detail={t("settings:data.markdownDetail")}
            onPress={close}
          />
          <ListRow
            icon={FileCode}
            title={t("settings:data.schema")}
            detail={t("settings:data.schemaDetail")}
            onPress={close}
          />
        </ListGroup>
        <Button variant="outline" label={t("settings:data.cancel")} onPress={close} />
      </Sheet>

      <Sheet
        open={open === "import"}
        onClose={close}
        title={t("settings:data.importTitle")}
      >
        <Text className="text-muted-foreground">
          {t("settings:data.importHelp")}
        </Text>
        <Button icon={Upload} label={t("settings:data.chooseFile")} onPress={close} />
        <Button variant="outline" label={t("settings:data.cancel")} onPress={close} />
      </Sheet>
    </Screen>
  )
}
