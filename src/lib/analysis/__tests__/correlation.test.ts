import { describe, it, expect } from "vitest";
import { correlationMatrix } from "../correlation";

describe("correlationMatrix", () => {
  it("returns r=1 on the diagonal and detects perfect positive correlation", () => {
    const rows = [
      { a: 1, b: 2, c: 10 },
      { a: 2, b: 4, c: 5 },
      { a: 3, b: 6, c: 2 },
      { a: 4, b: 8, c: 1 },
    ];
    const m = correlationMatrix(rows, ["a", "b", "c"]);
    expect(m.values[0][0]).toBe(1);
    expect(m.values[0][1]).toBeCloseTo(1, 5);
    expect(m.values[0][2]).toBeLessThan(0); // a vs c: negative
  });

  it("marks constant column pairs as null", () => {
    const rows = [
      { a: 1, k: 5 },
      { a: 2, k: 5 },
      { a: 3, k: 5 },
    ];
    const m = correlationMatrix(rows, ["a", "k"]);
    expect(m.values[0][1]).toBeNull();
    expect(m.values[1][0]).toBeNull();
  });

  it("symmetric matrix", () => {
    const rows = [
      { a: 1, b: 4 },
      { a: 2, b: 3 },
      { a: 3, b: 2 },
      { a: 4, b: 1 },
    ];
    const m = correlationMatrix(rows, ["a", "b"]);
    expect(m.values[0][1]).toBe(m.values[1][0]);
  });
});
