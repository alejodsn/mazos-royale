import { metaDecks } from './meta-decks.js';

document.getElementById('search-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tag = document.getElementById('player-tag').value.trim();
    if (!tag) return;

    const loading = document.getElementById('loading');
    const errorEl = document.getElementById('error-message');
    const resultsSec = document.getElementById('results-section');
    const grid = document.getElementById('decks-grid');

    // Resetear UI
    loading.classList.remove('hidden');
    errorEl.classList.add('hidden');
    resultsSec.classList.add('hidden');
    grid.innerHTML = '';

    try {
        const apiUrl = `/api/scrape?tag=${encodeURIComponent(tag)}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error('Error al obtener datos. Revisa el Player Tag o la conexión.');
        }
        
        const data = await response.json();
        const playerCards = data.cards;

        if (!playerCards || playerCards.length < 8) {
            showError("No tienes suficientes cartas al nivel máximo (15 o 16) para armar un mazo completo.");
            return;
        }

        const matchedDecks = findMatchingDecks(playerCards, metaDecks);
        
        if (matchedDecks.length === 0) {
            showError("No hemos encontrado ningún mazo Meta en el que tengas las 8 cartas al máximo (y sus evoluciones requeridas). ¡Sigue mejorando tu cuenta!");
            return;
        }

        renderDecks(matchedDecks, playerCards);

    } catch (error) {
        showError(error.message);
    } finally {
        loading.classList.add('hidden');
    }
});

function showError(msg) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}

function findMatchingDecks(playerCards, metaDecks) {
    return metaDecks.filter(deck => {
        // El jugador debe poseer las 8 cartas del mazo Meta
        return deck.cards.every(reqCard => {
            const pCard = playerCards.find(c => c.id === reqCard.id);
            if (!pCard) return false; // No tiene la carta maxeada
            
            // Si el mazo Meta requiere que la carta sea Evolución, el jugador debe tenerla evolucionada
            if (reqCard.reqEvo && !pCard.isEvolution) {
                return false;
            }
            return true;
        });
    });
}

function renderDecks(decks, playerCards) {
    const grid = document.getElementById('decks-grid');
    const resultsSec = document.getElementById('results-section');

    decks.forEach((deck, index) => {
        // Generar Deep Link de Clash Royale concatenando IDs
        const ids = deck.cards.map(c => c.id).join(';');
        const deepLink = `https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=${ids}`;

        const cardEl = document.createElement('div');
        cardEl.className = 'deck-card';

        const title = document.createElement('div');
        title.className = 'deck-header';
        title.textContent = deck.name;
        cardEl.appendChild(title);

        const list = document.createElement('div');
        list.className = 'card-list';
        
        deck.cards.forEach(c => {
            // Obtener el nivel real de la carta del jugador (por defecto 15 si hay fallback)
            const pCard = playerCards.find(pc => pc.id === c.id);
            const level = pCard ? pCard.level : 15;

            const cardWrapper = document.createElement('div');
            cardWrapper.className = `card-wrapper ${c.reqEvo ? 'is-evo' : ''}`;

            // Imagen desde el CDN de RoyaleAPI
            const imgUrl = `https://cdns3.royaleapi.com/cdn-cgi/image/w=150,h=180,format=auto/static/img/cards/v9-f09d5c9d/${c.key}.png`;
            const img = document.createElement('img');
            img.className = 'card-image';
            img.src = imgUrl;
            img.alt = c.key;
            img.title = c.key;

            const elixirBadge = document.createElement('div');
            elixirBadge.className = 'elixir-badge';
            elixirBadge.textContent = c.elixir;

            const levelBadge = document.createElement('div');
            levelBadge.className = 'level-badge';
            levelBadge.textContent = `Lvl ${level}`;

            cardWrapper.appendChild(img);
            cardWrapper.appendChild(elixirBadge);
            cardWrapper.appendChild(levelBadge);
            
            list.appendChild(cardWrapper);
        });
        cardEl.appendChild(list);

        const link = document.createElement('a');
        link.className = 'deck-link';
        link.href = deepLink;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Copiar Mazo a CR';
        cardEl.appendChild(link);

        grid.appendChild(cardEl);
    });

    resultsSec.classList.remove('hidden');
}
