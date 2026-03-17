const fs = require('fs');
const html = fs.readFileSync('./trendyol_new.html', 'utf-8');

const vm = html.match(/"variants"\s*:\s*(\[\{[\s\S]*?\}\])/);
if (vm) {
    try {
        const variants = JSON.parse(vm[1]);
        console.log("Parsed correctly:", variants.length, "variants found.");
        const L = variants.find(v => v.value === 'L');
        console.log("L Size stock:", L.inStock);
    } catch(e) {
        console.error("Parse error", e.message);
    }
} else {
    console.log("No match");
}
