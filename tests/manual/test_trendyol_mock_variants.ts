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
                    "name": "Stradivarius Hakim Yaka",
                    "url": "https://www.trendyol.com/example",
                    "hasVariant": [
                        {
                            "@type": "Product",
                            "name": "Stradivarius Hakim Yaka - L",
                            "sku": "1234-L",
                            "offers": {
                                "availability": "https://schema.org/InStock",
                                "price": "199.99"
                            }
                        },
                        {
                            "@type": "Product",
                            "name": "Stradivarius Hakim Yaka - S",
                            "sku": "1234-S",
                            "offers": {
                                "availability": "https://schema.org/OutOfStock",
                                "price": "199.99"
                            }
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

    console.log("Testing with L size (Should be InStock):");
    res = await TrendyolStore.checkProduct({
        url: 'https://www.trendyol.com/example',
        size: 'L'
    });
    console.log("Result L:", res.inStock ? "IN STOCK" : "OUT OF STOCK");
}
run();
