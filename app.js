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

        if (!data.success) {
            throw new Error(data.error || 'Ocurrió un error inesperado al conectar con el servidor.');
        }

        const decks = data.decks;

        if (!decks || decks.length === 0) {
            showError("No logramos encontrar mazos competitivos que utilicen exclusivamente tus cartas maxeadas. ¡Sigue mejorando tu cuenta!");
            return;
        }

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

function renderDecks(decks) {
    const grid = document.getElementById('decks-grid');
    const resultsSec = document.getElementById('results-section');

    decks.forEach((deck, index) => {
        // Generar Deep Link de Clash Royale concatenando los IDs
        const ids = deck.cards.map(c => c.id).join(';');
        const deepLink = `https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=${ids}`;

        const cardEl = document.createElement('div');
        cardEl.className = 'deck-card';

        const headerRow = document.createElement('div');
        headerRow.className = 'deck-header-row';

        const title = document.createElement('div');
        title.className = 'deck-header';
        title.textContent = `Mazo Meta #${index + 1}`;

        const elixirContainer = document.createElement('div');
        elixirContainer.className = 'elixir-average';
        elixirContainer.textContent = `💧 ${deck.stats.averageElixir}`;

        headerRow.appendChild(title);
        headerRow.appendChild(elixirContainer);
        cardEl.appendChild(headerRow);

        const list = document.createElement('div');
        list.className = 'card-list';
        
        deck.cards.forEach(c => {
            const cardWrapper = document.createElement('div');
            cardWrapper.className = `card-wrapper ${c.isEvolution ? 'is-evo' : ''}`;

            const img = document.createElement('img');
            img.className = 'card-image';
            img.src = c.image;
            img.alt = c.name;
            img.title = c.name;

            const levelBadge = document.createElement('div');
            levelBadge.className = 'level-badge';
            levelBadge.textContent = `Lvl ${c.level}`;

            cardWrapper.appendChild(img);
            cardWrapper.appendChild(levelBadge);
            
            list.appendChild(cardWrapper);
        });
        cardEl.appendChild(list);

        // Contenedor de Estadísticas
        const statsContainer = document.createElement('div');
        statsContainer.className = 'stats-container';

        const createBar = (label, value, colorClass) => {
            const barWrapper = document.createElement('div');
            barWrapper.className = 'stat-wrapper';

            const labelEl = document.createElement('div');
            labelEl.className = 'stat-label';
            labelEl.textContent = `${label} (${value}%)`;

            const track = document.createElement('div');
            track.className = 'stat-track';

            const fill = document.createElement('div');
            fill.className = `stat-fill ${colorClass}`;
            fill.style.width = `${value}%`;

            track.appendChild(fill);
            barWrapper.appendChild(labelEl);
            barWrapper.appendChild(track);
            
            return barWrapper;
        };

        statsContainer.appendChild(createBar('Ataque', deck.stats.attack, 'fill-attack'));
        statsContainer.appendChild(createBar('Defensa', deck.stats.defense, 'fill-defense'));
        statsContainer.appendChild(createBar('Sinergia', deck.stats.synergy, 'fill-synergy'));
        statsContainer.appendChild(createBar('Balance', deck.stats.balance, 'fill-balance'));

        cardEl.appendChild(statsContainer);

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
