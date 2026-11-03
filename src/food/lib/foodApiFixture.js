// Offline stand-in for the food API (spec §3.1, §3.4): used when
// VITE_FOOD_API_BASE is unset or "fixture". Foods are in the API `PublicFood`
// shape (spec §4); values are per 100 g.

const usda = (id, name, prepState, per100, portions) => ({
  id,
  name,
  prepState,
  source: "usda_fdc",
  isVerified: true,
  barcode: null,
  per100,
  portions,
});

export const FIXTURE_FOODS = [
  usda(
    "fx-chicken-breast-roasted",
    "chicken, breast, roasted",
    "roasted",
    { kcal: 165, protein: 31.0, carb: 0, fat: 3.6 },
    [
      { label: "1 breast", grams: 172, isDefault: true },
      { label: "1 oz", grams: 28.35, isDefault: false },
    ],
  ),
  usda(
    "fx-rice-white-cooked",
    "rice, white, cooked",
    "cooked",
    { kcal: 130, protein: 2.7, carb: 28.2, fat: 0.3 },
    [{ label: "1 cup", grams: 158, isDefault: true }],
  ),
  usda(
    "fx-egg-whole-cooked",
    "egg, whole, cooked",
    "cooked",
    { kcal: 155, protein: 12.6, carb: 1.1, fat: 10.6 },
    [{ label: "1 large", grams: 50, isDefault: true }],
  ),
  usda(
    "fx-oats",
    "oats, rolled, dry",
    "raw",
    { kcal: 379, protein: 13.2, carb: 67.7, fat: 6.5 },
    [{ label: "1/2 cup", grams: 40, isDefault: true }],
  ),
  usda(
    "fx-banana",
    "banana, raw",
    "raw",
    { kcal: 89, protein: 1.1, carb: 22.8, fat: 0.3 },
    [{ label: "1 medium", grams: 118, isDefault: true }],
  ),
  usda(
    "fx-milk-whole",
    "milk, whole",
    "raw",
    { kcal: 61, protein: 3.2, carb: 4.8, fat: 3.3 },
    [{ label: "1 cup", grams: 244, isDefault: true }],
  ),
  usda(
    "fx-salmon-cooked",
    "salmon, cooked",
    "cooked",
    { kcal: 206, protein: 22.1, carb: 0, fat: 12.4 },
    [
      { label: "1 fillet", grams: 154, isDefault: true },
      { label: "3 oz", grams: 85, isDefault: false },
    ],
  ),
  usda(
    "fx-broccoli-cooked",
    "broccoli, cooked",
    "cooked",
    { kcal: 35, protein: 2.4, carb: 7.2, fat: 0.4 },
    [{ label: "1 cup, chopped", grams: 156, isDefault: true }],
  ),
  usda(
    "fx-peanut-butter",
    "peanut butter, smooth",
    null,
    { kcal: 588, protein: 25.1, carb: 20.0, fat: 50.4 },
    [{ label: "2 tbsp", grams: 32, isDefault: true }],
  ),
  {
    id: "fx-off-8934563138165",
    name: "instant noodles, hot and sour shrimp",
    prepState: null,
    source: "open_food_facts",
    isVerified: false,
    barcode: "8934563138165",
    per100: { kcal: 467, protein: 8.5, carb: 60.0, fat: 21.0 },
    portions: [{ label: "1 pack", grams: 75, isDefault: true }],
  },
];

const respond = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const BARCODE_PATH = /^\/v1\/foods\/barcode\/([^/]+)$/;

/** `fetch`-compatible stand-in serving FIXTURE_FOODS for the two food routes. */
export async function fixtureFetch(url) {
  const u = new URL(url, "http://fixture");
  if (u.pathname === "/v1/foods") {
    const q = (u.searchParams.get("q") || "").toLowerCase();
    const limit = Number(u.searchParams.get("limit")) || 20;
    const results = FIXTURE_FOODS.filter((f) =>
      f.name.toLowerCase().includes(q),
    ).slice(0, limit);
    return respond(200, { requestId: "req_fixture", query: q, results });
  }
  const m = BARCODE_PATH.exec(u.pathname);
  const food = m && FIXTURE_FOODS.find((f) => f.barcode === m[1]);
  if (food) return respond(200, { requestId: "req_fixture", food });
  return respond(404, { error: { code: "not_found" } });
}
