import { TrendyolStore } from './src/server/stores/trendyol/TrendyolStore';

async function run() {
    const url = 'https://www.trendyol.com/stradivarius/hakim-yaka-dugmeli-triko-hirka-p-838640106'; // Example from screenshot
    // Actually the user tested "Stradivarius Hakim yaka düğmeli triko hırka", this is a generic id. E.g. p-835697330
    
    console.log("Testing with S size:");
    let res = await TrendyolStore.checkProduct({
        url: url,
        size: 'S'
    });
    console.log("Result S:", res);
}
run();
