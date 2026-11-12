import { router } from "expo-router"
import { Copy, Send } from "lucide-react-native"
import { useState } from "react"
import { Text, View } from "react-native"

import { Screen } from "@/components/screen"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/segmented"
import { household } from "@/lib/mock-data"

export default function Invite() {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"member" | "admin">("member")
  const [copied, setCopied] = useState(false)

  return (
    <Screen title="Invite someone" back="/settings/household" narrow>
      <Card className="gap-4 p-4">
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View className="gap-1.5">
          <Text className="text-sm font-medium text-foreground">Role</Text>
          <Segmented
            label="Role"
            value={role}
            onChange={setRole}
            options={[
              { value: "member", label: "Member" },
              { value: "admin", label: "Admin" },
            ]}
          />
          <Text className="text-sm text-muted-foreground">
            {role === "admin"
              ? "Admins can also invite and remove people."
              : "Members can add and edit recipes and lists."}
          </Text>
        </View>
        <Button
          icon={Send}
          label="Send invite"
          disabled={!email.includes("@")}
          onPress={() => router.back()}
        />
      </Card>

      <Card className="gap-3 p-4">
        <Text className="text-base font-semibold text-foreground">
          Or share a link
        </Text>
        <Text
          numberOfLines={1}
          className="rounded-md bg-muted px-3 py-3 text-sm text-muted-foreground"
        >
          {household.inviteLink}
        </Text>
        <Button
          variant="outline"
          icon={Copy}
          label={copied ? "Copied" : "Copy link"}
          onPress={() => setCopied(true)}
        />
      </Card>
    </Screen>
  )
}
