/* Recipe import: turns a link, a file (PDF, photo, Word, text) or pasted text into structured recipes with Claude.
   The Claude API key lives in Firebase Secret Manager (ANTHROPIC_API_KEY) and never reaches the browser. */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const dns = require("node:dns").promises;
const net = require("node:net");

admin.initializeApp();
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-5-5";
const DAILY_LIMIT = 80;
const SECTIONS = ["Produce", "Meat & Seafood", "Dairy & Eggs", "Grains & Bread", "Canned & Jarred", "Frozen", "Pantry staples", "Other"];

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    recipes: {
      type: "array",
      description: "Every distinct recipe found. Usually one.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          cuisine: { type: "string", description: "One or two words, e.g. Mexican, Thai, Mediterranean, American" },
          meals: { type: "array", items: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] } },
          servings: { type: "number", description: "Servings the whole recipe makes" },
          calories: { type: "number", description: "Per serving" },
          protein: { type: "number", description: "Grams per serving" },
          carbs: { type: "number", description: "Grams per serving" },
          fat: { type: "number", description: "Grams per serving" },
          fiber: { type: "number", description: "Grams of dietary fiber per serving" },
          fiberEstimated: { type: "boolean", description: "true unless the source printed fiber" },
          macrosEstimated: { type: "boolean", description: "true unless the source printed all four numbers" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                line: { type: "string", description: "The ingredient line as written in the source" },
                item: { type: "string", description: "Plain lowercase ingredient name, no amounts or prep (e.g. 'garlic', 'chicken breast')" },
                qty: { type: ["number", "null"], description: "Amount for the whole recipe; null for 'to taste'" },
                unit: { type: "string", description: "tsp, tbsp, cup, ml, l, fl oz, g, kg, oz, lb, or a count word like clove, can, slice, bunch, head, ear; empty for plain counts" },
                prep: { type: "string", description: "Prep note such as minced, diced, thinly sliced; empty if none" },
                category: { type: "string", enum: SECTIONS },
                easy: {
                  type: "object",
                  description: "Only when unit is g, kg, ml, l, oz or lb: the same whole-recipe amount in the easiest kitchen unit",
                  properties: {
                    qty: { type: "number" },
                    unit: { type: "string", description: "cup, tbsp, tsp, oz, lb, can, slice, stalk, clove, scoop, block, or empty to count pieces" },
                    one: { type: "string", description: "Singular display name when unit is empty (e.g. 'onion'), else empty" },
                    many: { type: "string", description: "Plural display name when unit is empty (e.g. 'onions'), else empty" }
                  },
                  required: ["qty", "unit", "one", "many"]
                }
              },
              required: ["line", "item", "qty", "unit", "prep", "category"]
            }
          },
          steps: { type: "array", items: { type: "string" } }
        },
        required: ["name", "cuisine", "meals", "servings", "calories", "protein", "carbs", "fat", "fiber", "fiberEstimated", "macrosEstimated", "ingredients", "steps"]
      }
    },
    problem: { type: "string", description: "If no recipe could be read, say why in one short sentence" }
  },
  required: ["recipes"]
};

function instructions(known) {
  return `Extract the recipe(s) from the material provided and call save_recipes.
- Ingredient amounts are for the whole recipe. If the source lists amounts for several serving sizes, use the smallest (usually 2 servings) and set servings to match.
- Split every ingredient line into item, qty, unit and prep. Pantry items listed separately (oil, butter, salt, pepper, sugar) are ingredients too.
- For item, reuse one of the person's existing ingredient names when it is the same thing, so grocery lists merge. Existing names: ${known.length ? known.join(", ") : "(none yet)"}.
- category is the store section where the item is bought.
- When an amount is in g, kg, ml, l, oz or lb, also give easy: the same amount in the unit a US home cook would measure without a scale. Produce, eggs and meat or fish that come as pieces count pieces with unit "" (200 g onion -> 1.33; medium onion 150 g, carrot 70 g, potato 200 g, chicken breast 200 g, salmon fillet 150 g); celery in stalks (40 g), garlic in cloves (5 g); Japanese curry roux counts roux trays (about 110 g each); flour, grains, cooked rice, dairy, nuts, frozen fruit, sauces and liquids in cup, tbsp or tsp; ground meat, shrimp and steak in lb or oz; canned goods in cans when at least half a can.
- Macros are per serving. If the source prints calories but not protein, carbs and fat, keep its calories and estimate the rest. If it prints nothing, estimate all four from the ingredients. Set macrosEstimated true whenever any number is your estimate. Fiber (grams per serving) works the same way: use the printed value, otherwise estimate it from the ingredients and set fiberEstimated true.
- meals: the meal types the dish suits.
- steps: short imperative sentences in order, without step numbers.
- Never invent a recipe that is not in the material. If there is none, return an empty list and explain in problem.`;
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

// Fetch a recipe page. Refuses non-http(s) links and anything that resolves to a private or metadata address.
async function checkUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new HttpsError("invalid-argument", "That doesn't look like a web link."); }
  if (!/^https?:$/.test(url.protocol)) throw new HttpsError("invalid-argument", "Only http and https links can be imported.");
  const addrs = await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (!addrs.length) throw new HttpsError("not-found", "That website couldn't be found. Check the link.");
  if (addrs.some(a => isPrivateAddress(a.address))) throw new HttpsError("invalid-argument", "That link can't be imported.");
  return url;
}
async function fetchPage(raw) {
  let url = await checkUrl(raw), res;
  // Follow redirects by hand so every hop is checked.
  for (let hop = 0; hop < 5; hop++) {
    res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000), headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 MealPlannerImport",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" } });
    const loc = res.status >= 300 && res.status < 400 && res.headers.get("location");
    if (!loc) break;
    url = await checkUrl(new URL(loc, url).href);
  }
  // Many recipe sites refuse automated requests. Signal that so the caller can try Claude's fetch, then fall back to paste.
  if (!res.ok) { const e = new Error(`HTTP ${res.status}`); e.blocked = true; e.status = res.status; e.url = url.href; throw e; }
  const html = (await res.text()).slice(0, 2_000_000);
  // Recipe sites usually embed schema.org Recipe data; keep it, plus the visible text.
  const jsonld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim()).filter(s => /Recipe/i.test(s)).join("\n").slice(0, 40000);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").slice(0, 60000);
  return `Source: ${url.href}\n\nStructured data:\n${jsonld || "(none)"}\n\nPage text:\n${text}`;
}

