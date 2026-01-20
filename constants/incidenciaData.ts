export const RESERVAS_CONFIG = [
    { id: 'QRS1', loc: 'SR', start: '06:00', end: '14:00' },
    { id: 'QRS2', loc: 'SR', start: '14:00', end: '22:00' },
    { id: 'QRS0', loc: 'SR', start: '22:00', end: '06:00' },
    { id: 'QRP0', loc: 'PC', start: '22:00', end: '06:00' },
    { id: 'QRN0', loc: 'NA', start: '22:00', end: '06:00' },
    { id: 'QRF0', loc: 'PN', start: '22:00', end: '06:00' },
    { id: 'QRR0', loc: 'RB', start: '22:00', end: '06:00' },
    { id: 'QRR4', loc: 'RB', start: '21:50', end: '05:50' },
    { id: 'QRR1', loc: 'RB', start: '06:00', end: '14:00' },
    { id: 'QRR2', loc: 'RB', start: '14:00', end: '22:00' },
];

export const MAP_STATIONS = [
    { id: 'PC', label: 'Pl. Catalunya', x: 20, y: 100 }, { id: 'PR', label: 'Provença', x: 50, y: 100 }, { id: 'GR', label: 'Gràcia', x: 80, y: 100 }, { id: 'SG', label: 'Sant Gervasi', x: 110, y: 100 }, { id: 'MN', label: 'Muntaner', x: 140, y: 100 }, { id: 'BN', label: 'La Bonanova', x: 170, y: 100 }, { id: 'TT', label: 'Les Tres Torres', x: 200, y: 100 }, { id: 'SR', label: 'Sarrià', x: 230, y: 100 }, { id: 'PF', label: 'Peu del Funicular', x: 260, y: 100 }, { id: 'VL', label: 'B. Vallvidrera', x: 290, y: 100 }, { id: 'LP', label: 'Les Planes', x: 320, y: 100 }, { id: 'LF', label: 'La Floresta', x: 350, y: 100 }, { id: 'VD', label: 'Valldoreix', x: 380, y: 100 }, { id: 'SC', label: 'Sant Cugat', x: 410, y: 100 }, { id: 'PM', label: 'Pl. Molina', x: 100, y: 160 }, { id: 'PD', label: 'Pàdua', x: 130, y: 160 }, { id: 'EP', label: 'El Putxet', x: 160, y: 160 }, { id: 'TB', label: 'Av. Tibidabo', x: 190, y: 160 }, { id: 'RE', label: 'R. Elisenda', x: 260, y: 40 }, { id: 'MS', label: 'Mira-Sol', x: 440, y: 40 }, { id: 'HG', label: 'Hosp. General', x: 470, y: 40 }, { id: 'RB', label: 'Rubí Centre', x: 500, y: 40 }, { id: 'FN', label: 'Les Fonts', x: 530, y: 40 }, { id: 'TR', label: 'Terrassa Rambla', x: 560, y: 40 }, { id: 'VP', label: 'Vallparadís', x: 590, y: 40 }, { id: 'EN', label: 'Estació del Nord', x: 620, y: 40 }, { id: 'NA', label: 'Nacions Unides', x: 650, y: 40 }, { id: 'VO', label: 'Volpalleres', x: 440, y: 160 }, { id: 'SJ', label: 'Sant Joan', x: 470, y: 160 }, { id: 'BT', label: 'Bellaterra', x: 500, y: 160 }, { id: 'UN', label: 'U. Autònoma', x: 530, y: 160 }, { id: 'SQ', label: 'Sant Quirze', x: 560, y: 160 }, { id: 'CF', label: 'Can Feu', x: 590, y: 160 }, { id: 'PJ', label: 'Pl. Major', x: 620, y: 160 }, { id: 'CT', label: 'La Creu Alta', x: 650, y: 160 }, { id: 'NO', label: 'Sabadell Nord', x: 680, y: 160 }, { id: 'PN', label: 'Parc del Nord', x: 710, y: 160 },
];

