const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('./trendyol_new.html', 'utf-8');
const $ = cheerio.load(html);

$('script[type="application/ld+json"]').each((i, el) => {
    try {
        const data = JSON.parse($(el).html() || '{}');
        if (data['@type'] === 'ProductGroup') {
             console.log(JSON.stringify(data.hasVariant || data, null, 2));
        }
    } catch(e) {}
});
