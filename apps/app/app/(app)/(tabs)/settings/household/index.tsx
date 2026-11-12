import { router } from "expo-router"
import { Mail, UserPlus } from "lucide-react-native"
import { Text, View } from "react-native"

import { ListGroup, ListRow } from "@/components/list-row"
import { Screen } from "@/components/screen"
import { SpaceSwitcher } from "@/components/space-switcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { household } from "@/lib/mock-data"

export default function Household() {
  return (
    <Screen
      title={household.name}
      subtitle="Your household shares recipes and shopping lists."
      back="/settings"
      narrow
    >
      <View className="gap-2">
        <Text className="px-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Show recipes and lists from
        </Text>
        <SpaceSwitcher />
      </View>

      <ListGroup title={`Members (${household.members.length})`}>
        {household.members.map((member) => (
          <ListRow
            key={member.id}
            title={member.you ? "You" : member.name}
            detail={member.email}
            right={
              <Badge
                label={member.role}
                variant={member.role === "owner" ? "default" : "secondary"}
              />
            }
          />
        ))}
      </ListGroup>

      <ListGroup title="Waiting for answer">
        {household.pendingInvites.map((email) => (
          <ListRow
            key={email}
            icon={Mail}
            title={email}
            detail="Invited 2 days ago"
            right={<Badge label="invited" variant="outline" />}
          />
        ))}
      </ListGroup>

      <Button
        icon={UserPlus}
        label="Invite someone"
        onPress={() => router.push("/settings/household/invite")}
      />
      <Button variant="ghost" label="Leave household" className="self-center" />
    </Screen>
  )
}