const BLOCKED_MSG = "That site doesn't allow automatic import. Open the recipe in your browser, press Cmd+A then Cmd+C to copy the page, and paste it here.";
async function contentFor(data) {
  if (data.url) {
    try { return { content: [{ type: "text", text: await fetchPage(String(data.url)) }] }; }
    catch (e) {
      if (!e.blocked) throw e;
      // Second try: Claude's own web fetch, which some sites allow when they block cloud servers.
      return { content: [{ type: "text", text: `Use web_fetch to read the recipe page at ${e.url}, then extract it.` }], webFetch: true, url: e.url };
    }
  }
  if (data.text) return { content: [{ type: "text", text: String(data.text).slice(0, 100000) }] };
  if (data.file && data.file.data) {
    const mime = String(data.file.mime || "");
    const b64 = String(data.file.data);
    if (b64.length > 12_000_000) throw new HttpsError("invalid-argument", "That file is too large. Keep it under 8 MB.");
    if (mime === "application/pdf") return { content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }] };
    if (/^image\/(jpeg|png|gif|webp)$/.test(mime)) return { content: [{ type: "image", source: { type: "base64", media_type: mime, data: b64 } }] };
    if (/officedocument\.wordprocessingml/.test(mime) || /\.docx$/i.test(data.file.name || "")) {
      const mammoth = require("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(b64, "base64") });
      return { content: [{ type: "text", text: value.slice(0, 100000) }] };
    }
    if (/^text\//.test(mime) || /\.(txt|md)$/i.test(data.file.name || "")) return { content: [{ type: "text", text: Buffer.from(b64, "base64").toString("utf8").slice(0, 100000) }] };
    throw new HttpsError("invalid-argument", "That file type isn't supported. Use a PDF, photo, Word document or text file.");
  }
  throw new HttpsError("invalid-argument", "Nothing to import.");
}

async function countUse(uid) {
  const ref = admin.firestore().doc(`usage/${uid}`);
  const today = new Date().toISOString().slice(0, 10);
  return admin.firestore().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    const n = d.day === today ? d.count : 0;
    if (n >= DAILY_LIMIT) throw new HttpsError("resource-exhausted", `You've reached today's limit of ${DAILY_LIMIT} imports. Try again tomorrow or add recipes by hand.`);
    tx.set(ref, { day: today, count: n + 1, total: (d.total || 0) + 1 }, { merge: true });
  });
}

exports.importRecipe = onCall({ secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: "512MiB", maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in to import recipes.");
  await countUse(req.auth.uid);
  const data = req.data || {};
  const known = (Array.isArray(data.known) ? data.known : []).map(String).filter(Boolean).slice(0, 600);
  const src = await contentFor(data);
  const content = src.content;
  content.push({ type: "text", text: instructions(known) + "\nAlways finish by calling save_recipes." });
  const tools = [{ name: "save_recipes", description: "Save the recipes extracted from the material.", input_schema: RECIPE_SCHEMA }];
  if (src.webFetch) tools.unshift({ type: "web_fetch_20250910", name: "web_fetch", max_uses: 2 });
  // tool_choice "auto": this model rejects forced tool choice; the prompt asks for save_recipes.
  const messages = [{ role: "user", content }];
  let out;
  // Server tools (web fetch) can pause a long turn; continue it up to twice.
  for (let turn = 0; turn < 3; turn++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(90000),
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY.value(), "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 16000, tools, tool_choice: { type: "auto" }, messages })
    });
    if (!res.ok) {
      console.error("Claude API error", res.status, (await res.text()).slice(0, 500));
      throw new HttpsError("unavailable", "The import service is busy right now. Try again in a minute, or add the recipe by hand.");
    }
    out = await res.json();
    if (out.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: out.content });
  }
  const use = (out.content || []).find(b => b.type === "tool_use" && b.name === "save_recipes");
  const recipes = use && Array.isArray(use.input.recipes) ? use.input.recipes : [];
  if (!recipes.length) {
    if (src.webFetch) throw new HttpsError("failed-precondition", BLOCKED_MSG, { blocked: true, url: src.url });
    console.warn("No recipes returned", out.stop_reason, JSON.stringify(out.content || []).slice(0, 400));
    throw new HttpsError("not-found", (use && use.input.problem) || "No recipe was found in that. Try another file, or add it by hand.");
  }
  return { recipes };
});
