import { TrendyolStore } from './src/server/stores/trendyol/TrendyolStore';

async function run() {
    const url = 'https://www.trendyol.com/stradivarius/beyaz-spor-ayakkabi-p-37733434';
    
    console.log("Testing with 37 size (Should be Out of Stock):");
    let res37 = await TrendyolStore.checkProduct({ url, size: '37' });
    console.log("Result 37:", res37);

    console.log("\nTesting with 38 size (Should be In Stock):");
    let res38 = await TrendyolStore.checkProduct({ url, size: '38' });
    console.log("Result 38:", res38);
}
run();
