import { moveItem } from "./arrayUtils";

describe("moveItem", () => {
  it("moves an element forward", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("moves an element backward", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("returns the same reference when `to` is out of bounds", () => {
    const arr = ["a", "b"];
    expect(moveItem(arr, 0, 2)).toBe(arr);
    expect(moveItem(arr, 0, -1)).toBe(arr);
  });

  it("does not mutate the original array", () => {
    const arr = ["a", "b", "c"];
    moveItem(arr, 0, 2);
    expect(arr).toEqual(["a", "b", "c"]);
  });
});
