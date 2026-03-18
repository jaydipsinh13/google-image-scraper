import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Scrape images API
app.post('/scrape-images', async (req, res) => {
  try {
    const { texts } = req.body;
    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({ error: 'Provide an array of texts' });
    }

    const results = await Promise.all(
      texts.map(async (text) => {
        // Use Bing Images instead of Google – more scraper‑friendly
        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(
          `${text} food item by zomato`
        )}&form=HDRSC2`;

        let html;
        try {
          const { data } = await axios.get(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              Accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });
          html = data;
        } catch (err) {
          // On any network / blocking error, just return empty for this term
          return { dname: text, imageUrls: [] };
        }

        const $ = cheerio.load(html);
        const imageUrls = [];

        // 1) Prefer main image result thumbnails
        //    They usually live on elements like: <img class="mimg" ...>
        $('img.mimg').each((i, el) => {
          if (imageUrls.length >= 1) return false;

          let src = $(el).attr('src') || $(el).attr('data-src') || '';
          if (
            src &&
            src.startsWith('http') &&
            !src.startsWith('data:') &&
            !src.includes('bing.net/th?id=OIP.') // skip some low‑quality thumbs if needed
          ) {
            if (src.startsWith('http://')) src = src.replace('http://', 'https://');
            imageUrls.push(src);
          }
        });

        // 2) Fallback: any reasonable <img> on the page
        if (imageUrls.length === 0) {
          $('img').each((i, el) => {
            if (imageUrls.length >= 1) return false;

            let src = $(el).attr('src') || $(el).attr('data-src') || '';
            if (
              src &&
              src.startsWith('http') &&
              !src.startsWith('data:') &&
              !src.includes('bing.com/th?id=OIP.') &&
              !src.includes('rmsrc') &&
              !src.includes('azureedge.net') // branding / layout images
            ) {
              if (src.startsWith('http://')) src = src.replace('http://', 'https://');
              imageUrls.push(src);
            }
          });
        }

        return { dname: text, imageUrls };
      })
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
