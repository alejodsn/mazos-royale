const axios = require('axios');

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
    return res.status(400).json({ error: 'El Player Tag es requerido' });
  }

  const cleanTag = tag.replace('#', '').trim().toUpperCase();
  const targetUrl = new URL(`https://proxy.royaleapi.dev/v1/players/%23${cleanTag}`);

  try {
    const response = await axios.get(targetUrl.href, {
      headers: {
        'Authorization': `Bearer ${process.env.CR_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    const data = response.data;
    const maxCards = [];

    if (data && data.cards) {
      data.cards.forEach(card => {
        const isElite = card.level >= card.maxLevel;
        const hasEvolution = card.evolutionLevel && card.evolutionLevel > 0;
        
        if (isElite || hasEvolution) {
           maxCards.push({
             id: card.id,
             name: card.name,
             key: card.name.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-'),
             level: isElite ? 15 : (14 - card.maxLevel + card.level),
             isEvolution: hasEvolution
           });
        }
      });
    }

    const uniqueCards = Array.from(new Set(maxCards.map(c => c.key)))
      .map(key => maxCards.find(c => c.key === key));

    return res.status(200).json({ cards: uniqueCards });

  } catch (error) {
    console.error('--- ERROR AL OBTENER DATOS DE LA API OFICIAL ---');
    console.error('Mensaje de error:', error.message);
    
    if (error.response) {
      console.error('Status Code:', error.response.status);
    }
    console.error('-------------------------------------------');

    let errorMsg = 'No se pudo obtener la información. Verifica que el Player Tag sea correcto.';
    if (error.response && error.response.status === 403) {
      errorMsg = 'Error 403: Clave de API (CR_API_KEY) inválida o no configurada.';
    } else if (error.response && error.response.status === 404) {
      errorMsg = 'Error 404: Jugador no encontrado.';
    }

    return res.status(500).json({ error: errorMsg, details: error.message });
  }
}
