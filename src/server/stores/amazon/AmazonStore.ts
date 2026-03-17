import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { StoreScraper } from '../Store';

function extractPrice(text: string): number | null {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const priceMatch = cleaned.match(/([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)/);
    if (priceMatch) {
        const joined = priceMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(joined);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
}

export const AmazonStore: StoreScraper = {
    name: 'amazon',
    async checkProduct({ url }) {
        console.log(`[AmazonStore] Checking ${url}`);

        let inStock: boolean | null = null;
        let price: number | null = null;
        let productName: string | null = null;
        let imageUrl: string | null = null;

        // Strategy 1: HTTP request
        try {
            const resp = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                },
                timeout: 15000,
                validateStatus: () => true,
            });

            if (resp.status === 200) {
                const html = resp.data as string;
                const $ = cheerio.load(html);

                // Check availability text
                const availabilityText = $('#availability span').text().trim().toLowerCase();
                if (availabilityText.includes('stokta') || availabilityText.includes('in stock')) {
                    inStock = true;
                } else if (availabilityText.includes('stokta yok') || availabilityText.includes('currently unavailable') || availabilityText.includes('mevcut değil')) {
                    inStock = false;
                }

                // Check add-to-cart button
                if (inStock === null) {
                    const hasAddToCart = $('#add-to-cart-button').length > 0;
                    const hasBuyNow = $('#buy-now-button').length > 0;
                    if (hasAddToCart || hasBuyNow) inStock = true;
                }

                // Extract price - Amazon has various price selectors
                const priceSelectors = [
                    '.a-price .a-offscreen',
                    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
                    '#priceblock_ourprice',
                    '#priceblock_dealprice',
                    '.apexPriceToPay .a-offscreen',
                    '#price_inside_buybox',
                    '.a-price-whole',
                ];

                for (const selector of priceSelectors) {
                    const priceText = $(selector).first().text().trim();
                    if (priceText) {
                        const extracted = extractPrice(priceText);
                        if (extracted) {
                            price = extracted;
                            break;
                        }
                    }
                }

                // JSON-LD fallback
                $('script[type="application/ld+json"]').each((i, el) => {
                    try {
                        const data = JSON.parse($(el).html() || '{}');
                        const items = Array.isArray(data) ? data : [data];
                        for (const item of items) {
                            if (item['@type'] === 'Product') {
                                if (!productName && item.name) productName = item.name;
                                if (!imageUrl && item.image) {
                                    const img = Array.isArray(item.image) ? item.image[0] : item.image;
                                    imageUrl = typeof img === 'string' ? img : (img?.contentUrl || null);
                                }
                                if (item.offers) {
                                    const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
                                    for (const offer of offers) {
                                        if (offer.availability && inStock === null) inStock = offer.availability.includes('InStock');
                                        if (offer.price && price === null) price = parseFloat(offer.price);
                                    }
                                }
                            }
                        }
                    } catch (e) { /* ignore */ }
                });

                // Fallback: OG tags and DOM for name/image
                if (!productName) productName = $('meta[property="og:title"]').attr('content') || $('#productTitle').text().trim() || null;
                if (!imageUrl) imageUrl = $('meta[property="og:image"]').attr('content') || $('#landingImage').attr('src') || null;

                if (inStock !== null) {
                    console.log(`[AmazonStore] HTTP Result: inStock=${inStock}, price=${price}, name=${productName}`);
                    return { inStock, price, source: 'http' as const, productName, imageUrl };
                }
                console.log(`[AmazonStore] HTTP partial result: inStock=${inStock}, price=${price}`);
            }
        } catch (e: any) {
            console.warn(`[AmazonStore] HTTP request failed: ${e.message}`);
        }

        // Strategy 2: Playwright browser (Amazon heavily blocks HTTP)
        if (process.env.RENDER_BROWSER === 'true') {
            console.log(`[AmazonStore] Launching browser fallback for ${url}`);
            let browser;
            try {
                browser = await chromium.launch({ headless: true });
                const context = await browser.newContext({
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                    locale: 'tr-TR',
                });
                const page = await context.newPage();
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
                await page.waitForTimeout(3000);

                const html = await page.content();
                const $ = cheerio.load(html);

                // Check availability
                const availText = $('#availability span').text().trim().toLowerCase();
                if (availText.includes('stokta')) inStock = true;
                else if (availText.includes('stokta yok') || availText.includes('mevcut değil')) inStock = false;

                if (inStock === null) {
                    if ($('#add-to-cart-button').length > 0) inStock = true;
                    else inStock = false;
                }

                // Extract price from rendered page
                const priceSelectors = ['.a-price .a-offscreen', '.apexPriceToPay .a-offscreen', '#priceblock_ourprice'];
                for (const selector of priceSelectors) {
                    const priceText = $(selector).first().text().trim();
                    if (priceText) {
                        const extracted = extractPrice(priceText);
                        if (extracted) { price = extracted; break; }
                    }
                }

                // Extract name/image from rendered page
                if (!productName) productName = $('meta[property="og:title"]').attr('content') || $('#productTitle').text().trim() || null;
                if (!imageUrl) imageUrl = $('meta[property="og:image"]').attr('content') || $('#landingImage').attr('src') || null;

                return { inStock: inStock ?? false, price, source: 'browser' as const, productName, imageUrl };
            } catch (e: any) {
                console.error(`[AmazonStore] Browser fallback failed: ${e.message}`);
            } finally {
                if (browser) await browser.close();
            }
        }

        return { inStock: inStock ?? false, price, source: 'http' as const, productName, imageUrl };
    },
};
