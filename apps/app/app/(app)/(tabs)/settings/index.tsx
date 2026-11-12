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
  Server,
  Sparkles,
  Upload,
  User,
} from "lucide-react-native"
import { useState } from "react"
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
import { useHousehold } from "@/lib/households"
import { aiProviders } from "@/lib/mock-data"

type Open = "language" | "export" | "import" | null

export default function Settings() {
  const state = useAppState()
  const { data: session } = authClient.useSession()
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)
  const { household, isPending: householdPending } = useHousehold()

  const name = state.demo ? "Demo" : (session?.user.name ?? "You")
  const email = state.demo
    ? "Browsing sample data, not signed in"
    : session?.user.email

  return (
    <Screen title="Settings" narrow>
      <ListGroup title="Account">
        <ListRow icon={User} title={name} detail={email} />
        <ListRow
          icon={LogOut}
          title={state.demo ? "Leave the demo" : "Log out"}
          destructive
          onPress={() =>
            state.demo ? state.setDemo(false) : authClient.signOut()
          }
        />
      </ListGroup>

      <ListGroup title="Household">
        <ListRow
          icon={Home}
          title={
            household?.name ??
            (householdPending ? "Household" : "No household yet")
          }
          detail={
            household
              ? "Members, invites and shared recipes and lists"
              : "Create one, or join with an invite link"
          }
          onPress={() => router.push("/settings/household")}
        />
      </ListGroup>

      <ListGroup title="Preferences">
        <View className="gap-2 px-4 py-3">
          <Text className="text-base text-foreground">Units</Text>
          <Segmented
            label="Units"
            value={state.units}
            onChange={state.setUnits}
            options={[
              { value: "metric", label: "Metric (g, ml)" },
              { value: "imperial", label: "Imperial (oz, cups)" },
            ]}
          />
        </View>
        <View className="gap-2 px-4 py-3">
          <Text className="text-base text-foreground">Appearance</Text>
          <Segmented
            label="Appearance"
            value={state.appearance}
            onChange={state.setAppearance}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </View>
        <ListRow
          icon={Languages}
          title="Language"
          detail="English"
          onPress={() => setOpen("language")}
        />
      </ListGroup>

      <ListGroup title="Your data">
        <ListRow
          icon={Download}
          title="Export all recipes"
          detail="JSON, Markdown or schema.org"
          onPress={() => setOpen("export")}
        />
        <ListRow
          icon={Upload}
          title="Import recipes"
          detail="From an idkjustfood or schema.org export"
          onPress={() => setOpen("import")}
        />
      </ListGroup>

      {isCloud ? (
        <ListGroup title="Plan">
          <ListRow
            icon={CreditCard}
            title="Plan and billing"
            onPress={() => router.push("/billing")}
          />
        </ListGroup>
      ) : (
        <ListGroup title="This server">
          <ListRow icon={Server} title="Server address" detail={API_URL} />
          <ListRow
            icon={AudioLines}
            title="Transcription"
            detail={`${aiProviders.transcription.provider} · ${aiProviders.transcription.model}`}
          />
          <ListRow
            icon={Sparkles}
            title="Recipe parsing"
            detail={`${aiProviders.parsing.provider} · ${aiProviders.parsing.model}`}
          />
          <View className="px-4 py-3">
            <Text className="text-sm text-muted-foreground">
              The AI providers are chosen by whoever runs this server, in its
              settings. Any provider works, including models you host yourself.
            </Text>
          </View>
        </ListGroup>
      )}

      <ListGroup title="Prototype">
        <View className="gap-2 px-4 py-3">
          <Text className="text-base text-foreground">
            Show recipe and shopping lists as
          </Text>
          <Segmented
            label="List state"
            value={state.listState}
            onChange={state.setListState}
            options={[
              { value: "ready", label: "Normal" },
              { value: "loading", label: "Loading" },
              { value: "empty", label: "Empty" },
              { value: "error", label: "Error" },
            ]}
          />
        </View>
        <ListRow
          title="Pretend to be offline"
          detail="Shows the offline hint on shopping lists"
          right={
            <Switch
              accessibilityLabel="Pretend to be offline"
              value={state.offline}
              onValueChange={state.setOffline}
            />
          }
        />
      </ListGroup>

      <ListGroup title="About">
        <ListRow
          icon={Code}
          title="idkjustfood is open source"
          detail="Version 0.0.1"
        />
      </ListGroup>

      <Sheet open={open === "language"} onClose={close} title="Language">
        <ListGroup>
          <ListRow
            icon={Globe}
            title="English"
            right={<Icon as={Check} className="text-primary" />}
            onPress={close}
          />
        </ListGroup>
        <Text className="text-muted-foreground">
          More languages come later.
        </Text>
        <Button variant="outline" label="Close" onPress={close} />
      </Sheet>

      <Sheet
        open={open === "export"}
        onClose={close}
        title="Export all recipes"
      >
        <ListGroup>
          <ListRow
            icon={FileJson}
            title="JSON"
            detail="Full backup, can be imported again"
            onPress={close}
          />
          <ListRow
            icon={FileText}
            title="Markdown"
            detail="One file per recipe"
            onPress={close}
          />
          <ListRow
            icon={FileCode}
            title="schema.org Recipe"
            detail="For other recipe apps"
            onPress={close}
          />
        </ListGroup>
        <Button variant="outline" label="Cancel" onPress={close} />
      </Sheet>

      <Sheet open={open === "import"} onClose={close} title="Import recipes">
        <Text className="text-muted-foreground">
          Choose a JSON or schema.org file. Recipes you already have are
          skipped.
        </Text>
        <Button icon={Upload} label="Choose file" onPress={close} />
        <Button variant="outline" label="Cancel" onPress={close} />
      </Sheet>
    </Screen>
  )
}
