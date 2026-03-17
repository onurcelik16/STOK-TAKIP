import axios from 'axios';
import * as cheerio from 'cheerio';

async function extract() {
    const url = 'https://www.trendyol.com/stradivarius/beyaz-spor-ayakkabi-p-37733434';
    const resp = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        }
    });

    const html = resp.data;
    const $ = cheerio.load(html);

    $('script').each((i, el) => {
        const text = $(el).html() || '';
        if (text.includes('"variants"')) {
            const vm = text.match(/"variants"\s*:\s*(\[\{[\s\S]*?\}\])/);
            if (vm) {
                try {
                    const variants = JSON.parse(vm[1]);
                    console.log(`Script ${i}: Found ${variants.length} variants`);
                    variants.forEach((v: any) => {
                       console.log(`  - value: ${v.value}, attr: ${v.attributeValue}, inStock: ${v.inStock}`);
                    });
                } catch(e: any) {
                    console.error(`Script ${i} parse error: ${e.message}`);
                }
            }
        }
    });
}
extract();
