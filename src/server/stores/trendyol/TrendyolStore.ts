import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { StoreScraper } from '../Store';

function extractPrice(text: string): number | null {
  // Matches "8.560,00 TL" or "659,95 TL" or "5.404,82 TL"
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

    if (resp.status >= 400 && resp.status !== 403 && resp.status !== 429) {
      throw new Error(`Trendyol returned unexpected HTTP status: ${resp.status}`);
    }

    const html = resp.data as string;
    const $ = cheerio.load(html);

    let inStock: boolean | null = null;
    let price: number | null = null;
    let productName: string | null = null;
    let imageUrl: string | null = null;

    // Extract Product ID from URL
    const urlMatch = url.match(/-p-([0-9]+)/);
    const targetSku = urlMatch ? urlMatch[1] : null;

    // 1. Primary Strategy: Check structured Schema.org JSON-LD data
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const data = JSON.parse($(el).html() || '{}');

        let items: any[] = [];
        if (Array.isArray(data)) {
          items = data;
        } else if (data.hasVariant && Array.isArray(data.hasVariant)) {
          items = [data, ...data.hasVariant];
        } else {
          items = [data];
        }

        for (const item of items) {
          if (!productName && item.name) productName = item.name;
          if (!imageUrl && item.image) {
            const img = Array.isArray(item.image) ? item.image[0] : item.image;
            if (typeof img === 'string') imageUrl = img;
            else if (img && img.contentUrl) imageUrl = Array.isArray(img.contentUrl) ? img.contentUrl[0] : img.contentUrl;
          }

          // In Trendyol, if 'size' is provided, we want to match that specific variant
          // Variants in JSON-LD often have their own SKU or name including size
          const itemSku = item.sku || '';
          const itemName = (item.name || '').toLowerCase();
          const itemDesc = (item.description || '').toLowerCase();
          
          let sizeMatch = true;
          if (size) {
            const sizeLower = size.toLowerCase();
            sizeMatch = itemName.includes(sizeLower) || 
                        itemDesc.includes(sizeLower) || 
                        (item.name && item.name.includes(size)) ||
                        (item.sku === size); // Sometimes size is sku-like
          }

          const skuMatch = targetSku ? (itemSku === targetSku) : true;

          if (skuMatch && sizeMatch && item.offers && item.offers.availability) {
            if (inStock === null) inStock = item.offers.availability.includes('InStock');
            if (price === null) {
              if (item.offers.price) price = parseFloat(item.offers.price);
              else if (item.offers.lowPrice) price = parseFloat(item.offers.lowPrice);
              else if (item.offers.highPrice) price = parseFloat(item.offers.highPrice);
            }
            if (targetSku && size) break;
          }
        }
      } catch (e) { }
    });

    // 2. Secondary Strategy: Extract from window.__PRODUCT_DETAIL_APP_CONF__
    if (price === null || inStock === null) {
      const configMatch = html.match(/window\.__PRODUCT_DETAIL_APP_CONF__\s*=\s*({.*?});/);
      if (configMatch) {
        try {
          const config = JSON.parse(configMatch[1]);
          const productData = config.product;
          
          if (productData) {
            if (!productName) productName = productData.name;
            
            // Check variants for size match
            if (size && productData.variants) {
              const targetSize = size.toLowerCase();
              const variant = productData.variants.find((v: any) => 
                v.attributeValue?.toLowerCase() === targetSize || 
                v.value?.toLowerCase() === targetSize
              );
              
              if (variant) {
                if (inStock === null) inStock = variant.inStock;
                if (price === null && variant.price?.sellingPrice) {
                  price = variant.price.sellingPrice;
                }
              }
            }

            // Fallback to default price if not found via variant
            if (price === null && productData.price?.sellingPrice) {
              price = productData.price.sellingPrice;
            }
            
            if (inStock === null && productData.inStock !== undefined) {
              inStock = productData.inStock;
            }
          }
        } catch (e) { }
      }
    }

    // Fallback: OG tags
    if (!productName) productName = $('meta[property="og:title"]').attr('content') || $('title').text().split('|')[0]?.trim() || null;
    if (!imageUrl) imageUrl = $('meta[property="og:image"]').attr('content') || null;

    // 3. Heuristics on DOM elements
    if (inStock === null) {
      const addToBasketBtn = $('.add-to-basket-button').length > 0 || $('.add-to-bs-tx').length > 0;
      const isOut = $('.sold-out').length > 0 || $('.tükendi').length > 0 || $('.stokta-yok').length > 0;
      inStock = addToBasketBtn && !isOut;
    }

    if (price === null) {
      const priceText = $('.prc-dsc').text() || $('.prc-slg').text() || $('.product-price-container').text();
      if (priceText) {
        price = extractPrice(priceText);
      }
    }

    let source: 'http' | 'browser' = 'http';

    // 4. Fallback: Browser rendering
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

        // Repeat the same logic in browser-rendered content
        // (Similar logic could be refactored, but keeping it direct for now)
        $$('script[type="application/ld+json"]').each((i, el) => {
          try {
            const data = JSON.parse($$(el).html() || '{}');
            if (data.offers && data.offers.price && price === null) price = parseFloat(data.offers.price);
            if (data.offers && data.offers.availability && inStock === null) inStock = data.offers.availability.includes('InStock');
          } catch (e) { }
        });

        // Search config object in rendered content
        const configMatchR = content.match(/window\.__PRODUCT_DETAIL_APP_CONF__\s*=\s*({.*?});/);
        if (configMatchR && (price === null || inStock === null)) {
            try {
                const config = JSON.parse(configMatchR[1]);
                if (price === null) price = config.product?.price?.sellingPrice || null;
                if (inStock === null) inStock = config.product?.inStock ?? null;
            } catch(e) {}
        }

        if (inStock === null) {
          const hasBuyR = $$('.add-to-basket-button').length > 0 || $$('.add-to-bs-tx').length > 0;
          const isOutR = $$('.sold-out').length > 0 || $$('.tükendi').length > 0;
          inStock = hasBuyR && !isOutR;
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
