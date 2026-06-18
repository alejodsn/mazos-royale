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

  // Asegurarnos de tener el tag limpio, sin #
  const cleanTag = tag.replace('#', '').trim().toUpperCase();

  // Utilizar el proxy de RoyaleAPI para evitar bloqueos por IP a la API oficial
  // Nota: Codificamos el # como %23 dentro de la URL como exige la API oficial
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

    // Validar que la API devolvió las cartas del jugador
    if (data && data.cards) {
      data.cards.forEach(card => {
        // En la API Oficial, el nivel Elite (15) se alcanza cuando card.level es igual (o mayor) a card.maxLevel.
        // Además, si el usuario solicitó incluir cartas con evoluciones activas (nivel 16/Evolución):
        const isElite = card.level >= card.maxLevel;
        const hasEvolution = card.evolutionLevel && card.evolutionLevel > 0;
        
        if (isElite || hasEvolution) {
           maxCards.push({
             name: card.name,
             // Mapeo al formato de Deckshop (solo minúsculas y números)
             key: card.name.toLowerCase().replace(/[^a-z0-9]/g, '')
           });
        }
      });
    }

    // Eliminar posibles duplicados
    const uniqueCards = Array.from(new Set(maxCards.map(c => c.key)))
      .map(key => maxCards.find(c => c.key === key));

    // Devolver exactamente la estructura JSON esperada por app.js
    return res.status(200).json({ cards: uniqueCards });

  } catch (error) {
    console.error('--- ERROR AL OBTENER DATOS DE LA API OFICIAL ---');
    console.error('Mensaje de error:', error.message);
    
    if (error.response) {
      console.error('Status Code:', error.response.status);
      console.error('Data de Respuesta:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('La petición fue enviada pero no hubo respuesta');
    } else {
      console.error('Error al configurar la petición:', error.message);
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
