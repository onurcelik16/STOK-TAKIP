import { GenericStore } from './src/server/stores/generic/GenericStore';
import axios from 'axios';
import * as sinon from 'sinon';

// Mock axios.get to return a simulated Gratis product page with M and S sizes
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
                    "name": "Test Shirt",
                    "offers": [
                        {
                            "@type": "Offer",
                            "name": "M Size Variant",
                            "sku": "TS-M",
                            "availability": "https://schema.org/InStock",
                            "price": "199.99"
                        },
                        {
                            "@type": "Offer",
                            "name": "S Size Variant",
                            "sku": "TS-S",
                            "availability": "https://schema.org/OutOfStock",
                            "price": "199.99"
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
    console.log("Testing with M size (Should be InStock):");
    let res = await GenericStore.checkProduct({
        url: 'https://example.com/test-shirt',
        size: 'M'
    });
    console.log("Result M:", res);

    console.log("\nTesting with S size (Should be OutOfStock):");
    res = await GenericStore.checkProduct({
        url: 'https://example.com/test-shirt',
        size: 'S'
    });
    console.log("Result S:", res);
    
    console.log("\nTesting with no size (Should be InStock based on first offer):");
    res = await GenericStore.checkProduct({
        url: 'https://example.com/test-shirt',
        size: null
    });
    console.log("Result No Size:", res);
}
run();
