import axios from 'axios';
import * as cheerio from 'cheerio';
import { StoreScraper } from '../Store';

function extractPrice(text: string): number | null {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    // Match "1.234,56 TL" or "1234,56 ₺" or just "1234.56"
    const trMatch = cleaned.match(/([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?)\s*(?:tl|₺)/i);
    if (trMatch) {
        const joined = trMatch[1].replace(/\./g, '').replace(',', '.');
        const parsed = parseFloat(joined);
        return Number.isNaN(parsed) ? null : parsed;
    }
    // International format: "1,234.56" or "1234.56"
    const intMatch = cleaned.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
    if (intMatch) {
        const joined = intMatch[1].replace(/,/g, '');
        const parsed = parseFloat(joined);
        return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
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
                validateStatus: () => true,
            });

            if (resp.status >= 200 && resp.status < 400) {
                const $ = cheerio.load(resp.data);

                // 1. Try JSON-LD structured data (most reliable)
                $('script[type="application/ld+json"]').each((i, el) => {
                    try {
                        const data = JSON.parse($(el).html() || '{}');
                        const items = Array.isArray(data) ? data : [data];
                        for (const item of items) {
                            if (item['@type'] === 'Product') {
                                if (!productName && item.name) productName = item.name;
                                if (!imageUrl && item.image) {
                                    const img = Array.isArray(item.image) ? item.image[0] : item.image;
                                    imageUrl = typeof img === 'string' ? img : (img?.contentUrl || img?.url || null);
                                }
                                if (item.offers) {
                                    const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
                                    for (const offer of offers) {
                                        if (offer.availability && inStock === null) {
                                            inStock = offer.availability.includes('InStock');
                                        }
                                        if (offer.price && price === null) {
                                            price = parseFloat(offer.price);
                                        }
                                        if (offer.lowPrice && price === null) {
                                            price = parseFloat(offer.lowPrice);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) { /* ignore */ }
                });

                // 2. OG tags fallback for name/image
                if (!productName) {
                    productName = $('meta[property="og:title"]').attr('content')
                        || $('h1').first().text().trim()
                        || $('title').text().split('|')[0]?.split('-')[0]?.trim()
                        || null;
                }
                if (!imageUrl) {
                    imageUrl = $('meta[property="og:image"]').attr('content')
                        || $('meta[name="twitter:image"]').attr('content')
                        || null;
                }

                // 3. DOM heuristics for stock
                if (inStock === null) {
                    const bodyText = $('body').text().toLowerCase();
                    const hasAddToCart = bodyText.includes('sepete ekle') || bodyText.includes('add to cart') || bodyText.includes('satın al');
                    const soldOut = bodyText.includes('tükendi') || bodyText.includes('stokta yok') || bodyText.includes('sold out') || bodyText.includes('out of stock');
                    if (soldOut) inStock = false;
                    else if (hasAddToCart) inStock = true;
                }

                // 4. DOM heuristics for price
                if (price === null) {
                    const priceSelectors = [
                        '[itemprop="price"]',
                        '.product-price',
                        '.price',
                        '.current-price',
                        '.sale-price',
                        '#price',
                    ];
                    for (const sel of priceSelectors) {
                        const el = $(sel).first();
                        const content = el.attr('content') || el.text().trim();
                        if (content) {
                            const extracted = extractPrice(content);
                            if (extracted && extracted > 0) {
                                price = extracted;
                                break;
                            }
                        }
                    }
                }

                console.log(`[GenericStore] Result: inStock=${inStock}, price=${price}, name=${productName?.substring(0, 50)}`);
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
