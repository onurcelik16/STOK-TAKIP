import axios from 'axios';
import * as cheerio from 'cheerio';
import { StoreScraper } from '../Store';

// Generic demo: if selector provided, exists => inStock, and tries to parse price attribute/text
// Otherwise, always true to simulate availability
export const DemoStore: StoreScraper = {
  name: 'demo',
  async checkProduct({ url, selector, size }) {
    try {
      const resp = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = resp.data as string;
      if (selector) {
        const $ = cheerio.load(html);
        const el = $(selector);
        const inStock = el.length > 0;
        let price: number | null = null;
        const priceText = el.text().trim() || el.attr('content') || '';
        const matched = priceText.replace(/[^0-9.,]/g, '').replace(',', '.');
        const parsed = parseFloat(matched);
        if (!Number.isNaN(parsed)) price = parsed;
        return { inStock, price, source: 'http', size: size ?? null };
      }
      return { inStock: true, price: null, source: 'http', size: size ?? null };
    } catch {
      return { inStock: false, price: null, source: 'http', size: size ?? null };
    }
  },
};



