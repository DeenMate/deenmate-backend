import { GoldPriceParser } from "../goldprice.parser";

describe("GoldPriceParser", () => {
  const parser = new GoldPriceParser();

  it("parses table-based HTML with gold categories", () => {
    const html = `
      <table>
        <thead><tr><th>Category</th><th>Price</th></tr></thead>
        <tbody>
          <tr><td>Gold 22K (Vori)</td><td>122,000</td></tr>
          <tr><td>Gold 21K (Vori)</td><td>115,500</td></tr>
          <tr><td>Silver (Vori)</td><td>1,600</td></tr>
        </tbody>
      </table>
    `;

    const items = parser.parse(html);
    expect(items.length).toBeGreaterThanOrEqual(3);
    const g22 = items.find((i) => /22K/.test(i.category));
    expect(g22).toBeTruthy();
    expect(g22?.price).toBe(122000);
  });

  it("handles Bangla numerals", () => {
    const html = `
      <table>
        <tbody>
          <tr><td>Gold 18K (Vori)</td><td>৯৫,০০০</td></tr>
        </tbody>
      </table>
    `;
    const items = parser.parse(html);
    expect(items[0].price).toBe(95000);
  });
});
