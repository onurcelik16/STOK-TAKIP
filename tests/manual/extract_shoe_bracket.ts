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
        
        const variantsIdx = text.indexOf('"variants":');
        if (variantsIdx !== -1) {
            const arrayStartIdx = text.indexOf('[', variantsIdx);
            if (arrayStartIdx !== -1) {
                let brackets = 0;
                let arrayString = '';
                for (let j = arrayStartIdx; j < text.length; j++) {
                    const char = text[j];
                    arrayString += char;
                    if (char === '[') brackets++;
                    if (char === ']') brackets--;
                    
                    if (brackets === 0) {
                        try {
                            const variants = JSON.parse(arrayString);
                            console.log(`Script ${i}: Successfully parsed ${variants.length} variants!`);
                            variants.forEach((v: any) => {
                                console.log(`- Value: ${v.value}, Beautified: ${v.beautifiedValue}, Attr: ${v.attributeValue}, inStock: ${v.inStock}`);
                            });
                            printed = true;
                        } catch(e) {
                             console.error(`Script ${i} parse error!`);
                        }
                        break;
                    }
                }
            }
        }
    });
}
extract();
