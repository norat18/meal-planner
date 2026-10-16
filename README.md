# Short List

Short List turns your own recipes into a varied week of meals that share ingredients, then builds one short grocery list.

- **Private library:** sign in with Google; your recipes, plans and settings are visible only to you.
- **Import:** add recipes from a link, a PDF, a photo, a Word document or pasted text. Claude reads it, and you review and fix every field before saving. You need 15 recipes before the first plan.
- **Week plan:** no recipe is cooked twice, the week mixes at least 2 cuisines, and among plans that follow those rules the planner picks the fewest unique ingredients. "Minimize groceries" relaxes the cuisine rule. Every dinner comes back as the next day's lunch, and breakfast rotates Mon–Tue, Wed–Thu and Fri–Sun (car-friendly on Fri–Sun).
- **Optional macro targets:** with targets set, each day lands within your tolerance first; if no plan can, the app says which target it missed and by how much.
- **Groceries:** lines with the same ingredient merge, scaled to your household size; amounts combine within a unit family (volume, weight, count). Grouped by store section, with check-off and an "I already have this" toggle.

## Files

- `public/index.html`: the whole app (HTML, CSS and JavaScript).
- `functions/index.js`: the `importRecipe` Cloud Function (calls the Claude API).
- `firestore.rules`: each user can read and write only `users/{their uid}/`.
- `firebase.json`: hosting, rules and functions config.

## Set up Firebase (one time)

1. Create a Firebase project, upgrade it to the Blaze (pay-as-you-go) plan, and set a budget alert.
2. Enable Authentication → Google, create a Firestore database, and register a Web app; paste its config into `FIREBASE_CONFIG` in `public/index.html`. Live app: https://short-list-meals.web.app (its domain is in Auth's authorized domains; sign-in still runs through macro-prep-planner-nt.firebaseapp.com until the OAuth client lists https://short-list-meals.web.app/__/auth/handler).
3. Store the Claude API key: `npx firebase-tools@13.29.1 functions:secrets:set ANTHROPIC_API_KEY`
4. Deploy: `npx firebase-tools@13.29.1 deploy`

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/public/index.html. With no Firebase config, the app stores data in your browser and import is unavailable.
