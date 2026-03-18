import axios from 'axios';
import * as cheerio from 'cheerio';
import * as vm from 'vm';

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
        if (text.includes('window.__PRODUCT_DETAIL_APP_CONF__')) {
            const match = text.match(/window\.__PRODUCT_DETAIL_APP_CONF__\s*=\s*(\{[\s\S]*?\});/);
            if (match) {
                try {
                    const conf = match[1];
                     // Use VM to parse the JS object instead of pure JSON, as it might have unquoted keys etc.
                    const sandbox = { conf: null };
                    vm.createContext(sandbox);
                    vm.runInContext(`conf = ${conf};`, sandbox);
                    
                    const config = sandbox.conf as any;
                    const variants = config?.product?.variants;
                    console.log(`Found ${variants?.length || 0} variants inside APP_CONF`);
                    variants?.forEach((v: any) => {
                        console.log(`- Value: ${v.value}, Attr: ${v.attributeValue}, inStock: ${v.inStock}`);
                    });
                } catch(e: any) {
                     console.error("APP_CONF parse error", e.message);
                }
            }
        }
    });
}
extract();
