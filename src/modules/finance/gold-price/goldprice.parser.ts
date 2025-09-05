import * as cheerio from 'cheerio';
import { MetalType, ParsedPriceItem } from './goldprice.types';
import { normalizeBanglaNumberToFloat } from './goldprice.utils';

export class GoldPriceParser {
  parse(html: string): ParsedPriceItem[] {
    const $ = cheerio.load(html);
    const results: ParsedPriceItem[] = [];

    // The Bajus page structure may change; this parser is defensive.
    // Look for tables containing Gold and Silver price rows.
    const tables = $('table');
    tables.each((_, table) => {
      const $table = $(table);
      const headers: string[] = [];
      $table.find('thead tr th').each((__, th) => headers.push($(th).text().trim()));

      $table.find('tbody tr').each((__, tr) => {
        const cells = $(tr).find('td');
        if (cells.length < 2) return;
        const firstCell = $(cells[0]).text().trim();
        const priceCell = $(cells[cells.length - 1]).text().trim();

        if (!firstCell || !priceCell) return;

        // Determine metal and category heuristically
        let metal: MetalType = MetalType.Gold;
        if (/silver/i.test(firstCell)) metal = MetalType.Silver;

        // Category and unit inference
        const categoryMatch = firstCell.match(/(22K|21K|18K|Traditional|Tradition|Silver)/i);
        const category = categoryMatch ? categoryMatch[1].toUpperCase().replace('TRADITION', 'TRADITIONAL') : firstCell;
        const unit = /gram/i.test(firstCell) ? 'Gram' : 'Vori';

        // Extract numeric price
        const price = normalizeBanglaNumberToFloat(priceCell);

        results.push({ metal, category, unit, price });
      });
    });

    // Fallback: try list items or divs
    if (results.length === 0) {
      $('li, div').each((_, el) => {
        const text = $(el).text().trim();
        if (!text) return;
        if (/(22K|21K|18K|Traditional|Silver)/i.test(text) && /[0-9]/.test(text)) {
          const metal = /silver/i.test(text) ? MetalType.Silver : MetalType.Gold;
          const categoryMatch = text.match(/(22K|21K|18K|Traditional|Silver)/i);
          const category = categoryMatch ? categoryMatch[1].toUpperCase().replace('TRADITION', 'TRADITIONAL') : 'UNKNOWN';
          const unit = /gram/i.test(text) ? 'Gram' : 'Vori';
          const priceMatch = text.match(/([0-9০-৯,.]+)\s*(BDT|Tk|৳)?/);
          if (priceMatch) {
            const price = normalizeBanglaNumberToFloat(priceMatch[1]);
            results.push({ metal, category, unit, price });
          }
        }
      });
    }

    return results;
  }
}


