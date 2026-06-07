import { describe, it, expect } from "vitest";
import { inferColumnType, isMissing } from "../inferColumnTypes";

describe("isMissing", () => {
  it("treats null/undefined/empty/NA as missing", () => {
    expect(isMissing(null)).toBe(true);
    expect(isMissing(undefined)).toBe(true);
    expect(isMissing("")).toBe(true);
    expect(isMissing("  ")).toBe(true);
    expect(isMissing("NA")).toBe(true);
    expect(isMissing("n/a")).toBe(true);
    expect(isMissing("NULL")).toBe(true);
    expect(isMissing("NaN")).toBe(true);
  });
  it("treats normal values as present", () => {
    expect(isMissing(0)).toBe(false);
    expect(isMissing("hello")).toBe(false);
    expect(isMissing(false)).toBe(false);
  });
});

describe("inferColumnType", () => {
  it("returns unknown for all-missing", () => {
    expect(inferColumnType([null, "", "NA"], 0)).toBe("unknown");
  });
  it("detects integers", () => {
    expect(inferColumnType(["1", "2", "3", "4"], 1)).toBe("integer");
  });
  it("detects numeric with decimals", () => {
    expect(inferColumnType(["1.5", "2.0", "3.14"], 1)).toBe("numeric");
  });
  it("detects booleans", () => {
    expect(inferColumnType(["true", "false", "true"], 0.1)).toBe("boolean");
  });
  it("detects ISO dates", () => {
    expect(inferColumnType(["2024-01-01", "2024-02-01", "2024-03-01"], 1)).toBe("date");
  });
  it("detects ISO datetimes", () => {
    expect(
      inferColumnType(["2024-01-01T10:00:00", "2024-01-02T11:00:00", "2024-01-03T12:00:00"], 1),
    ).toBe("datetime");
  });
  it("flags low-cardinality strings as categorical", () => {
    const vals = Array.from({ length: 30 }, (_, i) =>
      i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C",
    );
    expect(inferColumnType(vals, 3 / 30)).toBe("categorical");
  });
  it("treats high-cardinality text as string", () => {
    const vals = Array.from({ length: 30 }, (_, i) => `item-${i}`);
    expect(inferColumnType(vals, 1)).toBe("string");
  });
  it("handles native JS types", () => {
    expect(inferColumnType([1, 2, 3], 1)).toBe("integer");
    expect(inferColumnType([1.1, 2.2], 1)).toBe("numeric");
    expect(inferColumnType([true, false], 0.1)).toBe("boolean");
    expect(inferColumnType([new Date(), new Date()], 1)).toBe("datetime");
  });
});
