const axios = require('axios');
const cheerio = require('cheerio');

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { tag } = req.query;
  if (!tag) {
    return res.status(400).json({ success: false, error: 'El Player Tag es requerido' });
  }

  const cleanTag = tag.replace('#', '').trim().toUpperCase();
  const targetUrl = new URL(`https://proxy.royaleapi.dev/v1/players/%23${cleanTag}`);

  try {
    // === PASO A: Fetch a la API Oficial de Clash Royale ===
    const response = await axios.get(targetUrl.href, {
      headers: {
        'Authorization': `Bearer ${process.env.CR_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    const data = response.data;
    if (!data || !data.cards) {
      return res.status(404).json({ success: false, error: 'Jugador no encontrado en la API' });
    }

    const unmaxedKeys = [];
    const cardDictionary = {}; // Para reconstruir el mazo rápidamente después

    data.cards.forEach(card => {
      const isElite = card.level >= card.maxLevel;
      const hasEvolution = card.evolutionLevel && card.evolutionLevel > 0;
      const isMaxed = isElite || hasEvolution;
      
      const key = card.name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
      
      // Guardar mapeo (incluso de las que no están maxeadas, por seguridad en la validación posterior)
      cardDictionary[key] = {
        id: card.id,
        name: card.name,
        key: key,
        level: isElite ? 15 : (14 - card.maxLevel + card.level),
        isEvolution: hasEvolution,
        image: `https://cdns3.royaleapi.com/cdn-cgi/image/w=150,h=180,format=auto/static/img/cards/v9-f09d5c9d/${key}.png`
      };

      if (!isMaxed) {
        unmaxedKeys.push(key);
      }
    });

    // === PASO B: Scraping a Deckshop usando la lista de exclusión ===
    const excString = unmaxedKeys.join(',');
    // Limitamos la URL de Deckshop, pasando las exclusiones
    const deckshopUrl = `https://www.deckshop.pro/es/deck/list?exc=${excString}`;
    
    const deckshopRes = await axios.get(deckshopUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        'Accept': 'text/html'
      }
    });

    // === PASO C: Procesamiento con Cheerio ===
    const $ = cheerio.load(deckshopRes.data);
    const foundDecks = [];
    
    $('a[href*="/deck/detail/"]').each((i, el) => {
      if (foundDecks.length >= 12) return false; // Límite de mazos
      
      const href = $(el).attr('href');
      const match = href.match(/\/deck\/detail\/([^?#]+)/);
      if (match && match[1]) {
        const keys = match[1].split(',');
        
        // Verificar validez (exactamente 8 cartas)
        if (keys.length === 8 && keys.every(k => cardDictionary[k])) {
          const deckCards = keys.map(k => cardDictionary[k]);
          
          // Evitar duplicados (Deckshop suele tener varios botones que apuntan al mismo mazo)
          const deckId = keys.slice().sort().join(',');
          if (!foundDecks.find(d => d._id === deckId)) {
            foundDecks.push({ _id: deckId, cards: deckCards });
          }
        }
      }
    });

    // === PASO D: Devolver JSON ===
    const finalDecks = foundDecks.map(d => ({ cards: d.cards }));
    return res.status(200).json({ success: true, decks: finalDecks });

  } catch (error) {
    console.error('Error en el scraping doble:', error.message);
    let errorMsg = 'Error al generar mazos verificados. Intenta más tarde.';
    if (error.response && error.response.status === 403) {
      errorMsg = 'Error 403: API Key inválida o protección detectada en Deckshop.';
    }
    return res.status(500).json({ success: false, error: errorMsg, details: error.message });
  }
}
