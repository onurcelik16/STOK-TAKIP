import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { StoreScraper } from '../Store';

function findPriceDeep(obj: any): number | null {
  if (typeof obj !== 'object' || obj === null) return null;
  
  if (obj.sellingPrice !== undefined) {
    const p = parseFloat(obj.sellingPrice.toString().replace(',', '.'));
    if (!Number.isNaN(p) && p > 0) return p;
  }
  if (obj.price !== undefined && obj['@type'] === 'Offer') {
    const p = parseFloat(obj.price.toString().replace(',', '.'));
    if (!Number.isNaN(p) && p > 0) return p;
  }
  if (obj.price !== undefined && typeof obj.price === 'number') return obj.price;

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const result = findPriceDeep(obj[key]);
      if (result !== null) return result;
    }
  }
  return null;
}

function extractPrice(text: string): number | null {
  const regex = /([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)(?:,[0-9]{2})?\s*tl/gi;
  const matches = Array.from(text.matchAll(regex));
  
  if (matches.length === 0) return null;

  const parsedPrices = matches.map(match => {
    const raw = match[0].toLowerCase().replace(/\s*tl/i, '').trim();
    const joined = raw.replace(/\./g, '').replace(',', '.');
    return parseFloat(joined);
  }).filter(p => !Number.isNaN(p));

  if (parsedPrices.length === 0) return null;
  return Math.max(...parsedPrices);
}

export const TrendyolStore: StoreScraper = {
  name: 'trendyol',
  async checkProduct({ url, size }) {
    console.log(`[TrendyolStore] Checking ${url} (Size: ${size || 'N/A'})`);
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      validateStatus: () => true,
    });

    if (resp.status === 404) {
      return { inStock: false, price: null, source: 'http' };
    }

    const html = resp.data as string;
    const $ = cheerio.load(html);

    let inStock: boolean | null = null;
    let price: number | null = null;
    let productName: string | null = null;
    let imageUrl: string | null = null;

    const urlMatch = url.match(/-p-([0-9]+)/);
    const targetSku = urlMatch ? urlMatch[1] : null;

    // 1. JSON-LD Strategy
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');
        const p = findPriceDeep(data);
        if (p !== null && price === null) price = p;
        
        let items: any[] = Array.isArray(data) ? data : (data.hasVariant ? [data, ...data.hasVariant] : [data]);
        for (const item of items) {
          if (!productName && item.name) productName = item.name;
          if (!imageUrl && item.image) {
            const img = Array.isArray(item.image) ? item.image[0] : item.image;
            imageUrl = typeof img === 'string' ? img : (img?.contentUrl ? (Array.isArray(img.contentUrl) ? img.contentUrl[0] : img.contentUrl) : imageUrl);
          }

          if (size) {
            const sl = size.toLowerCase();
            const sm = (item.name || '').toLowerCase().includes(sl) || (item.description || '').toLowerCase().includes(sl) || item.sku === size;
            if (sm && item.offers?.availability) {
                if (inStock === null) inStock = item.offers.availability.includes('InStock');
            }
          } else if (item.offers?.availability && inStock === null) {
              inStock = item.offers.availability.includes('InStock');
          }
        }
      } catch (e) { }
    });

    // 2. Global Script Strategy (Puzzle/Fragment Props)
    if (price === null) {
        $('script').each((i, el) => {
            const content = $(el).html() || '';
            if (content.includes('sellingPrice') || content.includes('__envoy') || content.includes('PRODUCT_DETAIL')) {
                // Try to find the price directly via regex in this script
                const spm = content.match(/"sellingPrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
                if (spm) price = parseFloat(spm[1]);
                
                if (price === null) {
                    const pm = content.match(/"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
                    if (pm) price = parseFloat(pm[1]);
                }
            }
        });
    }

    // 3. Fallback: window.__PRODUCT_DETAIL_APP_CONF__ multiline
    if (price === null || inStock === null) {
      const configMatch = html.match(/window\.__PRODUCT_DETAIL_APP_CONF__\s*=\s*({[\s\S]*?});/);
      if (configMatch) {
        try {
          const config = JSON.parse(configMatch[1]);
          if (price === null) price = findPriceDeep(config);
          if (inStock === null && config.product) {
              if (size && config.product.variants) {
                  const targetSize = size.toLowerCase();
                  const variant = config.product.variants.find((v: any) => v.attributeValue?.toLowerCase() === targetSize || v.value?.toLowerCase() === targetSize);
                  if (variant) inStock = variant.inStock;
              }
              if (inStock === null) inStock = config.product.inStock;
          }
        } catch (e) { }
      }
    }

    // 4. Global regex on whole HTML (tracking scripts vs. visible text)
    if (price === null) {
        const globalPriceMatch = html.match(/epn\.ecomm_totalvalue=([0-9]+)/);
        if (globalPriceMatch) {
            price = parseFloat(globalPriceMatch[1]);
        }
    }

    // 4.1 Last-resort: try to extract any TL price from full HTML
    if (price === null) {
        const anyPrice = extractPrice(html);
        if (anyPrice !== null) {
            price = anyPrice;
        }
    }

    // Metadata Fallbacks
    if (!productName) productName = $('meta[property="og:title"]').attr('content') || $('title').text().split('|')[0]?.trim() || null;
    if (!imageUrl) imageUrl = $('meta[property="og:image"]').attr('content') || null;

    // In-stock Heuristics
    if (inStock === null) {
      if (size) {
        // If size was requested but not found in variants/LD-JSON above, we should assume it's out of stock
        // or the size label is wrong. To be safe for the user, if strict size check fails, we mark as false.
        inStock = false;
      } else {
        const hasBuy = $('.add-to-basket-button').length > 0 || $('.add-to-bs-tx').length > 0;
        const isOut = $('.sold-out').length > 0 || $('.tükendi').length > 0 || $('.stokta-yok').length > 0;
        inStock = hasBuy && !isOut;
      }
    }

    // Price Heuristics
    if (price === null) {
      const priceText = $('.prc-dsc').text() || $('.prc-slg').text() || $('.product-price-container').text();
      if (priceText) price = extractPrice(priceText);
      else {
          const area = $('.product-detail-wrapper').text();
          if (area) price = extractPrice(area);
      }
    }

    let source: 'http' | 'browser' = 'http';

    // 5. Browser Fallback
    const renderBrowserEnabled = process.env.RENDER_BROWSER === 'true';
    if ((price === null || productName?.includes('Attention Required')) && renderBrowserEnabled) {
      console.log(`[TrendyolStore] Launching browser fallback for ${url}`);
      try {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
          locale: 'tr-TR',
        });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        const content = await page.content();
        await browser.close();

        const $$ = cheerio.load(content);
        if (price === null) {
            $$('script[type="application/ld+json"]').each((i, el) => {
                const data = JSON.parse($$(el).html() || '{}');
                const p = findPriceDeep(data);
                if (p !== null) price = p;
            });
        }
        if (price === null) {
            const priceTextR = $$('.prc-dsc').text() || $$('.prc-slg').text() || $$('.product-price-container').text();
            if (priceTextR) price = extractPrice(priceTextR);
            else price = extractPrice(content);
        }
        source = 'browser';
      } catch (err: any) {
        console.warn(`[TrendyolStore] Browser fallback failed for ${url}: ${err.message}`);
      }
    }

    return { inStock: inStock ?? false, price, source, size: size ?? null, productName, imageUrl };
  },
};
