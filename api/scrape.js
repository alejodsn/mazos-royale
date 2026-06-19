import axios from 'axios';
import { cardRoles, isEvolution } from '../card-dictionary.js';

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
    // 1. Obtención de Inventario y filtrado de maxeadas (nivel 15, 16 y evoluciones)
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

    data.cards.forEach(card => {
      const computedLevel = 14 - card.maxLevel + card.level;
      const key = card.name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
      const hasEvolution = (card.evolutionLevel && card.evolutionLevel > 0) || isEvolution(key);
      
      const isMaxed = computedLevel >= 15 || computedLevel >= 16 || hasEvolution;
      
      if (isMaxed) {
        maxedCards.push({
          id: card.id,
          name: card.name,
          key: key,
          level: computedLevel,
          isEvolution: hasEvolution,
          elixir: card.elixir || card.cost || card.elixirCost || 3, // Default a 3 si no existe
          image: `https://cdns3.royaleapi.com/cdn-cgi/image/w=150,h=180,format=auto/static/img/cards/v9-f09d5c9d/${key}.png`
        });
      }
    });

    if (maxedCards.length < 8) {
      return res.status(200).json({ success: true, decks: [] });
    }

    // 2. Generador Heurístico Local
    const generateDecks = (pool, maxDecks = 16) => {
        const generatedDecks = [];
        const usedCounts = new Map();
        pool.forEach(c => usedCounts.set(c.key, 0));

        // Priorizamos las cartas menos usadas para fomentar variedad
        const sortByUsage = (a, b) => usedCounts.get(a.key) - usedCounts.get(b.key);
        
        const evos = pool.filter(c => c.isEvolution);

        for (let i = 0; i < 50; i++) { // Intentos para generar mazos
            if (generatedDecks.length >= maxDecks) break;

            const deckKeys = new Set();
            const deck = [];

            const addCard = (card) => {
                if (card && !deckKeys.has(card.key)) {
                    deck.push(card);
                    deckKeys.add(card.key);
                    usedCounts.set(card.key, usedCounts.get(card.key) + 1);
                }
            };

            const getAvailable = (filterFn) => pool.filter(c => filterFn(c) && !deckKeys.has(c.key)).sort(sortByUsage);

            // Regla: Exactamente 2 Evoluciones (si las tiene)
            const availableEvos = getAvailable(c => c.isEvolution);
            const evosToPick = Math.min(2, evos.length);
            for(let j = 0; j < evosToPick; j++) if(availableEvos[j]) addCard(availableEvos[j]);

            // Regla: 1 a 2 Win Conditions
            const numWc = Math.random() > 0.5 ? 2 : 1;
            const availableWc = getAvailable(c => cardRoles.win_conditions.includes(c.key));
            for(let j = 0; j < Math.min(numWc, availableWc.length); j++) if(availableWc[j] && deck.length < 8) addCard(availableWc[j]);

            // Regla: Al menos 1 Small Spell
            const availableSmall = getAvailable(c => cardRoles.small_spells.includes(c.key));
            if (availableSmall.length > 0 && deck.length < 8) addCard(availableSmall[0]);

            // Regla: Al menos 1 Anti-Air
            const availableAntiAir = getAvailable(c => cardRoles.anti_air.includes(c.key));
            if (availableAntiAir.length > 0 && deck.length < 8) addCard(availableAntiAir[0]);

            // Regla: Rellenar huecos sin repetir cartas
            while (deck.length < 8) {
                const availableAny = getAvailable(c => true);
                if (availableAny.length === 0) break;
                addCard(availableAny[0]);
            }

            if (deck.length === 8) {
                const deckId = deck.map(c => c.id).sort().join(',');
                if (!generatedDecks.some(d => d._id === deckId)) {
                    generatedDecks.push({ _id: deckId, cards: deck });
                }
            }
        }
        return generatedDecks;
    };

    const finalDecksRaw = generateDecks(maxedCards, 16);

    // 3. Calculadora de Estadísticas
    const calculateStats = (deckCards) => {
        let totalElixir = 0;
        let wcCount = 0;
        let smallSpellCount = 0;
        let bigSpellCount = 0;
        let antiAirCount = 0;
        let buildingCount = 0;
        let tankCount = 0;

        deckCards.forEach(c => {
            totalElixir += c.elixir;
            if (cardRoles.win_conditions.includes(c.key)) wcCount++;
            if (cardRoles.small_spells.includes(c.key)) smallSpellCount++;
            if (cardRoles.big_spells.includes(c.key)) bigSpellCount++;
            if (cardRoles.anti_air.includes(c.key)) antiAirCount++;
            if (cardRoles.buildings.includes(c.key)) buildingCount++;
            if (cardRoles.mini_tanks.includes(c.key) || cardRoles.heavy_tanks.includes(c.key)) tankCount++;
        });

        const averageElixir = Number((totalElixir / 8).toFixed(1));

        let attack = 40;
        if (wcCount === 1) attack += 30;
        else if (wcCount >= 2) attack += 40;
        if (smallSpellCount > 0) attack += 10;
        if (bigSpellCount > 0) attack += 10;
        attack = Math.min(100, Math.max(0, attack));

        let defense = 40;
        if (antiAirCount > 0) defense += 20;
        if (buildingCount > 0) defense += 20;
        if (tankCount > 0) defense += 20;
        defense = Math.min(100, Math.max(0, defense));

        let synergy = 30;
        if (wcCount > 0) synergy += 20;
        if (smallSpellCount > 0) synergy += 10;
        if (bigSpellCount > 0) synergy += 10;
        if (antiAirCount > 0) synergy += 20;
        if (tankCount > 0) synergy += 10;
        synergy = Math.min(100, Math.max(0, synergy));

        let balance = 100 - Math.abs(averageElixir - 3.3) * 30;
        balance = Math.max(0, Math.min(100, balance));

        return { averageElixir, attack: Math.round(attack), defense: Math.round(defense), synergy: Math.round(synergy), balance: Math.round(balance) };
    };

    const responseDecks = finalDecksRaw.map(deck => ({
        cards: deck.cards,
        stats: calculateStats(deck.cards)
    }));

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
