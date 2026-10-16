# Meal Planner

Macro Prep Planner is a single-page app for planning a week of meals that hits your daily calorie and macro targets, then building one combined grocery list.

- **Week plan:** pick meals yourself (they get pinned), or generate a week with "Plan a lean grocery week" (reuses ingredients to keep the list short) or "Surprise me" (random). Portions scale in quarter-serving steps so every day lands inside your tolerance band.
- **Cuisines:** filter the whole week, or make any single day a cuisine day.
- **Groceries:** amounts are combined across the week and grouped by aisle, with a prep list of how many batches to cook.
- **Recipes:** click any recipe for its ingredients and step-by-step instructions. Add, edit or import recipes (JSON or CSV).

## Files

- `macro-prep-planner.html`: the whole app (HTML, CSS and JavaScript in one file).
- `.claude/launch.json`: local preview server config (`python3 -m http.server 8765`).

## Where the data lives

The published version runs as a Claude artifact and stores recipes, targets and the current plan in the artifact's database, not in this repository. Opened as a plain local file, the app falls back to browser storage and loads a set of example recipes.

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/macro-prep-planner.html.
