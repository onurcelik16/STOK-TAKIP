import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Proxy image to bypass hotlinking protection
router.get('/image', async (req, res) => {
    const imageUrl = req.query.url as string;

    if (!imageUrl) {
        return res.status(400).json({ error: 'url parameter is required' });
    }

    try {
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.37 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.37',
                'Referer': new URL(imageUrl).origin,
            },
            timeout: 10000,
        });

        // Pass through relevant headers
        const contentType = response.headers['content-type'];
        if (contentType) res.setHeader('Content-Type', contentType);

        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

        response.data.pipe(res);
    } catch (error: any) {
        console.error(`[proxy] Failed to fetch image: ${imageUrl}`, error.message);
        res.status(500).json({ error: 'Failed to fetch image', details: error.message });
    }
});

export default router;
