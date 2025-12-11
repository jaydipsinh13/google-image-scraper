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
        const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(text)}`;
        const { data: html } = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
        });

        const $ = cheerio.load(html);

        const imageUrls = [];
        $('img').each((i, el) => {
          let src = $(el).attr('src') || $(el).attr('data-src') || '';
          if (
            src &&
            src.startsWith('http') &&
            !src.startsWith('data:') &&
            imageUrls.length < 1
          ) {
            if (src.startsWith('http://')) src = src.replace('http://', 'https://');
        
            src = src.replace(/=w\d+-h\d+/, '=w1000-h1000');
            src = src.replace(/=s\d+/, '');
        
            imageUrls.push(src);
          }
        });
        

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
