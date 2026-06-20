// card-dictionary.js
// Diccionario heurístico para la evaluación de sinergia en mazos de Clash Royale

export const cardRoles = {
  champions: [
    'archer-queen', 'golden-knight', 'skeleton-king', 'mighty-miner', 
    'monk', 'little-prince'
  ],
  win_conditions: [
    'hog-rider', 'goblin-drill', 'miner', 'balloon', 'x-bow', 'mortar', 
    'golem', 'royal-giant', 'giant', 'goblin-giant', 'lava-hound', 
    'ram-rider', 'skeleton-barrel', 'wall-breakers', 'royal-hogs', 
    'graveyard', 'goblin-barrel', 'elixir-golem', 'electro-giant'
  ],
  
  small_spells: [
    'zap', 'the-log', 'giant-snowball', 'barbarian-barrel', 'arrows', 
    'rage', 'freeze', 'clone', 'tornado'
  ],
  
  big_spells: [
    'fireball', 'poison', 'rocket', 'lightning', 'earthquake', 'void'
  ],
  
  anti_air: [
    'musketeer', 'electro-wizard', 'firecracker', 'dart-goblin', 'flying-machine', 
    'hunter', 'magic-archer', 'minions', 'minion-horde', 'bats', 
    'archers', 'spear-goblins', 'electro-dragon', 'baby-dragon', 'inferno-dragon', 
    'skeleton-dragons', 'phoenix', 'mega-minion', 'zappies', 'ice-wizard', 
    'princess', 'wizard', 'witch', 'executioner', 'mother-witch', 'archer-queen',
    'little-prince'
  ],
  
  mini_tanks: [
    'knight', 'valkyrie', 'ice-golem', 'mini-pekka', 'lumberjack', 'bandit', 
    'royal-ghost', 'dark-prince', 'prince', 'mighty-miner', 'golden-knight', 
    'skeleton-king', 'monk', 'miner'
  ],
  
  heavy_tanks: [
    'golem', 'pekka', 'mega-knight', 'giant', 'goblin-giant', 'lava-hound', 
    'royal-giant', 'electro-giant', 'giant-skeleton', 'bowler'
  ],
  
  buildings: [
    'cannon', 'tesla', 'bomb-tower', 'inferno-tower', 'x-bow', 'mortar', 
    'goblin-hut', 'barbarian-hut', 'furnace', 'tombstone', 'elixir-collector', 
    'goblin-drill'
  ],
  
  swarms: [
    'skeleton-army', 'goblin-gang', 'goblins', 'spear-goblins', 'minion-horde', 
    'barbarians', 'royal-recruits', 'rascals', 'guards', 'skeletons', 
    'minions', 'bats'
  ],
  
  cycle_cards: [
    'skeletons', 'ice-spirit', 'fire-spirit', 'electro-spirit', 'heal-spirit', 
    'goblins', 'spear-goblins', 'bats', 'zap', 'giant-snowball', 
    'the-log', 'barbarian-barrel', 'ice-golem'
  ]
};

// Función auxiliar para verificar si una carta es una evolución 
// (Las APIs suelen añadir "-evo" al nombre clave, o manejarlo por nivel/bandera)
export const isEvolution = (cardName) => {
    return cardName.endsWith('-evo');
};
