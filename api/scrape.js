const axios = require('axios');
const cheerio = require('cheerio');

// Función auxiliar para mezclar arreglos aleatoriamente
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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
    // === FASE 1: Obtener inventario desde la API Oficial ===
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
    const maxedCards = [];
    const cardDictionary = {}; 

    data.cards.forEach(card => {
      const isElite = card.level >= card.maxLevel;
      const hasEvolution = card.evolutionLevel && card.evolutionLevel > 0;
      const isMaxed = isElite || hasEvolution;
      
      const key = card.name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
      
      const cardObj = {
        id: card.id,
        name: card.name,
        key: key,
        level: isElite ? 15 : (14 - card.maxLevel + card.level),
        isEvolution: hasEvolution,
        image: `https://cdns3.royaleapi.com/cdn-cgi/image/w=150,h=180,format=auto/static/img/cards/v9-f09d5c9d/${key}.png`
      };

      cardDictionary[key] = cardObj;

      if (!isMaxed) {
        unmaxedKeys.push(key);
      } else {
        maxedCards.push(cardObj);
      }
    });

    if (maxedCards.length < 8) {
      return res.status(200).json({ success: true, decks: [] });
    }

    // === INTENTO A: Búsqueda Meta por exclusión en Deck Shop ===
    const excString = unmaxedKeys.join(',');
    const deckshopUrl = `https://www.deckshop.pro/es/deck/list?exc=${excString}`;
    
    let foundDecks = [];
    try {
      const deckshopRes = await axios.get(deckshopUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
          'Accept': 'text/html'
        }
      });

      const $ = cheerio.load(deckshopRes.data);
      
      $('a[href*="/deck/detail/"]').each((i, el) => {
        if (foundDecks.length >= 12) return false; 
        
        const href = $(el).attr('href');
        const match = href.match(/\/deck\/detail\/([^?#]+)/);
        if (match && match[1]) {
          const keys = match[1].split(',');
          if (keys.length === 8 && keys.every(k => cardDictionary[k])) {
            const deckCards = keys.map(k => cardDictionary[k]);
            const deckId = keys.slice().sort().join(',');
            if (!foundDecks.find(d => d._id === deckId)) {
              foundDecks.push({ _id: deckId, cards: deckCards });
            }
          }
        }
      });
    } catch (e) {
      console.warn("Intento A (Deckshop List) falló o no dio resultados válidos:", e.message);
    }

    // Si el Intento A encontró al menos 1 mazo, terminamos y respondemos.
    if (foundDecks.length > 0) {
      const finalDecks = foundDecks.map(d => ({ cards: d.cards }));
      return res.status(200).json({ success: true, decks: finalDecks });
    }

    // === INTENTO B: Generador Local + Validador Deck Shop (Fallback) ===
    const evos = maxedCards.filter(c => c.isEvolution);
    let normals = maxedCards.filter(c => !c.isEvolution);

    // Si el jugador no tiene suficientes cartas normales pero sí muchas evoluciones,
    // podemos usar evoluciones como cartas normales para rellenar (Deckshop lo permite).
    if (normals.length < 6) {
      const needed = 6 - normals.length;
      normals.push(...evos.slice(2, 2 + needed));
    }

    const candidateDecks = [];
    let attempts = 0;
    
    // Generador: Crear 5 combinaciones diferentes
    while (candidateDecks.length < 5 && attempts < 50) {
      attempts++;
      
      // Regla de oro: 2 evoluciones (si las tiene) y 6 normales.
      const numEvos = Math.min(2, evos.length); 
      const numNormals = 8 - numEvos;
      
      if (normals.length < numNormals) break; // Imposible formar un mazo de 8
      
      const selectedEvos = shuffle(evos).slice(0, numEvos);
      const selectedNormals = shuffle(normals).slice(0, numNormals);
      
      const combo = [...selectedEvos, ...selectedNormals];
      const comboId = combo.map(c => c.id).sort().join(',');
      
      if (combo.length === 8 && !candidateDecks.find(d => d._id === comboId)) {
        candidateDecks.push({ _id: comboId, cards: combo });
      }
    }

    // Validador: Scraping al Checker de Deck Shop
    const approvedDecks = [];
    
    // Promise.all para manejar las peticiones simultáneas de forma eficiente
    await Promise.all(candidateDecks.map(async (deck) => {
       // La URL usa las keys separadas por guiones, ej: hog-rider-knight-log...
       const keysUrl = deck.cards.map(c => c.key).join('-');
       const checkUrl = `https://www.deckshop.pro/es/check/?deck=${keysUrl}`;
       
       try {
          const checkRes = await axios.get(checkUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
              'Accept': 'text/html'
            }
          });
          
          const $c = cheerio.load(checkRes.data);
          let isApproved = true;
          
          // Buscar explícitamente palabras de rechazo en los textos del validador
          $c('td, span, div, .text-danger, .text-warning').each((i, el) => {
            const text = $c(el).text().trim().toLowerCase();
            if (text === 'malo' || text === 'mediocre') {
              isApproved = false;
            }
          });

          // Criterio de aprobación: No debe tener calificaciones de 'malo' o 'mediocre' en Ataque/Defensa/Sinergia.
          // Por defecto las demás son 'bueno', 'genial', 'excelente' o 'divino'.
          if (isApproved) {
            approvedDecks.push(deck);
          }
       } catch (err) {
          console.warn("Fallo al validar un mazo en el checker:", err.message);
       }
    }));

    // Retorno de los mazos que aprobaron la validación heurística
    const finalApproved = approvedDecks.map(d => ({ cards: d.cards }));
    return res.status(200).json({ success: true, decks: finalApproved });

  } catch (error) {
    console.error('Error general en api/scrape:', error.message);
    let errorMsg = 'Error al generar mazos verificados. Intenta más tarde.';
    if (error.response && error.response.status === 403) {
      errorMsg = 'Error 403: API Key inválida o protección detectada en Deckshop.';
    }
    return res.status(500).json({ success: false, error: errorMsg, details: error.message });
  }
}
