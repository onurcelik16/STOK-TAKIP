const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('./trendyol_new.html', 'utf-8');
const $ = cheerio.load(html);

$('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('"variants"')) {
        // Try to safely extract variants string
        const match = text.match(/"variants"\s*:\s*(\[[\s\S]*?\])/);
        if (match) {
            console.log(`Script ${i}:`);
            console.log(match[1].substring(0, 1000) + '...');
        }
    }
});
