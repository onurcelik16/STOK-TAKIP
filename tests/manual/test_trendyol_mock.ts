import { TrendyolStore } from './src/server/stores/trendyol/TrendyolStore';
import axios from 'axios';
import * as sinon from 'sinon';

sinon.stub(axios, 'get').callsFake(async (url) => {
    return {
        status: 200,
        data: `
        <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org/",
                    "@type": "Product",
                    "name": "Stradivarius Hakim Yaka Düğmeli Triko Hırka",
                    "url": "https://www.trendyol.com/example",
                    "offers": [
                        {
                            "@type": "Offer",
                            "name": "M Size Variant",
                            "sku": "TS-M",
                            "availability": "https://schema.org/InStock"
                        },
                        {
                            "@type": "Offer",
                            "name": "S Size Variant",
                            "sku": "TS-S",
                            "availability": "https://schema.org/OutOfStock"
                        }
                    ]
                }
                </script>
            </head>
            <body></body>
        </html>
        `
    };
});

async function run() {
    console.log("Testing with S size (Should be OutOfStock):");
    let res = await TrendyolStore.checkProduct({
        url: 'https://www.trendyol.com/example',
        size: 'S'
    });
    console.log("Result S:", res.inStock ? "IN STOCK" : "OUT OF STOCK");
}
run();