export const MAP_SEGMENTS = [
    { from: 'PC', to: 'PR' }, { from: 'PR', to: 'GR' }, { from: 'GR', to: 'SG' }, { from: 'SG', to: 'MN' }, { from: 'MN', to: 'BN' }, { from: 'BN', to: 'TT' }, { from: 'TT', to: 'SR' }, { from: 'SR', to: 'PF' }, { from: 'PF', to: 'VL' }, { from: 'VL', to: 'LP' }, { from: 'LP', to: 'LF' }, { from: 'LF', to: 'VD' }, { from: 'VD', to: 'SC' }, { from: 'GR', to: 'PM' }, { from: 'PM', to: 'PD' }, { from: 'PM', to: 'PD' }, { from: 'PD', to: 'EP' }, { from: 'EP', to: 'TB' }, { from: 'SR', to: 'RE' }, { from: 'SC', to: 'MS' }, { from: 'MS', to: 'HG' }, { from: 'HG', to: 'RB' }, { from: 'RB', to: 'FN' }, { from: 'FN', to: 'TR' }, { from: 'TR', to: 'VP' }, { from: 'VP', to: 'EN' }, { from: 'EN', to: 'NA' }, { from: 'SC', to: 'VO' }, { from: 'VO', to: 'SJ' }, { from: 'SJ', to: 'BT' }, { from: 'BT', to: 'UN' }, { from: 'UN', to: 'SQ' }, { from: 'SQ', to: 'CF' }, { from: 'CF', to: 'PJ' }, { from: 'PJ', to: 'CT' }, { from: 'CT', to: 'NO' }, { from: 'NO', to: 'PN' },
];

export const MAP_CROSSOVERS = [
    { from: 'PC', to: 'PR', pos: 0.4, type: 'X' },
    { from: 'PR', to: 'GR', pos: 0.5, type: 'X' },
    { from: 'TT', to: 'SR', pos: 0.7, type: 'X' },
    { from: 'SR', to: 'PF', pos: 0.3, type: '/' },
    { from: 'VD', to: 'SC', pos: 0.7, type: 'X' },
    { from: 'SC', to: 'MS', pos: 0.4, type: '/' },
    { from: 'SC', to: 'VO', pos: 0.4, type: '\\' },
    { from: 'HG', to: 'RB', pos: 0.4, type: 'X' },
    { from: 'RB', to: 'FN', pos: 0.5, type: '/' },
    { from: 'FN', to: 'TR', pos: 0.5, type: 'X' },
    { from: 'EN', to: 'NA', pos: 0.5, type: 'X' },
    { from: 'NO', to: 'PN', pos: 0.5, type: 'X' },
    { from: 'SJ', to: 'BT', pos: 0.5, type: '/' },
    { from: 'PJ', to: 'CT', pos: 0.5, type: '/' },
];

export const S1_STATIONS = ['PC', 'PR', 'GR', 'SG', 'MN', 'BN', 'TT', 'SR', 'PF', 'VL', 'LP', 'LF', 'VD', 'SC', 'MS', 'HG', 'RB', 'FN', 'TR', 'VP', 'EN', 'NA'];
export const S2_STATIONS = ['PC', 'PR', 'GR', 'SG', 'MN', 'BN', 'TT', 'SR', 'PF', 'VL', 'LP', 'LF', 'VD', 'SC', 'VO', 'SJ', 'BT', 'UN', 'SQ', 'CF', 'PJ', 'CT', 'NO', 'PN'];
export const L6_STATIONS = ['PC', 'PR', 'GR', 'SG', 'MN', 'BN', 'TT', 'SR'];
export const L7_STATIONS = ['PC', 'PR', 'GR', 'PM', 'PD', 'EP', 'TB'];
export const L12_STATIONS = ['SR', 'RE'];
