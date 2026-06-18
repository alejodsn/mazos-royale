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

  try {
    const response = await axios.get(`https://royaleapi.com/player/${cleanTag}/cards`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    const $ = cheerio.load(response.data);
    const maxCards = [];

    // Selectores genéricos basados en estructura típica de listado de cartas
    $('.card_grid .card_obj, .ui.cards .card, .player__cards__card').each((i, el) => {
      const levelText = $(el).find('.level, .card-level, .level-text').text().trim().toLowerCase();
      const cardName = $(el).find('.name, .card-name').text().trim() || $(el).attr('data-name');
      
      // Buscamos nivel 15, 16 o indicativos de "Elite"
      if (levelText.includes('15') || levelText.includes('16') || levelText.includes('elite')) {
        if (cardName) {
           maxCards.push({
             name: cardName,
             // Formato Deckshop: solo letras minúsculas y números (ej: "Hog Rider" -> "hogrider")
             key: cardName.toLowerCase().replace(/[^a-z0-9]/g, '')
           });
        }
      }
    });

    // Fallback: buscar atributos directos de nivel si no funcionó lo anterior
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

    // Eliminar duplicados
    const uniqueCards = Array.from(new Set(maxCards.map(c => c.key)))
      .map(key => maxCards.find(c => c.key === key));

    return res.status(200).json({ cards: uniqueCards });

  } catch (error) {
    console.error('Error fetching RoyaleAPI:', error.message);
    return res.status(500).json({ error: 'No se pudo obtener la información de RoyaleAPI. Verifica el Tag o intenta más tarde.', details: error.message });
  }
}
