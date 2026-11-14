import { useTranslation } from "react-i18next"
import { View } from "react-native"

import { Button } from "@/components/ui/button"
import { useSocialProviders, type SocialProvider } from "@/lib/use-auth-config"

/** One button per social provider the API has turned on. Nothing if there are none. */
export function SocialButtons({
  onPress,
  disabled,
}: {
  onPress: (provider: SocialProvider) => void
  disabled?: boolean
}) {
  const { t } = useTranslation("auth")
  const providers = useSocialProviders()
  if (providers.length === 0) return null
  return (
    <View className="gap-3">
      {providers.map((provider) => (
        <Button
          key={provider}
          variant="outline"
          label={t(`social.${provider}`)}
          className="h-12"
          disabled={disabled}
          onPress={() => onPress(provider)}
        />
      ))}
    </View>
  )
}
