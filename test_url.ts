import 'dotenv/config';
import { TrendyolStore } from './src/server/stores/trendyol/TrendyolStore';

async function main() {
    const url = process.argv[2];
    if (!url) {
        console.error('Please provide a URL');
        process.exit(1);
    }
    console.log('Testing URL:', url);
    try {
        const res = await TrendyolStore.checkProduct({ url });
        console.log('Result:', JSON.stringify(res, null, 2));
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}
main();
