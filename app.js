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
            throw new Error('Error al obtener datos de RoyaleAPI. Revisa el Player Tag o la conexión.');
        }
        const data = await response.json();
        const cards = data.cards;

        // Regla estricta: Si tiene menos de 8 cartas maxeadas, detener proceso y mostrar error específico.
        if (!cards || cards.length < 8) {
            showError("No tienes suficientes cartas al nivel máximo (15 o 16) para armar un mazo completo. ¡Sigue mejorando tu mazo!");
            return;
        }

        const decks = generateDecks(cards);
        renderDecks(decks);

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

function generateDecks(cards) {
    const decks = [];
    const maxDecks = 12; // Generar hasta 12 combinaciones
    const cardsPool = [...cards];
    
    // Función para barajar el array de forma aleatoria (Fisher-Yates)
    const shuffle = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    let availableForUnique = shuffle(cardsPool);
    
    // Generar las primeras 4 combinaciones sin repetir cartas si el inventario lo permite
    for (let i = 0; i < 4; i++) {
        let currentDeck = [];
        
        if (availableForUnique.length >= 8) {
            // Tomar 8 cartas que no se han usado en estas iteraciones
            currentDeck = availableForUnique.splice(0, 8);
        } else {
            // No hay suficientes cartas nuevas para no repetir
            currentDeck = [...availableForUnique]; // Tomar las que quedan disponibles
            availableForUnique = []; // Vaciar porque ya las usamos
            
            // Rellenar lo que falta con otras cartas del pool, asegurando que no se repitan dentro del mismo mazo
            const remainingNeeded = 8 - currentDeck.length;
            const fillerPool = shuffle(cardsPool).filter(c => !currentDeck.includes(c));
            currentDeck = currentDeck.concat(fillerPool.slice(0, remainingNeeded));
        }
        decks.push(currentDeck);
    }

    // Generar las opciones restantes hasta llegar a 12 (completamente aleatorias)
    while (decks.length < maxDecks) {
        const randomDeck = shuffle(cardsPool).slice(0, 8);
        decks.push(randomDeck);
    }

    return decks;
}

function renderDecks(decks) {
    const grid = document.getElementById('decks-grid');
    const resultsSec = document.getElementById('results-section');

    decks.forEach((deck, index) => {
        // Deckshop requiere los nombres de las cartas separados por coma para generar el mazo
        const keys = deck.map(c => c.key).join(',');
        const deckshopUrl = `https://www.deckshop.pro/es/deck/detail/${keys}`;

        const cardEl = document.createElement('div');
        cardEl.className = 'deck-card';

        const title = document.createElement('div');
        title.className = 'deck-header';
        title.textContent = `Combinación #${index + 1}`;
        cardEl.appendChild(title);

        const list = document.createElement('div');
        list.className = 'card-list';
        deck.forEach(c => {
            const badge = document.createElement('span');
            badge.className = 'card-badge';
            badge.textContent = c.name;
            list.appendChild(badge);
        });
        cardEl.appendChild(list);

        const link = document.createElement('a');
        link.className = 'deck-link';
        link.href = deckshopUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Ver en Deckshop';
        cardEl.appendChild(link);

        grid.appendChild(cardEl);
    });

    resultsSec.classList.remove('hidden');
}
