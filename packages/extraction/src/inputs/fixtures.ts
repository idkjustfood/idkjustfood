// Small copies of the page shapes recipe websites really use.

/** A blog with a Yoast-style @graph, HowToStep lists, ISO durations and HTML entities. */
export const blogWithGraph = `<!DOCTYPE html>
<html lang="en"><head>
<title>Best Lentil Soup &#8211; Cozy Kitchen</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"WebSite","name":"Cozy Kitchen"},
 {"@type":["Recipe"],"name":"Best Lentil Soup &amp; Bread",
  "description":"<p>A thick soup.</p>",
  "recipeYield":["6","6 servings"],
  "prepTime":"PT15M","cookTime":"PT1H","totalTime":"PT1H15M",
  "recipeCuisine":"Mediterranean","recipeCategory":["Soup"],
  "suitableForDiet":"https://schema.org/VeganDiet",
  "recipeIngredient":[
    "1 1/2 cups red lentils",
    "2 tablespoons olive oil",
    "1 large onion, finely chopped",
    "3 cloves garlic",
    "salt and pepper",
    "2-3 carrots",
    "&frac12; teaspoon cumin"
  ],
  "recipeInstructions":[
    {"@type":"HowToStep","text":"Heat the oil and cook the onion."},
    {"@type":"HowToStep","text":"Add lentils and 1 litre of water. Simmer for 30 minutes."}
  ]}
]}
</script></head><body><h1>Best Lentil Soup</h1></body></html>`

/** Recipe in a top-level array, with sections and instructions as one text. */
export const sectionsAndText = `<html><head>
<script type="application/ld+json">[
 {"@type":"BreadcrumbList","itemListElement":[]},
 {"@context":"http://schema.org","@type":"Recipe","name":"Weeknight Pasta",
  "recipeYield":"Serves 4",
  "totalTime":"PT30M",
  "recipeIngredient":["400 g spaghetti","2 tbsp butter","1 pinch salt"],
  "recipeInstructions":[
    {"@type":"HowToSection","name":"Sauce","itemListElement":[
       {"@type":"HowToStep","text":"Melt the butter."}]},
    {"@type":"HowToSection","name":"Pasta","itemListElement":[
       {"@type":"HowToStep","text":"Boil the spaghetti for 10 minutes."}]}
  ]}
]</script></head><body></body></html>`

export const instructionsAsText = `<html><head>
<script type="application/ld+json">
{"@type":"Recipe","name":"Toast","recipeIngredient":["2 slices bread"],
 "recipeInstructions":"<p>Put bread in the toaster.</p><p>Wait 2 minutes.</p>"}
</script></head></html>`

/** A recipe page without any structured data. */
export const plainPage = `<html><head><title>Granny's Apple Pie</title>
<style>body { color: red }</style>
<script>window.ads = true</script></head>
<body><nav>Home | About</nav>
<h1>Granny's Apple Pie</h1>
<p>Serves 8. You need 1 kg apples and 200 g sugar.</p>
<ol><li>Peel the apples.</li><li>Bake for 45 minutes.</li></ol>
<footer>Copyright</footer></body></html>`

/** Recipe data that has a name and ingredients but no steps: the AI has to help. */
export const incompleteData = `<html><head>
<script type="application/ld+json">
{"@type":"Recipe","name":"Mystery Stew","recipeIngredient":["1 kg beef"]}
</script></head>
<body><h1>Mystery Stew</h1><p>Brown the beef, then simmer for 2 hours.</p></body></html>`

/** Broken JSON-LD must not crash the reader. */
export const brokenJson = `<html><head>
<script type="application/ld+json">{"@type":"Recipe", "name": </script>
</head><body><p>Just text: mix flour and water.</p></body></html>`
