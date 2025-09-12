import {
  detectChangeDirection,
  normalizeBanglaNumberToFloat,
} from "../goldprice.utils";
import { PriceChangeDirection } from "../goldprice.types";

describe("goldprice.utils", () => {
  it("detectChangeDirection works", () => {
    expect(detectChangeDirection(null, 100)).toBeNull();
    expect(detectChangeDirection(90, 100)).toBe(PriceChangeDirection.Up);
    expect(detectChangeDirection(110, 100)).toBe(PriceChangeDirection.Down);
    expect(detectChangeDirection(100, 100)).toBe(
      PriceChangeDirection.Unchanged,
    );
  });

  it("normalizeBanglaNumberToFloat handles en and bn numerals", () => {
    expect(normalizeBanglaNumberToFloat("122,000")).toBe(122000);
    expect(normalizeBanglaNumberToFloat("৯৫,০০০")).toBe(95000);
    expect(normalizeBanglaNumberToFloat("৳ 1,600")).toBe(1600);
  });
});
