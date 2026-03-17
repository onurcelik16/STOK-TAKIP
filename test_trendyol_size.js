const axios = require('axios');
const cheerio = require('cheerio');

async function testTrendyolSize() {
    try {
        const url = 'https://www.trendyol.com/stradivarius/hakim-yaka-dugmeli-triko-hirka-p-838640106';
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'text/html'
            }
        });

        const html = resp.data;
        const $ = cheerio.load(html);

        console.log("=== APP CONF ===");
        const configMatch = html.match(/window\.__PRODUCT_DETAIL_APP_CONF__\s*=\s*({[\s\S]*?});/);
        if (configMatch) {
            try {
                const config = JSON.parse(configMatch[1]);
                if (config.product && config.product.variants) {
                    config.product.variants.forEach(v => {
                        console.log(`Variant: attributeValue=${v.attributeValue}, value=${v.value}, inStock: ${v.inStock}`);
                    });
                }
                console.log(`Global inStock: ${config.product?.inStock}`);
            } catch(e) {}
        }
        
        console.log("=== JSON-LD ===");
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const data = JSON.parse($(el).html() || '{}');
                let items = Array.isArray(data) ? data : (data.hasVariant ? [data, ...data.hasVariant] : [data]);
                for (const item of items) {
                    if (item.name) {
                        console.log(`Item Name: ${item.name}, SKU: ${item.sku}, Stock: ${item.offers?.availability}`);
                    }
                }
            } catch(e) {}
        });

    } catch(e) { console.error("Error:", e.message); }
}
testTrendyolSize();
