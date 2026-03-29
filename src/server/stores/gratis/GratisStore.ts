import axios from 'axios';
import * as cheerio from 'cheerio';
import { StoreScraper } from '../Store';

/**
 * Extract a numeric price from Turkish-format text.
 * Handles: "1.234,56 TL", "227,50 ₺", "569,00", plain numbers.
 */
function extractPrice(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/\s+/g, ' ').trim();

    // 1. Turkish format: "1.234,56" or "234,56"
    const trMatch = cleaned.match(/([0-9]{1,3}(?:\.[0-9]{3})*[,][0-9]{2})/);
    if (trMatch) {
        const joined = trMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(joined);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }

    // 2. Plain comma-decimal (no thousands): "227,50"
    const commaDecimal = cleaned.match(/([0-9]+)[,]([0-9]{2})(?:\s|$|₺|TL|tl)/);
    if (commaDecimal) {
        const parsed = parseFloat(`${commaDecimal[1]}.${commaDecimal[2]}`);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }

    // 3. International: "1234.56"
    const intMatch = cleaned.match(/([0-9]+\.[0-9]{2})(?:\s|$|₺|TL|tl)/);
    if (intMatch) {
        const parsed = parseFloat(intMatch[1]);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }

    return null;
}

/**
 * From a JSON-LD offer object, return the LOWEST price found
 * across all price fields (price, lowPrice, salePrice, specialPrice, etc.).
 */
function getLowestOfferPrice(offer: any): number | null {
    const candidates: number[] = [];

    const fields = ['price', 'lowPrice', 'salePrice', 'specialPrice', 'currentPrice', 'minPrice'];
    for (const field of fields) {
        const val = offer[field];
        if (val != null) {
            const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : Number(val);
            if (!Number.isNaN(n) && n > 0) candidates.push(n);
        }
    }

    return candidates.length > 0 ? Math.min(...candidates) : null;
}

/**
 * Recursively find all JSON-LD nodes typed "Product" or "AggregateOffer".
 */
function findOffersAndProducts(data: any): { products: any[]; aggregateOffers: any[] } {
    const products: any[] = [];
    const aggregateOffers: any[] = [];

    function walk(node: any) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }
        if (node['@type'] === 'Product') products.push(node);
        if (node['@type'] === 'AggregateOffer') aggregateOffers.push(node);
        if (node['@graph']) walk(node['@graph']);
        if (node.hasVariant) walk(node.hasVariant);
    }

    walk(data);
    return { products, aggregateOffers };
}

