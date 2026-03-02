import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { StoreScraper } from '../Store';

function extractPrice(text: string): number | null {
  // Matches "8.560,00 TL" or "659,95 TL"
  const priceMatch = text.match(/([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)[.,][0-9]{2}\s*tl/i);
  if (priceMatch) {
    const cleanStr = priceMatch[0].replace(/\s*tl/i, '').trim();
    const joined = cleanStr.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(joined);
    return Number.isNaN(parsed) ? null : parsed;
  }

  // Try without decimals: "5600 tl"
  const noDecimalsMatch = text.match(/([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)\s*tl/i);
  if (noDecimalsMatch) {
    const joined = noDecimalsMatch[1].replace(/\./g, '');
    const parsed = parseFloat(joined);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export const TrendyolStore: StoreScraper = {
  name: 'trendyol',
  async checkProduct({ url, size }) {
    console.log(`[TrendyolStore] Checking ${url}`);
    const resp = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      // Do not throw on error, let it pass so we can catch 403 vs 404
      validateStatus: () => true,
    });

    if (resp.status === 404) {
      return { inStock: false, price: null, source: 'http' };
    }

    if (resp.status >= 400 && resp.status !== 403 && resp.status !== 429) {
      throw new Error(`Trendyol returned unexpected HTTP status: ${resp.status}`);
    }

    const html = resp.data as string;
    const $ = cheerio.load(html);

    let inStock: boolean | null = null;
    let price: number | null = null;
    let productName: string | null = null;
    let imageUrl: string | null = null;

    // Extract Product ID from URL to match exact variant
    const urlMatch = url.match(/-p-([0-9]+)/);
    const targetSku = urlMatch ? urlMatch[1] : null;

    // 1. Primary Strategy: Check structured Schema.org JSON-LD data
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');

        // Flatten ProductGroups and single items into an array to search
        let items: any[] = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (data.hasVariant && Array.isArray(data.hasVariant)) {
          items = [data, ...data.hasVariant];
        } else {
          items = [data];
        }

        for (const item of items) {
          // Extract name and image from the top-level product
          if (!productName && item.name) productName = item.name;
          if (!imageUrl && item.image) {
            const img = Array.isArray(item.image) ? item.image[0] : item.image;
            if (typeof img === 'string') {
              imageUrl = img;
            } else if (img && img.contentUrl) {
              imageUrl = Array.isArray(img.contentUrl) ? img.contentUrl[0] : img.contentUrl;
            }
          }

          // If we have a target SKU, ONLY match that sku
          const isTargetMatch = targetSku ? (item.sku === targetSku) : true;

          if (isTargetMatch && item.offers && item.offers.availability) {
            if (inStock === null) inStock = item.offers.availability.includes('InStock');
            if (price === null) {
              if (item.offers.price) price = parseFloat(item.offers.price);
              else if (item.offers.lowPrice) price = parseFloat(item.offers.lowPrice);
              else if (item.offers.highPrice) price = parseFloat(item.offers.highPrice);
            }

            if (targetSku) break;
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    });

    // Fallback: OG tags for name/image
    if (!productName) productName = $('meta[property="og:title"]').attr('content') || $('title').text().split('|')[0]?.trim() || null;
    if (!imageUrl) imageUrl = $('meta[property="og:image"]').attr('content') || null;

    // 2. Secondary Strategy: Heuristics on DOM elements
    if (inStock === null) {
      const addToBasketBtn = $('.add-to-basket-button').length > 0 || $('.add-to-bs-tx').length > 0;
      const isOut = $('.sold-out').length > 0;
      inStock = addToBasketBtn && !isOut;
    }

    if (price === null) {
      const priceText = $('.prc-dsc').text() || $('.prc-slg').text();
      if (priceText) {
        price = extractPrice(priceText);
      }
    }

    let source: 'http' | 'browser' = 'http';

    // 3. Fallback: Browser rendering (Playwright) if we are still out of stock or couldn't parse
    const isBlocked = productName?.includes('Attention Required') || (inStock === null && !productName);
    const shouldRender = (isBlocked || !inStock) && process.env.RENDER_BROWSER === 'true';
    if (shouldRender) {
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

        let renderedInStock: boolean | null = null;
        $$('script[type="application/ld+json"]').each((i, el) => {
          try {
            const data = JSON.parse($$(el).html() || '{}');
            if ((!productName || productName.includes('Attention Required')) && data.name) productName = data.name;
            if (!imageUrl && data.image) {
              const img = Array.isArray(data.image) ? data.image[0] : data.image;
              if (typeof img === 'string') {
                imageUrl = img;
              } else if (img && img.contentUrl) {
                imageUrl = Array.isArray(img.contentUrl) ? img.contentUrl[0] : img.contentUrl;
              }
            }
            if (data.offers && data.offers.availability) {
              if (renderedInStock === null) renderedInStock = data.offers.availability.includes('InStock');
              if (price === null && data.offers.price) price = parseFloat(data.offers.price);
            }
          } catch (e) { }
        });

        if (renderedInStock !== null) {
          inStock = renderedInStock;
        } else {
          const hasBuyR = $$('.add-to-basket-button').length > 0 || $$('.add-to-bs-tx').length > 0;
          const isOutR = $$('.sold-out').length > 0;
          inStock = hasBuyR && !isOutR;
        }

        if (price === null) {
          const priceTextR = $$('.prc-dsc').text() || $$('.prc-slg').text();
          if (priceTextR) {
            price = extractPrice(priceTextR);
          } else {
            price = extractPrice(content);
          }
        }

        if (!productName || productName.includes('Attention Required')) {
          const ogTitle = $$('meta[property="og:title"]').attr('content');
          if (ogTitle && !ogTitle.includes('Attention Required')) productName = ogTitle;
        }
        if (!imageUrl) {
          const ogImg = $$('meta[property="og:image"]').attr('content');
          if (ogImg) imageUrl = ogImg;
        }

        source = 'browser';
      } catch (err: any) {
        console.warn(`[TrendyolStore] Browser fallback failed for ${url}: ${err.message}`);
      }
    }

    return { inStock: inStock ?? false, price, source, size: size ?? null, productName, imageUrl };
  },
};
