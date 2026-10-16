# Meal Planner

Macro Prep Planner: a single-file app (`macro-prep-planner.html`) published as a Claude artifact at https://claude.ai/artifact/5A7gHTp8iMiAsQLHve2ewE. Recipes, targets and the week plan live in the artifact's database, not in this repo.

## Logging meals in MyFitnessPal

MyFitnessPal has no public API, so the app offers two manual paths and Claude can do a third on request:

- **Barcode:** only recipes with an `mfp` field (`{format: "UPC" | "UPCE", code}`) show a barcode. These are the codes printed in the Coach Greg packs, decoded from the PDFs' barcode images, and they scan because the coach's foods are already in MyFitnessPal's database. Don't generate barcodes for other recipes: Nora's MyFitnessPal app gives no way to link a new barcode to a food, and the website's create-food form has no barcode field, so generated codes always scan as "no match" (tried and removed).
- **Search:** recipes without a barcode are created as public foods on myfitnesspal.com (My Foods), with brand `Homemade` (`my-` ids), `Strong` (`st-`) or `Coach Greg` (`hp-`), description = recipe name, 1 serving, servings per container = recipe servings, and calories, fat, carbs and protein per serving. The recipe view tells Nora to search "<brand> <name>". When a recipe is added or its macros change, update the matching MyFitnessPal food too.
- **Quick Add copy:** every recipe view and day card can copy calories, carbs, fat and protein (MyFitnessPal's Quick Add field order) at the planned portion.
- **Claude logs it in Chrome:** when Nora asks (for example "log today's lunch"), read the plan (`app/plan`) and recipes from the artifact database, compute each meal's numbers at its portion (`recipe macros × x`), then use Claude in Chrome on myfitnesspal.com, signed in as Nora, to add each meal to the right Diary section with Quick Add. Show the entries and get her OK before saving each one. Only do this when she asks; never log meals on your own.

## Git workflow

- After finishing each change the user asks for, commit it and push to GitHub (`origin`, private repo `norat18/meal-planner`, branch `main`) without asking first.
- Write a clear commit message: a short summary line saying what changed, then a body explaining why when it isn't obvious.
- One commit per requested change. Don't bundle unrelated changes.
- Before committing, check the staged diff for API keys, tokens, passwords or other secrets, and never commit `.env` files.
- If a change only touched the artifact database (adding or editing recipes, targets or plans), there's nothing to commit. Say so instead of making an empty commit.
- If the HTML changed, also republish the artifact so the live app matches the repo.
- `gh` lives at `/opt/homebrew/bin/gh`, which may not be on PATH.
