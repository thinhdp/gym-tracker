import { beforeEach, vi } from "vitest";
import { buildCacheKey, fetchPercentile, fetchPercentiles } from "./fvApi";
import { K_FV_CACHE } from "./storage";

beforeEach(() => {
  localStorage.clear();
});

const ok = (json) => ({ ok: true, status: 200, json: async () => json });

describe("buildCacheKey", () => {
  it("rounds weight/bodyweight to 0.5 kg so near-identical maxes share a key", () => {
    const base = { lift: "deadlift", sex: "male", unit: "kg", age: 30 };
    expect(buildCacheKey({ ...base, weight: 120.1, bodyweight: 70.2 })).toBe(
      buildCacheKey({ ...base, weight: 120.0, bodyweight: 70.0 }),
    );
  });

  it("treats missing age as the 'all' cohort", () => {
    expect(
      buildCacheKey({
        lift: "squat",
        sex: "male",
        weight: 100,
        bodyweight: 70,
      }),
    ).toContain("all");
  });
});

describe("fetchPercentile", () => {
  it("POSTs the lift and returns the dual percentile", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      ok({
        verified: { percentile: 75, tier: "advanced" },
        gym: { percentile: 68, tier: "intermediate" },
      }),
    );
    const res = await fetchPercentile(
      { lift: "deadlift", weight: 150, bodyweight: 70, sex: "male", age: 30 },
      { fetchImpl },
    );
    expect(res.gym.tier).toBe("intermediate");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/\/percentile$/);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      lift: "deadlift",
      weight: 150,
      reps: 1,
      age: 30,
    });
  });

  it("serves a cached result without a second request", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ gym: { percentile: 50 } }));
    const args = { lift: "squat", weight: 100, bodyweight: 70, sex: "male" };
    await fetchPercentile(args, { fetchImpl });
    await fetchPercentile(args, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(loadCache()["squat|male|all|kg|100|70"]).toBeTruthy();
  });

  it("bypasses the cache when cache:false but still records it", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ gym: { percentile: 50 } }));
    const args = { lift: "squat", weight: 100, bodyweight: 70, sex: "male" };
    await fetchPercentile(args, { fetchImpl, cache: true });
    await fetchPercentile(args, { fetchImpl, cache: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(
      fetchPercentile(
        { lift: "squat", weight: 100, bodyweight: 70, sex: "male" },
        { fetchImpl },
      ),
    ).rejects.toThrow(/429/);
  });
});

describe("fetchPercentiles", () => {
  it("resolves a batch and isolates individual failures", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(ok({ gym: { percentile: 60 } }))
      .mockRejectedValueOnce(new Error("network down"));
    const res = await fetchPercentiles(
      [
        {
          key: "squat",
          lift: "back_squat",
          weight: 140,
          bodyweight: 70,
          sex: "male",
        },
        {
          key: "bench",
          lift: "bench_press",
          weight: 100,
          bodyweight: 70,
          sex: "male",
        },
      ],
      { fetchImpl },
    );
    expect(res.squat.gym.percentile).toBe(60);
    expect(res.bench.error).toMatch(/network down/);
  });
});

function loadCache() {
  return JSON.parse(localStorage.getItem(K_FV_CACHE) || "{}");
}
