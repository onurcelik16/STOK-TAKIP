function extractPrice(text) {
    const priceMatch = text.match(/([0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)[.,][0-9]{2}\s*tl/i);
    if (!priceMatch) return null;
    const raw = priceMatch[1];
    const decimals = (priceMatch[0].match(/[.,][0-9]{2}/) || [''])[0];
    const joined = (raw + (decimals || '')).replace(/\./g, '').replace(',', '.').replace(/ tl/i, '');
    const parsed = parseFloat(joined);
    return Number.isNaN(parsed) ? null : parsed;
}
console.log('8.560,00 TL ->', extractPrice('8.560,00 TL'));
console.log('659,95 TL ->', extractPrice('659,95 TL'));
console.log('5600 tl ->', extractPrice('5600 tl'));
console.log('5.600,00 TL ->', extractPrice('5.600,00 TL'));
console.log('659.959,00 TL ->', extractPrice('659.959,00 TL'));
console.log('856.000,00 TL ->', extractPrice('856.000,00 TL'));
