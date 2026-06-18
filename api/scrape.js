const axios = require('axios');
const cheerio = require('cheerio');

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { tag } = req.query;
  if (!tag) {
    return res.status(400).json({ error: 'Player Tag is required' });
  }

  const cleanTag = tag.replace('#', '').trim();

  // 1. Solución advertencia url.parse(): Usar API moderna new URL()
  const targetUrl = new URL(`https://royaleapi.com/player/${cleanTag}/cards`);

  try {
    const response = await axios.get(targetUrl.href, {
      headers: {
        // Headers robustos para intentar evadir el antibot (Cloudflare)
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      }
    });

    const $ = cheerio.load(response.data);
    const maxCards = [];

    $('.card_grid .card_obj, .ui.cards .card, .player__cards__card').each((i, el) => {
      const levelText = $(el).find('.level, .card-level, .level-text').text().trim().toLowerCase();
      const cardName = $(el).find('.name, .card-name').text().trim() || $(el).attr('data-name');
      
      if (levelText.includes('15') || levelText.includes('16') || levelText.includes('elite')) {
        if (cardName) {
           maxCards.push({
             name: cardName,
             key: cardName.toLowerCase().replace(/[^a-z0-9]/g, '')
           });
        }
      }
    });

    if (maxCards.length === 0) {
      $('[data-level="15"], [data-level="16"]').each((i, el) => {
         const cardName = $(el).attr('data-name') || $(el).find('.name, .card-name').text().trim();
         if (cardName) {
           maxCards.push({
             name: cardName,
             key: cardName.toLowerCase().replace(/[^a-z0-9]/g, '')
           });
         }
      });
    }

    const uniqueCards = Array.from(new Set(maxCards.map(c => c.key)))
      .map(key => maxCards.find(c => c.key === key));

    return res.status(200).json({ cards: uniqueCards });

  } catch (error) {
    // 2. Manejo de errores detallado (Logging para Vercel)
    console.error('--- ERROR AL OBTENER DATOS DE ROYALEAPI ---');
    console.error('Mensaje de error:', error.message);
    
    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Headers de la Respuesta:', JSON.stringify(error.response.headers, null, 2));
      // Truncar la data de respuesta si es muy grande, pero sirve para ver la página de Cloudflare
      const responseData = typeof error.response.data === 'string' ? error.response.data.substring(0, 500) : error.response.data;
      console.error('Data de Respuesta (Truncada):', responseData);
    } else if (error.request) {
      console.error('La petición fue enviada pero no hubo respuesta');
    } else {
      console.error('Error al configurar la petición:', error.message);
    }
    console.error('-------------------------------------------');

    let errorMsg = 'No se pudo obtener la información de RoyaleAPI. Verifica el Tag o intenta más tarde.';
    if (error.response && (error.response.status === 403 || error.response.status === 503)) {
      errorMsg = 'Bloqueo de Cloudflare detectado al intentar consultar RoyaleAPI.';
    }

    return res.status(500).json({ error: errorMsg, details: error.message });
  }
}
