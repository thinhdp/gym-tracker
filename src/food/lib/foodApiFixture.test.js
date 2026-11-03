import { FIXTURE_FOODS, fixtureFetch } from "./foodApiFixture";

describe("fixtureFetch", () => {
  it("holds ten PublicFood items, nine USDA and one product", () => {
    expect(FIXTURE_FOODS).toHaveLength(10);
    expect(FIXTURE_FOODS.filter((f) => f.source === "usda_fdc")).toHaveLength(
      9,
    );
    const product = FIXTURE_FOODS.find((f) => f.source === "open_food_facts");
    expect(product.barcode).toBe("8934563138165");
    for (const f of FIXTURE_FOODS) {
      expect(f).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        isVerified: expect.any(Boolean),
        per100: {
          kcal: expect.any(Number),
          protein: expect.any(Number),
          carb: expect.any(Number),
          fat: expect.any(Number),
        },
      });
      expect(f.portions.length).toBeGreaterThan(0);
      if (f.source === "usda_fdc") expect(f.barcode).toBeNull();
    }
  });

  it("filters by case-insensitive substring, honours limit and 404s unknown routes", async () => {
    const res = await fixtureFetch("/v1/foods?q=CHICKEN&limit=20");
    expect(res.ok).toBe(true);
    const { results } = await res.json();
    expect(results.length).toBeGreaterThan(0);
    for (const f of results) expect(f.name.toLowerCase()).toContain("chicken");

    const one = await (await fixtureFetch("/v1/foods?q=&limit=1")).json();
    expect(one.results).toHaveLength(1);

    const miss = await fixtureFetch("/v1/foods/barcode/999");
    expect(miss.status).toBe(404);
    expect(await miss.json()).toEqual({ error: { code: "not_found" } });
  });
});

describe("fixtureFetch multi-word queries", () => {
  it("matches when every query token is a substring of the name", async () => {
    const { results } = await (
      await fixtureFetch("/v1/foods?q=chicken%20breast&limit=20")
    ).json();
    expect(results.map((f) => f.name)).toEqual(["chicken, breast, roasted"]);
    const none = await (
      await fixtureFetch("/v1/foods?q=chicken%20banana&limit=20")
    ).json();
    expect(none.results).toEqual([]);
  });

  it("matches the product by exact barcode", async () => {
    const res = await fixtureFetch("/v1/foods/barcode/8934563138165");
    expect(res.ok).toBe(true);
    const { food } = await res.json();
    expect(food.source).toBe("open_food_facts");
  });
});