export const GratisStore: StoreScraper = {
    name: 'gratis',
    async checkProduct({ url }) {
        console.log(`[GratisStore] Checking ${url}`);

        let inStock: boolean | null = null;
        let price: number | null = null;
        let productName: string | null = null;
        let imageUrl: string | null = null;

        try {
            const resp = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Cache-Control': 'no-cache',
                },
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: () => true,
            });

            if (resp.status < 200 || resp.status >= 400) {
                console.warn(`[GratisStore] HTTP ${resp.status} for ${url}`);
                return { inStock: false, price: null, source: 'http' as const };
            }

            const $ = cheerio.load(resp.data);

            // ================================================================
            // 1. JSON-LD — prefer the LOWEST price across all price fields
            // ================================================================
            const allPricesFromLd: number[] = [];

            $('script[type="application/ld+json"]').each((_, el) => {
                try {
                    const raw = JSON.parse($(el).html() || '{}');
                    const { products, aggregateOffers } = findOffersAndProducts(raw);

                    // AggregateOffer: lowPrice is exactly what we want
                    for (const agg of aggregateOffers) {
                        const p = getLowestOfferPrice(agg);
                        if (p) allPricesFromLd.push(p);
                        if (agg.availability && inStock === null) {
                            inStock = String(agg.availability).includes('InStock');
                        }
                    }

                    for (const product of products) {
                        if (!productName && product.name) productName = product.name;
                        if (!imageUrl && product.image) {
                            const img = Array.isArray(product.image) ? product.image[0] : product.image;
                            imageUrl = typeof img === 'string' ? img : (img?.contentUrl || img?.url || null);
                        }

                        if (product.offers) {
                            const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
                            for (const offer of offers) {
                                if (offer['@type'] === 'AggregateOffer') {
                                    const p = getLowestOfferPrice(offer);
                                    if (p) allPricesFromLd.push(p);
                                } else {
                                    const p = getLowestOfferPrice(offer);
                                    if (p) allPricesFromLd.push(p);
                                }

                                if (offer.availability && inStock === null) {
                                    inStock = String(offer.availability).includes('InStock');
                                }
                            }
                        }
                    }
                } catch (e) { /* ignore parse errors */ }
            });

            if (allPricesFromLd.length > 0) {
                price = Math.min(...allPricesFromLd);
                console.log(`[GratisStore] JSON-LD prices found: [${allPricesFromLd.join(', ')}] → using lowest: ${price}`);
            }

            // ================================================================
            // 2. Gratis DOM — campaign/discount price selectors (tried first)
            //    These target the promotional Gratis Kart price specifically.
            // ================================================================
            if (price === null) {
                // Ordered from most-specific (campaign price) to least-specific (general price)
                const gratisDiscountSelectors = [
                    // Gratis campaign/card specific
                    '[class*="campaignPrice"]',
                    '[class*="campaign-price"]',
                    '[class*="CampaignPrice"]',
                    '[class*="specialPrice"]',
                    '[class*="special-price"]',
                    '[class*="discountPrice"]',
                    '[class*="discount-price"]',
                    '[class*="salePrice"]',
                    '[class*="sale-price"]',
                    '[class*="gratis-price"]',
                    '[class*="GratisPrice"]',
                    // Magento/e-comm patterns Gratis may use
                    '.special-price .price',
                    '.price-box .special-price',
                    '[data-price-type="finalPrice"]',
                    '[data-price-type="minPrice"]',
                    'meta[property="product:sale_price:amount"]',
                    'meta[name="twitter:data1"]',
                ];

                for (const sel of gratisDiscountSelectors) {
                    try {
                        const el = $(sel).first();
                        if (!el.length) continue;
                        const content = el.attr('content') || el.attr('data-price') || el.text().trim();
                        if (content) {
                            const extracted = extractPrice(content);
                            if (extracted && extracted > 0) {
                                price = extracted;
                                console.log(`[GratisStore] Discount price from selector "${sel}": ${price}`);
                                break;
                            }
                        }
                    } catch (e) { /* skip */ }
                }
            }

            // ================================================================
            // 3. Collect ALL visible TL prices from page — pick minimum
            //    This catches the Gratis Kart price even without knowing the selector.
            // ================================================================
            if (price === null) {
                const bodyHtml = $.html();
                const tlPrices = bodyHtml.match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s*(?:TL|₺)/g);
                if (tlPrices && tlPrices.length > 0) {
                    const nums = tlPrices
                        .map(p => extractPrice(p))
                        .filter((p): p is number => p !== null && p > 1);

                    if (nums.length > 0) {
                        price = Math.min(...nums);
                        console.log(`[GratisStore] All TL prices: [${nums.join(', ')}] → lowest: ${price}`);
                    }
                }
            }

            // ================================================================
            // 4. Meta tags fallback
            // ================================================================
            if (price === null) {
                const metaSelectors = [
                    'meta[property="product:price:amount"]',
                    'meta[property="og:price:amount"]',
                    'meta[itemprop="price"]',
                ];
                for (const sel of metaSelectors) {
                    const content = $(sel).attr('content') || $(sel).attr('value');
                    if (content) {
                        const extracted = extractPrice(content);
                        if (extracted && extracted > 0) {
                            price = extracted;
                            console.log(`[GratisStore] Price from meta "${sel}": ${price}`);
                            break;
                        }
                    }
                }
            }

            // ================================================================
            // 5. Stock detection
            // ================================================================
            if (inStock === null) {
                const bodyText = $('body').text().toLowerCase();
                const soldOut = bodyText.includes('tükendi')
                    || bodyText.includes('stokta yok')
                    || bodyText.includes('sold out')
                    || bodyText.includes('out of stock')
                    || bodyText.includes('mevcut değil');
                const hasCart = bodyText.includes('sepete ekle')
                    || bodyText.includes('hemen al')
                    || $('button').filter((_, el) => /sepet|hemen\s*al/i.test($(el).text())).length > 0;

                if (soldOut) inStock = false;
                else if (hasCart) inStock = true;
            }

            // ================================================================
            // 6. Name / image fallback
            // ================================================================
            if (!productName) {
                productName = $('meta[property="og:title"]').attr('content')
                    || $('h1').first().text().trim()
                    || null;
            }
            if (!imageUrl) {
                imageUrl = $('meta[property="og:image"]').attr('content')
                    || $('meta[name="twitter:image"]').attr('content')
                    || null;
            }

            console.log(`[GratisStore] Final: inStock=${inStock}, price=${price}, name=${productName?.substring(0, 50)}`);
        } catch (e: any) {
            console.warn(`[GratisStore] Failed: ${e.message}`);
        }

        return {
            inStock: inStock ?? false,
            price,
            source: 'http' as const,
            productName,
            imageUrl,
        };
    },
};
