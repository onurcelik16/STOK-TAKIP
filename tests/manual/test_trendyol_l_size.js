const axios = require('axios');
const cheerio = require('cheerio');

async function testTrendyolSize() {
    try {
        const url = 'https://www.trendyol.com/stradivarius/hakim-yaka-dugmeli-triko-hirka-p-838640106'; // We know S is out of stock, M is in stock. User says L is in stock.
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
                'Accept': 'text/html'
            }
        });

        const html = resp.data;
        const $ = cheerio.load(html);
        
        console.log("=== JSON-LD ITEM NAMES & SKUs ===");
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                const data = JSON.parse($(el).html() || '{}');
                let items = Array.isArray(data) ? data : (data.hasVariant ? [data, ...data.hasVariant] : [data]);
                for (const item of items) {
                    if (item.name) {
                        console.log(`Name: ${item.name}`);
                        console.log(`SKU: ${item.sku}`);
                        console.log(`Availability: ${item.offers?.availability}`);
                        console.log('---');
                    }
                }
            } catch(e) {}
        });

    } catch(e) { console.error("Error:", e.message); }
}
testTrendyolSize();
