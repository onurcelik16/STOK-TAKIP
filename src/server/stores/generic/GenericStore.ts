import axios from 'axios';
import * as cheerio from 'cheerio';
import { StoreScraper } from '../Store';

/**
 * Extract a numeric price from text.
 * Handles Turkish format (1.234,56 TL), international (1,234.56), and plain numbers.
 */
function extractPrice(text: string): number | null {
    if (!text) return null;
    const cleaned = text.replace(/\s+/g, ' ').trim();

    // 1. Turkish format: "1.234,56 TL" or "234,56 ₺" or "1.234,56"
    const trMatch = cleaned.match(/([0-9]{1,3}(?:\.[0-9]{3})*[,][0-9]{2})/);
    if (trMatch) {
        const joined = trMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(joined);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }

    // 2. Plain comma-decimal (no thousands): "234,99"
    const commaDecimal = cleaned.match(/([0-9]+)[,]([0-9]{2})(?:\s|$|₺|TL|tl)/);
    if (commaDecimal) {
        const parsed = parseFloat(`${commaDecimal[1]}.${commaDecimal[2]}`);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }

    // 3. International: "1,234.56" or "1234.56"
    const intMatch = cleaned.match(/([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/);
    if (intMatch) {
        const joined = intMatch[1].replace(/,/g, '');
        const parsed = parseFloat(joined);
        if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }

    // 4. Plain integer/decimal: "19939" or "199.00"
    const plainMatch = cleaned.match(/([0-9]+(?:\.[0-9]{1,2})?)/);
    if (plainMatch) {
        const parsed = parseFloat(plainMatch[1]);
        if (!Number.isNaN(parsed) && parsed > 1) return parsed; // > 1 to avoid matching garbage
    }

    return null;
}

/**
 * Deep search for Product type in nested JSON-LD data.
 */
function findProducts(data: any): any[] {
    const results: any[] = [];
    if (!data) return results;

    if (Array.isArray(data)) {
        for (const item of data) {
            results.push(...findProducts(item));
        }
    } else if (typeof data === 'object') {
        if (data['@type'] === 'Product') {
            results.push(data);
        }
        // Check @graph array (common in some sites)
        if (data['@graph'] && Array.isArray(data['@graph'])) {
            results.push(...findProducts(data['@graph']));
        }
        // Check hasVariant
        if (data.hasVariant && Array.isArray(data.hasVariant)) {
            results.push(...findProducts(data.hasVariant));
        }
    }
    return results;
}

export const GenericStore: StoreScraper = {
    name: 'generic',
    async checkProduct({ url }) {
        console.log(`[GenericStore] Checking ${url}`);

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

            if (resp.status >= 200 && resp.status < 400) {
                const $ = cheerio.load(resp.data);

                // ============================================================
                // 1. JSON-LD structured data (most reliable source)
                // ============================================================
                $('script[type="application/ld+json"]').each((i, el) => {
                    try {
                        const rawData = JSON.parse($(el).html() || '{}');
                        const products = findProducts(rawData);

                        for (const product of products) {
                            if (!productName && product.name) {
                                productName = product.name;
                            }
                            if (!imageUrl && product.image) {
                                const img = Array.isArray(product.image) ? product.image[0] : product.image;
                                imageUrl = typeof img === 'string' ? img : (img?.contentUrl || img?.url || null);
                            }
                            if (product.offers) {
                                const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
                                for (const offer of offers) {
                                    if (offer.availability && inStock === null) {
                                        inStock = String(offer.availability).includes('InStock');
                                    }
                                    // Try multiple price fields
                                    const priceVal = offer.price || offer.lowPrice || offer.highPrice || offer.salePrice || offer.currentPrice || null;
                                    if (priceVal && price === null) {
                                        const p = typeof priceVal === 'string' ? parseFloat(priceVal.replace(',', '.')) : priceVal;
                                        if (!Number.isNaN(p) && p > 0) price = p;
                                    }
                                }
                            }
                        }
                    } catch (e) { /* ignore parse errors */ }
                });

                // ============================================================
                // 2. Meta tags for price (many sites put price in meta)
                // ============================================================
                if (price === null) {
                    const metaPriceSelectors = [
                        'meta[property="product:price:amount"]',
                        'meta[property="og:price:amount"]',
                        'meta[name="twitter:data1"]',
                        'meta[itemprop="price"]',
                    ];
                    for (const sel of metaPriceSelectors) {
                        const content = $(sel).attr('content') || $(sel).attr('value');
                        if (content) {
                            const extracted = extractPrice(content);
                            if (extracted && extracted > 0) {
                                price = extracted;
                                console.log(`[GenericStore] Price from meta tag ${sel}: ${price}`);
                                break;
                            }
                        }
                    }
                }

                // ============================================================
                // 3. OG tags + DOM for name/image
                // ============================================================
                if (!productName) {
                    productName = $('meta[property="og:title"]').attr('content')
                        || $('h1').first().text().trim()
                        || $('title').text().split('|')[0]?.split('-')[0]?.trim()
                        || null;
                }
                if (!imageUrl) {
                    imageUrl = $('meta[property="og:image"]').attr('content')
                        || $('meta[name="twitter:image"]').attr('content')
                        || $('img[itemprop="image"]').attr('src')
                        || null;
                }

                // ============================================================
                // 4. DOM heuristics for stock
                // ============================================================
                if (inStock === null) {
                    const bodyText = $('body').text().toLowerCase();
                    const hasAddToCart = bodyText.includes('sepete ekle')
                        || bodyText.includes('add to cart')
                        || bodyText.includes('satın al')
                        || bodyText.includes('buy now')
                        || $('button, [data-test-id]').filter((_, el) => /sepet|cart|buy|satın/i.test($(el).text())).length > 0;
                    const soldOut = bodyText.includes('tükendi')
                        || bodyText.includes('stokta yok')
                        || bodyText.includes('sold out')
                        || bodyText.includes('out of stock')
                        || bodyText.includes('mevcut değil');
                    if (soldOut) inStock = false;
                    else if (hasAddToCart) inStock = true;
                }

                // ============================================================
                // 5. DOM heuristics for price (extensive selectors)
                // ============================================================
                if (price === null) {
                    const priceSelectors = [
                        // Standard itemprop
                        '[itemprop="price"]',
                        // Common class names used by popular e-commerce platforms
                        '.product-price',
                        '.product_price',
                        '.productPrice',
                        '.price-current',
                        '.current-price',
                        '.sale-price',
                        '.new-price',
                        '.price-new',
                        '.price',
                        '.urun-fiyat',
                        '.fiyat',
                        '#price',
                        // Gratis-specific
                        '.product-detail-price',
                        '.product-info__price',
                        '.price-box .price',
                        // Shopify patterns
                        '.product__price',
                        '[data-product-price]',
                        '.ProductMeta__Price',
                        // WooCommerce patterns
                        '.woocommerce-Price-amount',
                        'ins .woocommerce-Price-amount',
                        '.summary .price',
                        // OpenCart patterns
                        '#product-price',
                        '.price-group',
                        // General
                        'span[data-price]',
                        '[data-test="product-price"]',
                        '[class*="price"]:not(script):not(style)',
                    ];

                    for (const sel of priceSelectors) {
                        try {
                            const el = $(sel).first();
                            if (el.length === 0) continue;
                            // Try content attribute first (for itemprop), then text
                            const content = el.attr('content') || el.attr('data-price') || el.attr('data-product-price') || el.text().trim();
                            if (content) {
                                const extracted = extractPrice(content);
                                if (extracted && extracted > 0) {
                                    price = extracted;
                                    console.log(`[GenericStore] Price from selector "${sel}": ${price}`);
                                    break;
                                }
                            }
                        } catch (e) { /* skip selector errors */ }
                    }
                }

                // ============================================================
                // 6. Last resort: regex scan for price patterns in body text
                // ============================================================
                if (price === null) {
                    const bodyHtml = $.html();
                    // Look for TL/₺ prices in the HTML
                    const tlPrices = bodyHtml.match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\s*(?:TL|₺)/g);
                    if (tlPrices && tlPrices.length > 0) {
                        // Pick the first reasonable price
                        for (const p of tlPrices) {
                            const extracted = extractPrice(p);
                            if (extracted && extracted > 1) {
                                price = extracted;
                                console.log(`[GenericStore] Price from regex scan: ${price}`);
                                break;
                            }
                        }
                    }
                }

                console.log(`[GenericStore] Final: inStock=${inStock}, price=${price}, name=${productName?.substring(0, 50)}, image=${imageUrl ? 'yes' : 'no'}`);
            } else {
                console.warn(`[GenericStore] HTTP ${resp.status} for ${url}`);
            }
        } catch (e: any) {
            console.warn(`[GenericStore] Failed: ${e.message}`);
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
