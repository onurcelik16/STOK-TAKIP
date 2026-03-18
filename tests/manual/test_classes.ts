import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const url = 'https://www.trendyol.com/vodens/kahverengi-kayik-yaka-uzun-kol-top-100-pamuk-p-996372050';
    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        validateStatus: () => true
    });

    const $ = cheerio.load(res.data);
    console.log('Status code:', res.status);
    console.log('add-to-basket-button:', $('.add-to-basket-button').length);
    console.log('add-to-bs-tx:', $('.add-to-bs-tx').length);
    console.log('product-button-container:', $('.product-button-container').length);
    console.log('sold-out:', $('.sold-out').length);
    console.log('HTML length:', res.data.length);
}
test();
