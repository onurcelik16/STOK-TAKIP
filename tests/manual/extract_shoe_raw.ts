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

    let printed = false;
    $('script').each((i, el) => {
        if (printed) return;
        const text = $(el).html() || '';
        if (text.includes('"variants"')) {
            const vm = text.match(/"variants"\s*:\s*(\[\{[\s\S]*?\}\])/);
            if (vm) {
                console.log(`Raw matched string (length ${vm[1].length}):`);
                console.log(vm[1].substring(0, 800) + '...');
                printed = true;
            }
        }
    });
}
extract();
