# Meal Planner

Macro Prep Planner: a single-file app (`macro-prep-planner.html`) published as a Claude artifact at https://claude.ai/artifact/5A7gHTp8iMiAsQLHve2ewE. Recipes, targets and the week plan live in the artifact's database, not in this repo.

## Git workflow

- After finishing each change the user asks for, commit it and push to GitHub (`origin`, private repo `norat18/meal-planner`, branch `main`) without asking first.
- Write a clear commit message: a short summary line saying what changed, then a body explaining why when it isn't obvious.
- One commit per requested change. Don't bundle unrelated changes.
- Before committing, check the staged diff for API keys, tokens, passwords or other secrets, and never commit `.env` files.
- If a change only touched the artifact database (adding or editing recipes, targets or plans), there's nothing to commit. Say so instead of making an empty commit.
- If the HTML changed, also republish the artifact so the live app matches the repo.
- `gh` lives at `/opt/homebrew/bin/gh`, which may not be on PATH.
