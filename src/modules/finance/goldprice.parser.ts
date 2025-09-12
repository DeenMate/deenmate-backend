import * as cheerio from "cheerio";
import { ParsedPriceItem } from "./goldprice.types";
import { MetalType } from "./goldprice.types";
import { normalizeBanglaNumberToFloat } from "./goldprice.utils";

export class GoldPriceParser {
  parse(html: string): ParsedPriceItem[] {
    const $ = cheerio.load(html);
    const results: ParsedPriceItem[] = [];

    // Parse Bajus website structure: tables with Product, Description, Price columns
    const tables = $("table");
    tables.each((_, table) => {
      const $table = $(table);
      
      $table.find("tbody tr").each((__, tr) => {
        const $tr = $(tr);
        
        // Get the product name from the <th scope="row"> element
        const productName = $tr.find("th h6").text().trim();
        if (!productName) return;
        
        // Get the price from the last <td> with class "price"
        const priceText = $tr.find("td .price").text().trim();
        if (!priceText) return;

        // Determine metal type from product name
        let metal: MetalType = MetalType.Gold;
        if (/silver/i.test(productName)) metal = MetalType.Silver;

        // Extract category from product name
        const catRaw = productName.replace(/\s+/g, " ").toUpperCase();
        let category = "UNKNOWN";
        if (/22\s*KARAT/.test(catRaw)) category = "22K";
        else if (/21\s*KARAT/.test(catRaw)) category = "21K";
        else if (/18\s*KARAT/.test(catRaw)) category = "18K";
        else if (/24\s*KARAT/.test(catRaw)) category = "24K";
        else if (/TRADITIONAL/.test(catRaw)) category = "TRADITIONAL";

        // Extract unit from price text (e.g., "15,673 BDT/GRAM" -> "Gram")
        let unit = "Gram"; // default
        if (/VORI/i.test(priceText)) unit = "Vori";
        else if (/GRAM/i.test(priceText)) unit = "Gram";

        // Extract numeric price (remove BDT, commas, etc.)
        const price = normalizeBanglaNumberToFloat(priceText);

        if (!isNaN(price)) {
          results.push({ metal, category, unit, price });
        }
      });
    });

    // Fallback: try simple table parsing
    if (results.length === 0) {
      $("table tbody tr").each((_, tr) => {
        const $tr = $(tr);
        const cells = $tr.find("td");
        if (cells.length >= 2) {
          const categoryText = $(cells[0]).text().trim();
          const priceText = $(cells[1]).text().trim();
          
          if (categoryText && priceText && /(22K|21K|18K|Traditional|Silver)/i.test(categoryText)) {
            const metal = /silver/i.test(categoryText)
              ? MetalType.Silver
              : MetalType.Gold;
            const categoryMatch = categoryText.match(/(22K|21K|18K|Traditional|Silver)/i);
            const category = categoryMatch
              ? categoryMatch[1].toUpperCase().replace("TRADITION", "TRADITIONAL")
              : "UNKNOWN";
            const unit = /gram/i.test(categoryText) ? "Gram" : "Vori";
            
            try {
              const price = normalizeBanglaNumberToFloat(priceText);
              results.push({ metal, category, unit, price });
            } catch (error) {
              // Skip invalid prices
            }
          }
        }
      });
    }

    return results;
  }
}
