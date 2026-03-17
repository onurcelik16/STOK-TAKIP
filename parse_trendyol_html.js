const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('./trendyol_new.html', 'utf-8');
const $ = cheerio.load(html);

$('script[type="application/ld+json"]').each((i, el) => {
    try {
        const data = JSON.parse($(el).html() || '{}');
        console.log(`JSON-LD Block ${i}:`);
        console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...\n');
    } catch(e) {}
});

// Also check for any script containing "variants"
$('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('"variants"')) {
        console.log(`Script ${i} generic contains "variants", length: ${text.length}`);
    }
});
