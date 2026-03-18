import { TrendyolStore } from './src/server/stores/trendyol/TrendyolStore';

async function run() {
    const url = 'https://www.trendyol.com/stradivarius/hakim-yaka-dugmeli-triko-hirka-p-1110815148';
    
    console.log("Testing with S size:");
    let resS = await TrendyolStore.checkProduct({ url, size: 'S' });
    console.log("Result S:", resS);

    console.log("\nTesting with L size:");
    let resL = await TrendyolStore.checkProduct({ url, size: 'L' });
    console.log("Result L:", resL);
}
run();
