export const resolveStationId = (name: string, linia: string = '') => {
    const n = (name || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    if (n.includes('CATALUNYA') || n === 'PC') return 'PC';
    if (n.includes('PROVEN') || n === 'PR') return 'PR';
    if (n.includes('GRACIA') || n === 'GR') return 'GR';
    if (n.includes('GERVASI') || n === 'SG') return 'SG';
    if (n.includes('MUNTANER') || n === 'MN') return 'MN';
    if (n.includes('BONANOVA') || n === 'BN') return 'BN';
    if (n.includes('TRES TORRES') || n === 'TT') return 'TT';
    if (n.includes('SARRIA') || n === 'SR') return 'SR';
    if (n.includes('ELISENDA') || n === 'RE') return 'RE';
    if (n.includes('TIBIDABO') || n === 'TB') return 'TB';
    if (n.includes('CUGAT') || n === 'SC') return 'SC';

    if (n.includes('RUBI') || n.includes('TALLER') || n.includes('COTXERA') || n.includes('MERCADERIES') || n.includes('RAMAL') || n.includes('APARTADOR') || n === 'RB') return 'RB';
    if (n.includes('RAMBLA') || n === 'TR') return 'TR';
    if (n.includes('NACIO') || n.includes('UNIDES') || n === 'NA') return 'NA';
    if (n.includes('FONTS') || n === 'FN') return 'FN';
    if (n.includes('HOSP') || n.includes('GENERAL') || n === 'HG') return 'HG';
    if (n.includes('MIRA') || n === 'MS') return 'MS';
    if (n.includes('VALLPARADIS') || n === 'VP') return 'VP';
    if (n.includes('NORD') && n.includes('ESTACIO') || n === 'EN') return 'EN';

    if (n.includes('VOLPALLERES') || n === 'VO') return 'VO';
    if (n.includes('JOAN') || n === 'SJ') return 'SJ';
    if (n.includes('BELLATERRA') || n === 'BT') return 'BT';
    if (n.includes('AUTONOMA') || n.includes('UAB') || n.includes('UNIVERSITAT') || n === 'UN') return 'UN';
    if (n.includes('QUIRZE') || n === 'SQ') return 'SQ';
    if (n.includes('FEU') || n.includes('CF') || n === 'CF') return 'CF';
    if (n.includes('MAJOR') || n === 'PJ') return 'PJ';
    if (n.includes('CREU') || n === 'CT') return 'CT';
    if (n.includes('SABADELL NORD') || n === 'NO') return 'NO';
    if (n.includes('PARC') || n === 'PN') return 'PN';

    if (n.includes('MOLINA') || n === 'PM') return 'PM';
    if (n.includes('PADUA') || n === 'PD') return 'PD';
    if (n.includes('PUTXET') || n === 'EP') return 'EP';

    if (n.includes('FLORESTA') || n === 'LF') return 'LF';
    if (n.includes('VALLDOREIX') || n === 'VD') return 'VD';
    if (n.includes('PLANES') || n === 'LP') return 'LP';
    if (n.includes('PEU') || n === 'PF') return 'PF';
    if (n.includes('BAIXADOR') || n === 'VL') return 'VL';

    return n.length > 2 ? n.substring(0, 2) : n;
};

export function getFgcMinutes(timeStr: string | undefined): number | null {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return null;
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    let total = h * 60 + m;
    if (h < 4) total += 24 * 60;
    return total;
}

export function formatFgcTime(totalMinutes: number) {
    let mins = totalMinutes;
    if (mins >= 24 * 60) mins -= 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export const getLiniaColorHex = (linia: string) => {
    const l = linia?.toUpperCase().trim() || '';
    if (l.startsWith('F')) return '#22c55e';
    if (l === 'L7' || l === '300') return '#8B4513';
    if (l === 'L6' || l === '100') return '#9333ea';
    if (l === 'L12') return '#d8b4fe';
    if (l === 'S1' || l === '400') return '#f97316';
    if (l === 'S2' || l === '500') return '#22c55e';
    return '#6b7280';
};

export const getShortTornId = (id: string) => {
    const trimmed = id.trim();
    if (trimmed.startsWith('Q') && !trimmed.startsWith('QR') && trimmed.length === 5) return trimmed[0] + trimmed.slice(2);
    return trimmed;
};
