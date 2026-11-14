import { describe, expect, test } from "bun:test"

import { highlightStep, type StepVocabulary } from "./step-highlight"

const en: StepVocabulary = {
  units: ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "cups", "fl oz", "pinch", "clove", "cloves"],
  times: ["hour", "hours", "h", "minute", "minutes", "min", "second", "seconds"],
}
const de: StepVocabulary = {
  units: ["g", "EL", "TL", "Prise", "Tassen"],
  times: ["Stunde", "Stunden", "Minute", "Minuten", "Min."],
  foods: ["Öl", "Nudel", "Nudeln", "Mehl"],
  modifiers: ["gemischt", "frisch"],
}

/** The bold parts of a step, in order. */
const bold = (text: string, names: string[], vocabulary = en) =>
  highlightStep(text, names, vocabulary)
    .filter((piece) => piece.bold)
    .map((piece) => piece.text)

describe("highlightStep", () => {
  test("amount and ingredient next to each other are one bold piece", () => {
    expect(bold("Mix 200 g flour with the milk", ["flour", "milk"])).toEqual([
      "200 g flour",
      "milk",
    ])
  })

  test("times are bold", () => {
    expect(bold("Bake for 30 minutes", [])).toEqual(["30 minutes"])
    expect(bold("Rest 1 hour 30 minutes, then serve", [])).toEqual(["1 hour 30 minutes"])
    expect(bold("Rest 5-10 min", [])).toEqual(["5-10 min"])
  })

  test("words that are not an ingredient, amount or time stay normal", () => {
    expect(bold("Stir well and serve with a spoon", ["flour"])).toEqual([])
    expect(bold("Preheat the oven to 180 degrees", ["flour"])).toEqual([])
  })

  test("the pieces together are exactly the original text", () => {
    const text = "Mix 200 g flour with the milk, bake for 30 minutes."
    const pieces = highlightStep(text, ["flour", "milk"], en)
    expect(pieces.map((piece) => piece.text).join("")).toBe(text)
  })

  test("ignores upper and lower case", () => {
    expect(bold("Add the MILK", ["Milk"])).toEqual(["MILK"])
  })

  test("longer names are bold as a whole", () => {
    expect(bold("Heat the olive oil", ["oil", "olive oil"])).toEqual(["olive oil"])
  })

  test("plural and singular forms", () => {
    expect(bold("Beat the eggs", ["egg"])).toEqual(["eggs"])
    expect(bold("Add one egg", ["eggs"])).toEqual(["egg"])
    expect(bold("Chop the tomatoes", ["tomato"])).toEqual(["tomatoes"])
    expect(bold("Add the cherries", ["cherry"])).toEqual(["cherries"])
    expect(bold("Add the cherry", ["cherries"])).toEqual(["cherry"])
  })

  test("a number in front of an ingredient counts as its amount", () => {
    expect(bold("Whisk 2 eggs", ["egg"])).toEqual(["2 eggs"])
  })

  test("fractions and decimals", () => {
    expect(bold("Add 1/2 cup sugar", ["sugar"])).toEqual(["1/2 cup sugar"])
    expect(bold("Add 1,5 l water", ["water"])).toEqual(["1,5 l water"])
    expect(bold("Add 2 tbsp butter", ["butter"])).toEqual(["2 tbsp butter"])
  })

  test("does not match inside other words", () => {
    expect(bold("Add flourish", ["flour"])).toEqual([])
    expect(bold("Use 5 gold stars", [])).toEqual([])
  })

  test("two ingredients next to each other stay separate pieces", () => {
    expect(bold("Add milk flour", ["milk", "flour"])).toEqual(["milk", "flour"])
  })

  test("brackets in an ingredient name are ignored", () => {
    expect(bold("Add the butter", ["butter (soft)"])).toEqual(["butter"])
  })

  test("characters that are special in a pattern are safe", () => {
    expect(bold("Add the mac+cheese", ["mac+cheese", "(", "a.b"])).toEqual(["mac+cheese"])
  })

  test("works with the words of another language", () => {
    expect(bold("200 g Mehl mit der Milch 30 Minuten backen", ["Mehl", "Milch"], de)).toEqual([
      "200 g Mehl",
      "Milch",
      "30 Minuten",
    ])
    expect(bold("2 EL Zucker", ["Zucker"], de)).toEqual(["2 EL Zucker"])
    expect(bold("Die Tomaten schneiden", ["Tomate"], de)).toEqual(["Tomaten"])
  })

  test("a step with nothing to find is one normal piece", () => {
    expect(highlightStep("Serve.", [], en)).toEqual([{ text: "Serve.", bold: false }])
    expect(highlightStep("", ["flour"], en)).toEqual([])
  })

  test("the main word of a longer name is bold too", () => {
    expect(bold("Das Hackfleisch anbraten", ["Hackfleisch gemischt"], de)).toEqual(["Hackfleisch"])
    expect(bold("Add the garlic", ["garlic cloves"])).toEqual(["garlic"])
  })

  test("describing words of a name are not bold alone", () => {
    expect(bold("Alles gemischt anbraten", ["Hackfleisch gemischt"], de)).toEqual([])
    expect(bold("Use fresh herbs", ["fresh basil"], { ...en, modifiers: ["fresh"] })).toEqual([])
  })

  test("common food words are bold even when the recipe lists them differently", () => {
    expect(bold("Das Öl erhitzen", ["Olivenöl"], de)).toEqual(["Öl"])
    expect(bold("Die Nudel kochen, dann 2 Nudeln", ["Spaghetti"], de)).toEqual(["Nudel", "2 Nudeln"])
    expect(bold("Heat the oil", [], { ...en, foods: ["oil"] })).toEqual(["oil"])
  })
})
