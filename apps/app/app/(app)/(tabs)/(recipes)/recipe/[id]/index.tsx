import { router, useLocalSearchParams } from "expo-router"
import {
  ChefHat,
  Clock,
  Download,
  FileCode,
  FileJson,
  FileText,
  Pencil,
  SearchX,
  ShoppingCart,
} from "lucide-react-native"
import { useState } from "react"
import { Text, View } from "react-native"

import { ListGroup, ListRow } from "@/components/list-row"
import { RecipeCover, sourceIcons } from "@/components/recipe-card"
import {
  IngredientList,
  NutritionEstimate,
  ServingsScaler,
  StepList,
} from "@/components/recipe-parts"
import { Screen } from "@/components/screen"
import { EmptyState } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, SectionTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Sheet } from "@/components/ui/sheet"
import { useAppState } from "@/lib/app-state"
import { formatMinutes } from "@/lib/format"
import { useIsWide } from "@/lib/layout"
import { findRecipe, shoppingLists } from "@/lib/mock-data"

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const recipe = findRecipe(id)
  const wide = useIsWide()
  const { units } = useAppState()
  const [servings, setServings] = useState(recipe?.servings ?? 1)
  const [exportOpen, setExportOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)

  if (!recipe) {
    return (
      <Screen title="Recipe not found" back="/">
        <EmptyState
          icon={SearchX}
          title="This recipe does not exist"
          message="It may have been deleted."
          action="Back to recipes"
          onAction={() => router.replace("/")}
        />
      </Screen>
    )
  }

  const factor = servings / recipe.servings

  const ingredients = (
    <Card className="gap-4 p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <SectionTitle>Ingredients</SectionTitle>
        <ServingsScaler servings={servings} onChange={setServings} />
      </View>
      <IngredientList
        ingredients={recipe.ingredients}
        factor={factor}
        units={units}
      />
      <Button
        variant="outline"
        icon={ShoppingCart}
        label="Add to shopping list"
        onPress={() => setListOpen(true)}
      />
    </Card>
  )

  const steps = (
    <Card className="gap-4 p-4">
      <SectionTitle>Steps</SectionTitle>
      <StepList steps={recipe.steps} />
    </Card>
  )

  const nutrition = (
    <Card className="gap-4 p-4">
      <SectionTitle>Nutrition</SectionTitle>
      <NutritionEstimate nutrition={recipe.nutrition} />
    </Card>
  )

  return (
    <Screen
      title={recipe.title}
      back="/"
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            icon={Pencil}
            label="Edit recipe"
            onPress={() => router.push(`/recipe/${recipe.id}/edit`)}
          />
          <Button
            variant="ghost"
            size="icon"
            icon={Download}
            label="Export recipe"
            onPress={() => setExportOpen(true)}
          />
        </>
      }
    >
      <View className="gap-4 md:flex-row md:gap-6">
        <RecipeCover
          recipe={recipe}
          className="h-40 rounded-lg md:h-48 md:w-72"
        />
        <View className="flex-1 gap-3">
          <Text className="text-base text-muted-foreground">
            {recipe.description}
          </Text>
          <View className="flex-row flex-wrap gap-x-5 gap-y-2">
            <Meta
              icon={Clock}
              text={`${formatMinutes(recipe.prepMinutes)} prep`}
            />
            <Meta
              icon={ChefHat}
              text={`${formatMinutes(recipe.cookMinutes)} cooking`}
            />
            <Meta
              icon={sourceIcons[recipe.source.kind]}
              text={recipe.source.label}
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <Badge key={tag} label={tag} />
            ))}
          </View>
          <Button
            size="lg"
            icon={ChefHat}
            label="Start cooking"
            className="mt-1 md:self-start"
            onPress={() => router.push(`/cook/${recipe.id}`)}
          />
        </View>
      </View>

      {wide ? (
        <View className="flex-row items-start gap-6">
          <View className="flex-[2] gap-6">
            {ingredients}
            {nutrition}
          </View>
          <View className="flex-[3]">{steps}</View>
        </View>
      ) : (
        <>
          {ingredients}
          {steps}
          {nutrition}
        </>
      )}

      <Sheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export recipe"
      >
        <ListGroup>
          <ListRow
            icon={FileJson}
            title="JSON"
            detail="For backups and other apps"
            onPress={() => setExportOpen(false)}
          />
          <ListRow
            icon={FileText}
            title="Markdown"
            detail="Plain text to read or print"
            onPress={() => setExportOpen(false)}
          />
          <ListRow
            icon={FileCode}
            title="schema.org Recipe"
            detail="Standard recipe format for the web"
            onPress={() => setExportOpen(false)}
          />
        </ListGroup>
        <Button
          variant="outline"
          label="Cancel"
          onPress={() => setExportOpen(false)}
        />
      </Sheet>

      <Sheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        title="Add to which list?"
      >
        <ListGroup>
          {shoppingLists.map((list) => (
            <ListRow
              key={list.id}
              icon={ShoppingCart}
              title={list.name}
              detail={`${list.items.length} items`}
              onPress={() => {
                setListOpen(false)
                router.push(`/shopping/${list.id}`)
              }}
            />
          ))}
        </ListGroup>
        <Button
          variant="outline"
          label="Cancel"
          onPress={() => setListOpen(false)}
        />
      </Sheet>
    </Screen>
  )
}

function Meta({ icon, text }: { icon: typeof Clock; text: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon as={icon} size={16} className="text-muted-foreground" />
      <Text className="text-sm text-muted-foreground">{text}</Text>
    </View>
  )
}
