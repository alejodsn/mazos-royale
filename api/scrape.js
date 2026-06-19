const axios = require('axios');
const cheerio = require('cheerio');

const WIN_CONDITIONS = [
  'hog-rider', 'miner', 'balloon', 'goblin-barrel', 'x-bow', 'mortar', 
  'royal-giant', 'elite-barbarians', 'golem', 'lava-hound', 'graveyard', 
  'sparky', 'goblin-giant', 'ram-rider', 'elixir-golem', 'wall-breakers', 
  'skeleton-barrel', 'royal-hogs', 'giant'
];

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
    // 1. Obtención de Inventario (RoyaleAPI)
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

    const maxedCards = [];
    const cardDictionary = {}; 
    const maxedKeys = new Set();

    data.cards.forEach(card => {
      const computedLevel = 14 - card.maxLevel + card.level;
      const hasEvolution = card.evolutionLevel && card.evolutionLevel > 0;
      
      // Filtro para nivel 15, 16 y evoluciones
      const isMaxed = computedLevel >= 15 || computedLevel >= 16 || hasEvolution;
      
      const key = card.name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
      
      const cardObj = {
        id: card.id,
        name: card.name,
        key: key,
        level: computedLevel,
        isEvolution: hasEvolution,
        image: `https://cdns3.royaleapi.com/cdn-cgi/image/w=150,h=180,format=auto/static/img/cards/v9-f09d5c9d/${key}.png`
      };

      cardDictionary[key] = cardObj;

      if (isMaxed) {
        maxedCards.push(cardObj);
        maxedKeys.add(key);
      }
    });

    if (maxedCards.length < 8) {
      return res.status(200).json({ success: true, decks: [] });
    }

    // 2. Selección de Semillas
    let seeds = [];
    const evos = maxedCards.filter(c => c.isEvolution);
    const wcs = maxedCards.filter(c => !c.isEvolution && WIN_CONDITIONS.includes(c.key));
    const others = maxedCards.filter(c => !c.isEvolution && !WIN_CONDITIONS.includes(c.key));

    seeds.push(...evos);
    if (seeds.length < 3) seeds.push(...wcs);
    if (seeds.length < 3) seeds.push(...others);
    
    seeds = seeds.slice(0, 3); // Hasta 3 cartas clave

    // 3. Scraping en Paralelo
    const masterDecksMap = new Map();

    const scrapePromises = seeds.map(async (seed) => {
      try {
        const url = `https://www.deckshop.pro/es/best-decks/with/${seed.key}`;
        const deckshopRes = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
            'Accept': 'text/html'
          }
        });

        const $ = cheerio.load(deckshopRes.data);
        
        $('a[href*="/deck/detail/"]').each((i, el) => {
          const href = $(el).attr('href');
          const match = href.match(/\/deck\/detail\/([^?#]+)/);
          if (match && match[1]) {
            const keys = match[1].split(',');
            if (keys.length === 8) {
              const deckId = keys.slice().sort().join(',');
              masterDecksMap.set(deckId, keys);
            }
          }
        });
      } catch (e) {
        console.warn(`Error scraping seed ${seed.key}:`, e.message);
      }
    });

    await Promise.all(scrapePromises);

    // 4. Filtro Local y Lógica de Variedad
    // Paso A: Validación Estricta
    const validDecks = [];
    for (const [deckId, keys] of masterDecksMap.entries()) {
      if (keys.every(k => maxedKeys.has(k))) {
        validDecks.push({
          _id: deckId,
          keys: keys,
          cards: keys.map(k => cardDictionary[k])
        });
      }
    }

    // Paso B: Selección por Variedad
    const finalDecks = [];
    const usedCards = new Set();
    let remainingDecks = [...validDecks];

    while (finalDecks.length < 16 && remainingDecks.length > 0) {
      let bestDeckIndex = 0;
      let maxNewCards = -1;

      for (let i = 0; i < remainingDecks.length; i++) {
        const deck = remainingDecks[i];
        let newCardsCount = 0;
        
        for (const key of deck.keys) {
          if (!usedCards.has(key)) {
            newCardsCount++;
          }
        }
        
        if (newCardsCount > maxNewCards) {
          maxNewCards = newCardsCount;
          bestDeckIndex = i;
        }
      }

      const selectedDeck = remainingDecks.splice(bestDeckIndex, 1)[0];
      finalDecks.push(selectedDeck);
      
      for (const key of selectedDeck.keys) {
        usedCards.add(key);
      }
    }

    // 5. Retorno al Frontend
    const responseDecks = finalDecks.map(d => ({ cards: d.cards }));

    return res.status(200).json({ success: true, decks: responseDecks });

  } catch (error) {
    console.error('Error general en api/scrape:', error.message);
    let errorMsg = 'Error al generar mazos. Intenta más tarde.';
    if (error.response && error.response.status === 403) {
      errorMsg = 'Error 403: API Key inválida o protección detectada.';
    }
    return res.status(500).json({ success: false, error: errorMsg, details: error.message });
  }
}
