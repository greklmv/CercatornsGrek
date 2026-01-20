import React, { useState, useEffect, useMemo } from 'react';
import { Activity, X, FilePlus, Users, Train, Minus, Plus, User, ShieldAlert, Phone, LayoutGrid, Loader2, Info } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { fetchFullTurns } from '../../utils/queries';
import { resolveStationId, getFgcMinutes, formatFgcTime, getLiniaColorHex, getShortTornId } from '../../utils/incidenciaUtils';
import { MAP_STATIONS, MAP_SEGMENTS, S1_STATIONS, S2_STATIONS, L6_STATIONS, L7_STATIONS, L12_STATIONS } from '../../constants/incidenciaData';
import { DividedPersonnel } from '../../types';

interface AlternativeServiceOverlayProps {
    islandId: string;
    onClose: () => void;
    dividedPersonnel: DividedPersonnel;
    displayMin: number;
    garageOccupation?: Record<string, number>;
    selectedCutSegments?: Set<string>;
}

const AlternativeServiceOverlay: React.FC<AlternativeServiceOverlayProps> = ({ islandId, onClose, dividedPersonnel, displayMin, garageOccupation = {}, selectedCutSegments = new Set() }) => {
    const [viewMode, setViewMode] = useState<'RESOURCES' | 'CIRCULATIONS' | 'SHIFTS'>('RESOURCES');
    const [generatedCircs, setGeneratedCircs] = useState<any[]>([]);
    const [generating, setGenerating] = useState(false);

    if (!dividedPersonnel || !dividedPersonnel[islandId]) return null;
    const personnel = dividedPersonnel[islandId].list;
    const islandStations = dividedPersonnel[islandId].stations;
    const physicalTrains = personnel.filter(p => p.type === 'TRAIN');
    const allDrivers = [...personnel];

    // Correct Logic: physicalTrains contains ALL units in the island (Active + Parked).
    // derived from liveData/GeoTren.
    // specific status check:
    const activeFleet = physicalTrains.filter(t => (t as any).deducedCirculationId); // Active
    const garageFleet = physicalTrains.filter(t => !(t as any).deducedCirculationId); // Parked/Depot

    const totalUnitsAvailable = physicalTrains.length; // Active + Garage are already in here

    // Geographic Branch Detection refined by station sets
    const canSupportS1 = Array.from(islandStations).some(s => S1_STATIONS.includes(s));
    const canSupportS2 = Array.from(islandStations).some(s => S2_STATIONS.includes(s));
    const canSupportL6 = Array.from(islandStations).some(s => L6_STATIONS.includes(s));
    const canSupportL7Full = islandStations.has('PC') && islandStations.has('TB');
    const canSupportL7Local = islandStations.has('GR') && islandStations.has('TB') && !canSupportL7Full;
    const canSupportL12 = islandStations.has('SR') && islandStations.has('RE');

    const [lineCounts, setLineCounts] = useState<Record<string, number>>({
        S1: 0, S2: 0, L6: 0, L7: 0, L12: 0
    });
    const [manualHeadway, setManualHeadway] = useState<number | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initial calculation for reasonable defaults
    useEffect(() => {
        if (isInitialized) return;

        const initial = { S1: 0, S2: 0, L6: 0, L7: 0, L12: 0 };
        // Feature: Maximize service. Use Physical Trains + Garage Units.
        // But capped by available drivers.
        let avUnits = totalUnitsAvailable;
        let avDrivers = allDrivers.length;

        const tryInc = (linia: string) => {
            if (avUnits > 0 && avDrivers > 0) {
                initial[linia as keyof typeof initial]++;
                avUnits--;
                avDrivers--;
                return true;
            }
            return false;
        };

        if (canSupportL12) tryInc("L12");

        if (canSupportL7Full || canSupportL7Local) {
            const l7TrainsInIsland = physicalTrains.filter(t => t.linia === 'L7' || t.linia === '300').length;
            // Try to put at least the physical ones, or more if needed/available?
            // Standard L7 service usually needs ~3-4 trains.
            let l7Target = l7TrainsInIsland >= 4 ? 3 : Math.max(2, l7TrainsInIsland);
            // If we have extra drivers/garage units, maybe boost L7? 
            // For now keep conservative default but allow filling.
            for (let i = 0; i < l7Target; i++) tryInc("L7");
        }

        let cycle = 0;
        // Distribute remaining capacity among main lines
        while (avUnits > 0 && avDrivers > 0 && cycle < 30) {
            let changed = false;
            if (canSupportS1 && tryInc("S1")) changed = true;
            if (canSupportS2 && tryInc("S2")) changed = true;
            if (canSupportL6 && tryInc("L6")) changed = true;

            if (!changed) break;
            cycle++;
        }

        // Fallback if nothing assigned but resources available
        if (Object.values(initial).reduce((a, b) => a + b, 0) === 0 && avUnits > 0 && avDrivers > 0) {
            if (canSupportS1) initial.S1 = 1; else initial.S2 = 1;
        }

        setLineCounts(initial);
        setIsInitialized(true);
    }, [islandId, physicalTrains.length, allDrivers.length, isInitialized]);

    const updateCount = (linia: string, delta: number) => {
        setLineCounts(prev => {
            const nextValue = Math.max(0, prev[linia] + delta);
            const totalOther = Object.entries(prev)
                .filter(([k]) => k !== linia)
                .reduce((sum, [_, v]) => sum + v, 0);

            // Block if exceeding total available units (Physical + Garage)
            if (delta > 0 && (totalOther + nextValue > totalUnitsAvailable)) {
                return prev;
            }
            return { ...prev, [linia]: nextValue };
        });
    };

    const shuttlePlan = useMemo(() => {
        // Dynamic Pools from the categorization
        const activePool = [...activeFleet];
        const garagePool = [...garageFleet];
        const availableDrivers = [...allDrivers];
        const formedServices: any[] = [];

        const tryAssign = (route: string, priority: string, liniaCode: string) => {
            // Priority: Active Fleet FIRST, then Garage Fleet
            // We can assign if we have units in either pool
            if (activePool.length > 0 || garagePool.length > 0) {
                const train = activePool.length > 0 ? activePool.shift() : garagePool.shift();
                const driver = availableDrivers.length > 0 ? availableDrivers.shift() : { driver: 'PENDENT assignació', torn: '---', phones: [] };

                formedServices.push({ train, driver: driver!, route, priority, liniaCode });
                return true;
            }
            return false;
        };

        const getRouteForLinia = (linia: string) => {
            switch (linia) {
                case 'L12': return "L12 (Shuttle SR-RE)";
                case 'L7': return canSupportL7Full ? "L7 (Shuttle PC-TB)" : "L7 (Shuttle GR-TB)";
                case 'S1': return "S1 (Llançadora Terrassa)";
                case 'S2': return "S2 (Llançadora Sabadell)";
                case 'L6': return "L6 (Reforç Urbà)";
                default: return "Llançadora Local";
            }
        };

        // Order: L12, L6, L7, S1, S2
        const LINE_ORDER = ['L12', 'L6', 'L7', 'S1', 'S2'];

        LINE_ORDER.forEach(linia => {
            const count = lineCounts[linia] || 0;
            const route = getRouteForLinia(linia);
            const priority = (linia === 'S1' || linia === 'S2') ? 'ALTA' : 'MITJA';
            for (let i = 0; i < count; i++) {
                tryAssign(route, priority, linia);
            }
        });

        return formedServices;
    }, [lineCounts, activeFleet, garageFleet, allDrivers, canSupportL7Full]);

    const handleGenerateCirculations = async () => {
        setGenerating(true);
        setViewMode('CIRCULATIONS');

        try {
            const { data: theoryCircs } = await supabase.from('circulations').select('*');
            if (!theoryCircs) return;

            const liniaPrefixes: Record<string, string> = { 'S1': 'D', 'S2': 'F', 'L6': 'A', 'L7': 'B', 'L12': 'L' };
            const liniaStationsRef: Record<string, string[]> = { 'S1': S1_STATIONS, 'S2': S2_STATIONS, 'L6': L6_STATIONS, 'L7': L7_STATIONS, 'L12': L12_STATIONS };

            const getEndpoints = (lineStations: string[]) => {
                const present = lineStations.filter(s => islandStations.has(s));
                if (present.length < 2) return null;
                const indices = present.map(s => lineStations.indexOf(s));
                const minIdx = Math.min(...indices);
                const maxIdx = Math.max(...indices);
                return { start: lineStations[minIdx], end: lineStations[maxIdx], length: maxIdx - minIdx };
            };

            const plan: any[] = [];
            const resourcesByLinia: Record<string, any[]> = {};
            shuttlePlan.forEach(s => {
                if (!resourcesByLinia[s.liniaCode]) resourcesByLinia[s.liniaCode] = [];
                resourcesByLinia[s.liniaCode].push(s);
            });

            const activeSimultaneous = Math.min(physicalTrains.length, allDrivers.length);
            const LINE_ORDER = ['L12', 'L6', 'L7', 'S1', 'S2'];

            // Initialize Driver Pool with current personnel
            let driverPool = allDrivers.map(d => ({
                ...d,
                currentStation: d.stationId,
                availableAt: displayMin,
                activeShiftEnd: d.shiftEndMin || 1620,
                activeShiftDep: d.shiftDep || d.stationId
            }));

            // FETCH FUTURE SHIFTS: Include turnos that start later in the island
            const { data: allShifts } = await supabase.from('shifts').select('*');
            const { data: allDaily } = await supabase.from('daily_assignments').select('*');

            if (allShifts && allDaily) {
                allShifts.forEach(s => {
                    const startMin = getFgcMinutes(s.inici_torn);
                    if (startMin !== null && startMin >= displayMin) {
                        const dep = resolveStationId(s.dependencia || '');
                        if (islandStations.has(dep)) {
                            // Check if this driver is already in the pool
                            if (!driverPool.some(d => d.torn === s.id)) {
                                const assignment = allDaily.find(d => getShortTornId(s.id) === d.torn);
                                if (assignment) {
                                    driverPool.push({
                                        type: 'REST', id: 'PROPER', linia: 'S/L', stationId: dep, color: '#53565A',
                                        driver: `${assignment.cognoms}, ${assignment.nom}`,
                                        driverName: assignment.nom,
                                        driverSurname: assignment.cognoms,
                                        torn: s.id,
                                        shiftStartMin: startMin,
                                        shiftEndMin: getFgcMinutes(s.final_torn) || 1620,
                                        shiftDep: dep,
                                        currentStation: dep,
                                        availableAt: startMin,
                                        activeShiftEnd: getFgcMinutes(s.final_torn) || 1620,
                                        activeShiftDep: dep,
                                        phones: [], // Could fetch if needed
                                        x: 0, y: 0
                                    });
                                }
                            }
                        }
                    }
                });
            }

            // Simple BFS function for path finding within graph
            const getFullPath = (start: string, end: string): string[] => {
                if (start === end) return [start];
                // Build adjacency graph from segments
                const graph: Record<string, string[]> = {};
                MAP_SEGMENTS.forEach(seg => {
                    if (!graph[seg.from]) graph[seg.from] = [];
                    if (!graph[seg.to]) graph[seg.to] = [];
                    if (!graph[seg.from].includes(seg.to)) graph[seg.from].push(seg.to);
                    if (!graph[seg.to].includes(seg.from)) graph[seg.to].push(seg.from);
                });

                const queue: { node: string, path: string[] }[] = [{ node: start, path: [start] }];
                const visited = new Set<string>([start]);

                while (queue.length > 0) {
                    const { node, path } = queue.shift()!;
                    if (node === end) return path;

                    const neighbors = graph[node] || [];
                    for (const neighbor of neighbors) {
                        if (!visited.has(neighbor)) {
                            visited.add(neighbor);
                            queue.push({ node: neighbor, path: [...path, neighbor] });
                        }
                    }
                }
                return [start];
            };

            for (const liniaCode of LINE_ORDER) {
                const count = lineCounts[liniaCode];
                if (count === 0) continue;

                const eps = getEndpoints(liniaStationsRef[liniaCode]);
                if (!eps) continue;

                const prefix = liniaPrefixes[liniaCode];
                const areaTheory = (theoryCircs as any[]).filter(c => c.linia === liniaCode);

                const lineTheory = (theoryCircs as any[]).filter(c => c.linia === liniaCode);
                let maxAscStartedNum = 0;
                let maxDescStartedNum = 0;
                let maxServiceTime = displayMin + 180; // Default buffer (3h)

                lineTheory.forEach(c => {
                    const numPart = c.id.replace(/\D/g, '');
                    const n = parseInt(numPart);
                    const m = getFgcMinutes(c.sortida);

                    // 1. Tracks latest standard started trains (0xx/1xx) for numbering
                    if (m !== null && m <= displayMin) {
                        if (!isNaN(n) && (numPart[0] === '0' || numPart[0] === '1')) {
                            if (n % 2 !== 0) { // ODD = ASC
                                if (n > maxAscStartedNum) maxAscStartedNum = n;
                            } else { // EVEN = DESC
                                if (n > maxDescStartedNum) maxDescStartedNum = n;
                            }
                        }
                    }

                    // 2. Tracks end of service in the island
                    const hasTouch = [c.inici, c.final, ...(c.estacions?.map((s: any) => s.nom) || [])].some(st => islandStations.has(st));
                    if (hasTouch && m !== null && m > maxServiceTime) {
                        maxServiceTime = m;
                    }
                });

                let nextAscNum = maxAscStartedNum + 2;
                let nextDescNum = maxDescStartedNum + 2;

                let refTravelTime = 15;
                const sample = areaTheory
                    .filter(c => {
                        const stops = [c.inici, ...(c.estacions?.map((s: any) => s.nom) || []), c.final];
                        return stops.includes(eps.start) && stops.includes(eps.end);
                    })
                    .sort((a, b) => (getFgcMinutes(b.sortida) || 0) - (getFgcMinutes(a.sortida) || 0))[0];

                if (sample) {
                    const stops = [sample.inici, ...(sample.estacions?.map((s: any) => s.nom) || []), sample.final];
                    const times = [sample.sortida, ...(sample.estacions?.map((s: any) => s.hora || s.sortida) || []), sample.arribada];
                    const i1 = stops.indexOf(eps.start);
                    const i2 = stops.indexOf(eps.end);
                    const t1 = getFgcMinutes(times[i1]);
                    const t2 = getFgcMinutes(times[i2]);
                    if (t1 !== null && t2 !== null) refTravelTime = Math.abs(t2 - t1);
                } else {
                    const fullPath = getFullPath(eps.start, eps.end);
                    refTravelTime = Math.max(8, (fullPath.length - 1) * 3);
                }

                // NEW: Penalty for Single Track Working (Via Única)
                let defectiveSegmentsCount = 0;

                // Get the path
                const pathForCheck = sample ? [sample.inici, ...(sample.estacions?.map((s: any) => s.nom) || []), sample.final] : getFullPath(eps.start, eps.end);

                // Check segments in path
                for (let i = 0; i < pathForCheck.length - 1; i++) {
                    const from = pathForCheck[i];
                    const to = pathForCheck[i + 1];
                    // Check if *any* track is cut on this segment
                    const isV1Cut = selectedCutSegments.has(`${from}-${to}-V1`) || selectedCutSegments.has(`${to}-${from}-V1`);
                    const isV2Cut = selectedCutSegments.has(`${from}-${to}-V2`) || selectedCutSegments.has(`${to}-${from}-V2`);

                    if (isV1Cut || isV2Cut) {
                        defectiveSegmentsCount++;
                    }
                }

                const vuPenalty = defectiveSegmentsCount * 3; // +3 min per single track segment
                refTravelTime += vuPenalty;

                const branchUnits = (resourcesByLinia[liniaCode] || []).map(u => ({
                    ...u,
                    currentDriverId: u.driver.torn,
                    nextAvail: displayMin
                }));
                const numUnits = branchUnits.length;
                if (numUnits === 0) continue;

                const ratio = numUnits / (totalUnitsAvailable || 1);
                const activeOnThisBranch = Math.max(1, Math.floor(activeSimultaneous * ratio));
                const cycleTime = (refTravelTime * 2) + 12;

                // Use manualHeadway if set, otherwise calculate.
                // Constraint: If Single Track (defectiveSegments > 0), min headway is 15-20 mins
                let calculatedHeadway = Math.max(10, Math.floor(cycleTime / activeOnThisBranch));
                if (defectiveSegmentsCount > 0) {
                    calculatedHeadway = Math.max(20, calculatedHeadway);
                }

                const headway = manualHeadway || calculatedHeadway;

                let nextStartTimeAsc = displayMin + 2;
                let nextStartTimeDesc = displayMin + 2 + Math.floor(headway / 2);

                // We generate trips by alternating directions and units
                let step = 0;
                while (nextStartTimeAsc < maxServiceTime || nextStartTimeDesc < maxServiceTime) {
                    const canGoAsc = nextStartTimeAsc < maxServiceTime;
                    const canGoDesc = nextStartTimeDesc < maxServiceTime;

                    let isAsc = (step % 2 === 0);
                    if (isAsc && !canGoAsc) isAsc = false;
                    else if (!isAsc && !canGoDesc) isAsc = true;

                    const startTime = isAsc ? nextStartTimeAsc : nextStartTimeDesc;
                    const endTime = startTime + refTravelTime;
                    if (startTime > 1620) break;

                    const unitIdx = step % numUnits;
                    const unitObj = branchUnits[unitIdx];

                    const origin = isAsc ? eps.start : eps.end;
                    const dest = isAsc ? eps.end : eps.start;

                    const findSuitableDriver = (startNode: string, startT: number, endT: number, endNode: string) => {
                        const curr = driverPool.find(d => d.torn === unitObj.currentDriverId);
                        const checkShift = (d: any) => {
                            if (!d) return false;
                            if (endT > d.activeShiftEnd) return false;
                            if (endNode !== d.activeShiftDep && (endT + refTravelTime > d.activeShiftEnd)) return false;
                            return true;
                        };

                        // Allow assigned driver to be used even if not at startNode (assume positioning move)
                        if (curr && curr.availableAt <= startT && checkShift(curr)) {
                            return curr;
                        }

                        // For new assignments, prefer someone at startNode, but fallback to anyone in pool if desperate?
                        // For now keep strict for new assignments to avoid teleportation, but maybe relax range?
                        return driverPool.find(d => d.currentStation === startNode && d.availableAt <= startT && checkShift(d));
                    };

                    const selectedDriver = findSuitableDriver(origin, startTime, endTime, dest);
                    if (selectedDriver) unitObj.currentDriverId = selectedDriver.torn;

                    const activeDriver = selectedDriver || { driver: 'SENSE MAQUINISTA', torn: '---' };

                    let tripNum = isAsc ? nextAscNum : nextDescNum;
                    if (isAsc) nextAscNum += 2; else nextDescNum += 2;

                    plan.push({
                        id: `${prefix}A${tripNum.toString().padStart(3, '0')}`,
                        linia: liniaCode,
                        train: unitObj.train.id,
                        driver: (activeDriver as any).driverName ? `${(activeDriver as any).driverSurname || ''}, ${(activeDriver as any).driverName}` : (activeDriver.driver || 'SENSE MAQUINISTA'),
                        torn: activeDriver.torn,
                        shiftStart: (activeDriver as any).shiftStartMin !== undefined ? formatFgcTime((activeDriver as any).shiftStartMin) : '---',
                        shiftEnd: (activeDriver as any).activeShiftEnd !== undefined ? formatFgcTime((activeDriver as any).activeShiftEnd) : '---',
                        sortida: formatFgcTime(startTime),
                        arribada: formatFgcTime(endTime),
                        route: `${origin} → ${dest}`,
                        direction: isAsc ? 'ASCENDENT' : 'DESCENDENT',
                        startTimeMinutes: startTime,
                        numValue: tripNum
                    });

                    if (selectedDriver) {
                        selectedDriver.currentStation = dest;
                        selectedDriver.availableAt = endTime + 4; // Turnaround
                    }

                    if (isAsc) nextStartTimeAsc += headway;
                    else nextStartTimeDesc += headway;
                    step++;
                }
            }


            // SURPLUS TRAIN RETIREMENT (Retirada de Material)
            // Identify physical trains that were NOT assigned to any service
            const assignedTrainIds = new Set(plan.map(p => p.train));
            const surplusTrains = physicalTrains.filter(t => !assignedTrainIds.has(t.id));

            surplusTrains.forEach((t, idx) => {
                const linia = t.linia || 'S1'; // Default if unknown
                const prefix = liniaPrefixes[linia] || 'D';
                const numVal = 801 + (idx * 2); // 8xx series: 801, 803...
                const id = `${prefix}A${numVal}`;

                // Find driver for this train
                const driver = allDrivers.find(d => d.id === t.id) || { driver: 'MAQUINISTA DE GUARDIA', torn: '---' };

                plan.push({
                    id: id,
                    linia: linia,
                    train: t.id,
                    driver: (driver as any).driverName ? `${(driver as any).driverSurname || ''}, ${(driver as any).driverName}` : ((driver as any).driver || 'MAQUINISTA'),
                    torn: (driver as any).torn,
                    shiftStart: '---',
                    shiftEnd: '---',
                    sortida: formatFgcTime(displayMin + 5), // Depart shortly after plan generation
                    arribada: formatFgcTime(displayMin + 25), // Approx travel to depot
                    route: "RETIRADA A DIPÒSIT",
                    direction: "DESCENDENT", // Usually towards depot
                    startTimeMinutes: displayMin + 5,
                    numValue: numVal,
                    prevId: 'En estat'
                });
            });

            const finalPlan = Array.from(new Map(plan.map(p => [p.id, p])).values());

            // Sorting by time to process sequences
            const sortedByTime = finalPlan.sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);

            // Group by unit to track transitions
            const unitSequences: Record<string, any[]> = {};
            sortedByTime.forEach(trip => {
                if (!unitSequences[trip.train]) unitSequences[trip.train] = [];
                unitSequences[trip.train].push(trip);
            });

            Object.values(unitSequences).forEach(trips => {
                const isReserve = trips[0].train.startsWith('RES-');
                for (let i = 0; i < trips.length; i++) {
                    if (i === 0) {
                        trips[i].prevId = isReserve ? 'SORTIDA DE DIPÒSIT' : 'En circulació';
                    } else {
                        trips[i].prevId = trips[i - 1].id;
                    }
                    trips[i].nextId = i === trips.length - 1 ? 'Final de servei' : trips[i + 1].id;
                }
            });

            setGeneratedCircs(sortedByTime.sort((a, b) => {
                const lineDiff = LINE_ORDER.indexOf(a.linia) - LINE_ORDER.indexOf(b.linia);
                if (lineDiff !== 0) return lineDiff;
                return a.startTimeMinutes - b.startTimeMinutes || a.numValue - b.numValue;
            }));
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const islandLabel = dividedPersonnel[islandId].label.replace("Illa ", "");
    const totalAssigned = Object.values(lineCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-fgc-grey/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 w-full max-w-6xl rounded-[48px] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="p-8 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-gray-50/50 dark:bg-black/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-fgc-green rounded-2xl text-fgc-grey shadow-lg"><Activity size={24} /></div>
                        <div>
                            <h3 className="text-xl font-black text-fgc-grey dark:text-white uppercase tracking-tight">Pla de Servei Alternatiu</h3>
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{islandLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-4 py-2 rounded-xl border border-gray-100 dark:border-white/10">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Freq:</span>
                            <input
                                type="range" min="5" max="60" step="1"
                                value={manualHeadway || 15}
                                onChange={(e) => setManualHeadway(parseInt(e.target.value))}
                                className="w-24 accent-blue-500"
                            />
                            <span className="text-xs font-black text-blue-500 w-12">{manualHeadway || 'Auto'} min</span>
                            {manualHeadway && (
                                <button onClick={() => setManualHeadway(null)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                            )}
                        </div>
                        <button
                            onClick={handleGenerateCirculations}
                            className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-sm transition-all shadow-xl active:scale-95 bg-blue-600 text-white hover:bg-blue-700`}
                        >
                            <FilePlus size={18} /> GENERAR MALLA
                        </button>
                        <button
                            onClick={async () => {
                                await handleGenerateCirculations();
                                setViewMode('SHIFTS');
                            }}
                            className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-sm transition-all shadow-xl active:scale-95 bg-purple-600 text-white hover:bg-purple-700`}
                        >
                            <Users size={18} /> GENERAR TORNS
                        </button>
                        <button onClick={onClose} className="p-3 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 rounded-full transition-colors"><X size={28} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                    {viewMode === 'RESOURCES' ? (
                        <>
                            <div className="flex items-center justify-between px-2">
                                <h4 className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Configuració Manual de Recursos</h4>
                                <div className="flex gap-4">
                                    <span className="bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">{totalAssigned} de {physicalTrains.length} Unitats Disp.</span>
                                    <span className="bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest">{totalAssigned} de {allDrivers.length} Maquinistes Disp.</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                {/* Total Trens */}
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-[32px] border border-blue-100 dark:border-blue-900/30 flex flex-col items-center justify-center text-center">
                                    <Train className="text-blue-500 mb-2" size={32} />
                                    <span className="text-4xl font-black text-blue-700 dark:text-blue-400">{activeFleet.length} <span className="text-lg text-gray-400">+ {garageFleet.length}</span></span>
                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-1">Actius + Garatge</span>
                                </div>

                                {/* S1 + S2 */}
                                <div className="bg-orange-50/30 dark:bg-orange-950/10 p-6 rounded-[32px] border border-orange-100 dark:border-orange-900/30 flex flex-col items-center justify-between">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-xs font-black text-orange-600">S1</span>
                                        <span className="text-gray-300 text-xs font-black">+</span>
                                        <span className="text-xs font-black text-green-600">S2</span>
                                    </div>
                                    <div className="flex w-full justify-around items-center">
                                        {/* S1 */}
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-[8px] font-black text-orange-400 uppercase">S1</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => updateCount('S1', -1)} className="p-1 hover:bg-orange-100 dark:hover:bg-white/5 rounded-lg text-orange-500 transition-colors"><Minus size={14} /></button>
                                                <span className="text-2xl font-black text-fgc-grey dark:text-white leading-none">{lineCounts.S1}</span>
                                                <button onClick={() => updateCount('S1', 1)} className="p-1 hover:bg-orange-100 dark:hover:bg-white/5 rounded-lg text-orange-500 transition-colors"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                        <div className="w-px h-8 bg-orange-100 dark:bg-white/10" />
                                        {/* S2 */}
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-[8px] font-black text-green-500 uppercase">S2</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => updateCount('S2', -1)} className="p-1 hover:bg-green-100 dark:hover:bg-white/5 rounded-lg text-green-500 transition-colors"><Minus size={14} /></button>
                                                <span className="text-2xl font-black text-fgc-grey dark:text-white leading-none">{lineCounts.S2}</span>
                                                <button onClick={() => updateCount('S2', 1)} className="p-1 hover:bg-green-100 dark:hover:bg-white/5 rounded-lg text-green-500 transition-colors"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* L6 */}
                                <div className="bg-purple-50/50 dark:bg-purple-900/10 p-6 rounded-[32px] border border-purple-100 dark:border-purple-900/30 flex flex-col items-center justify-between">
                                    <span className="text-xs font-black text-purple-600 uppercase mb-4 tracking-widest">L6</span>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => updateCount('L6', -1)} className="p-1 hover:bg-purple-100 dark:hover:bg-white/5 rounded-lg text-purple-500 transition-colors"><Minus size={16} /></button>
                                        <span className="text-3xl font-black text-fgc-grey dark:text-white leading-none">{lineCounts.L6}</span>
                                        <button onClick={() => updateCount('L6', 1)} className="p-1 hover:bg-purple-100 dark:hover:bg-white/5 rounded-lg text-purple-500 transition-colors"><Plus size={16} /></button>
                                    </div>
                                    <div className="mt-4 bg-purple-100 dark:bg-purple-900/30 w-full h-1 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-500" style={{ width: `${(lineCounts.L6 / (totalUnitsAvailable || 1)) * 100}%` }} />
                                    </div>
                                </div>

                                {/* L7 & L12 */}
                                <div className="bg-amber-50/30 dark:bg-amber-950/10 p-6 rounded-[32px] border border-amber-100 dark:border-amber-900/30 flex flex-col items-center justify-between">
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-xs font-black text-amber-700">L7</span>
                                        <span className="text-gray-300 text-xs font-black">&</span>
                                        <span className="text-xs font-black text-purple-400">L12</span>
                                    </div>
                                    <div className="flex w-full justify-around items-center">
                                        {/* L7 */}
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-[8px] font-black text-amber-600 uppercase">L7</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => updateCount('L7', -1)} className="p-1 hover:bg-amber-100 dark:hover:bg-white/5 rounded-lg text-amber-600 transition-colors"><Minus size={14} /></button>
                                                <span className="text-2xl font-black text-fgc-grey dark:text-white leading-none">{lineCounts.L7}</span>
                                                <button onClick={() => updateCount('L7', 1)} className="p-1 hover:bg-amber-100 dark:hover:bg-white/5 rounded-lg text-amber-600 transition-colors"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                        <div className="w-px h-8 bg-amber-100 dark:bg-white/10" />
                                        {/* L12 */}
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-[8px] font-black text-purple-400 uppercase">L12</span>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => updateCount('L12', -1)} className="p-1 hover:bg-purple-100 dark:hover:bg-white/5 rounded-lg text-purple-400 transition-colors"><Minus size={14} /></button>
                                                <span className="text-2xl font-black text-fgc-grey dark:text-white leading-none">{lineCounts.L12}</span>
                                                <button onClick={() => updateCount('L12', 1)} className="p-1 hover:bg-purple-100 dark:hover:bg-white/5 rounded-lg text-purple-400 transition-colors"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Maquinistes */}
                                <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-[32px] border border-green-100 dark:border-green-900/30 flex flex-col items-center justify-center text-center">
                                    <User className="text-green-500 mb-2" size={32} />
                                    <span className="text-4xl font-black text-green-700 dark:text-green-400">{allDrivers.length}</span>
                                    <span className="text-[10px] font-black text-green-500 uppercase tracking-widest mt-1">Maquinistes</span>
                                </div>
                            </div>
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center gap-2 px-2"><ShieldAlert size={16} className="text-red-500" /><h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Assignació de Recursos d'Illa (Per ordre de prioritat)</h4></div>
                                <div className="grid grid-cols-1 gap-3">
                                    {shuttlePlan.map((s, idx) => (
                                        <div key={idx} className="bg-white dark:bg-gray-800 rounded-[32px] p-6 border border-gray-100 dark:border-white/5 shadow-sm flex items-center justify-between gap-6 hover:shadow-xl transition-all group overflow-hidden relative">
                                            <div className="flex items-center gap-6 flex-1 min-w-0 z-10">
                                                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center font-black text-white shadow-lg shrink-0 text-xl border-4 border-white/20`} style={{ backgroundColor: getLiniaColorHex(s.liniaCode) }}>
                                                    {s.liniaCode}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <p className="text-xl font-black text-fgc-grey dark:text-white uppercase truncate tracking-tight">{s.route}</p>
                                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${s.priority === 'ALTA' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>Prioritat {s.priority}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                                                            <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-2 py-0.5 rounded-lg text-[10px] uppercase font-black">Unitat: {s.train.id}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                                                            <span className="bg-green-50 dark:bg-green-900/20 text-green-600 px-2 py-0.5 rounded-lg text-[10px] uppercase font-black">Personal: {s.driver.driver}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 z-10">
                                                {s.driver.phones?.map((p: string, i: number) => (
                                                    <a key={i} href={`tel:${p}`} className="w-12 h-12 bg-gray-50 dark:bg-black text-fgc-grey dark:text-gray-400 rounded-2xl flex items-center justify-center hover:bg-fgc-green hover:text-white transition-all shadow-md border border-gray-100 dark:border-white/10"><Phone size={20} /></a>
                                                ))}
                                            </div>
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none group-hover:opacity-[0.06] transition-opacity">
                                                <Train size={200} style={{ color: getLiniaColorHex(s.liniaCode) }} />
                                            </div>
                                        </div>
                                    ))}
                                    {shuttlePlan.length === 0 && (
                                        <div className="py-20 text-center border-2 border-dashed border-gray-100 dark:border-white/5 rounded-[48px]">
                                            <p className="text-gray-300 dark:text-gray-700 font-bold uppercase tracking-widest italic">Assigna unitats a les línies superiors per començar</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : viewMode === 'CIRCULATIONS' ? (
                        <div className="space-y-6 animate-in slide-in-from-right duration-500">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 px-2"><LayoutGrid size={16} className="text-blue-500" /><h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Escaleta de Circulacions d'Emergència</h4></div>
                                <button onClick={() => setViewMode('RESOURCES')} className="text-[10px] font-black text-blue-500 hover:underline">← Tornar a recursos</button>
                            </div>
                            {generating ? (
                                <div className="py-20 flex flex-col items-center gap-4 opacity-30"><Loader2 className="animate-spin text-blue-500" size={48} /><p className="text-xs font-black uppercase tracking-widest">Sincronitzant malla teòrica...</p></div>
                            ) : (
                                <div className="bg-gray-50 dark:bg-black/20 rounded-[32px] overflow-hidden border border-gray-100 dark:border-white/5">
                                    <div className="grid grid-cols-8 bg-fgc-grey dark:bg-black text-white p-4 text-[10px] font-black uppercase tracking-widest">
                                        <div>Codi</div><div>Tren Anterior</div><div>Torn Maquinista</div><div>Sortida</div><div>Arribada</div><div className="col-span-1">Ruta</div><div>Següent Circulació</div><div>Direcció</div>
                                    </div>
                                    <div className="divide-y divide-gray-100 dark:divide-white/5">
                                        {generatedCircs.map((c, idx) => (
                                            <div key={idx} className="grid grid-cols-8 p-4 items-center hover:bg-white dark:hover:bg-white/5 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getLiniaColorHex(c.linia) }} />
                                                    <span className="font-black text-lg text-fgc-grey dark:text-white">{c.id}</span>
                                                </div>
                                                <div className="font-bold text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-tight">{c.prevId}</div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-xs text-fgc-grey dark:text-white uppercase">{c.torn || '---'}</span>
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">{c.driver}</span>
                                                </div>
                                                <div className="font-black text-sm text-orange-600 dark:text-orange-400">{c.sortida}</div>
                                                <div className="font-black text-sm text-blue-600 dark:text-blue-400">{c.arribada}</div>
                                                <div className="text-[10px] font-bold text-fgc-grey dark:text-gray-300 truncate">{c.route}</div>
                                                <div className="font-bold text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-tight">{c.nextId}</div>
                                                <div><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${c.direction === 'ASCENDENT' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{c.direction}</span></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right duration-500">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 px-2"><Users size={16} className="text-purple-500" /><h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Pla d'Assignació per Torn de Maquinista</h4></div>
                                <button onClick={() => setViewMode('RESOURCES')} className="text-[10px] font-black text-blue-500 hover:underline">← Tornar a recursos</button>
                            </div>

                            {generating ? (
                                <div className="py-20 flex flex-col items-center gap-4 opacity-30"><Loader2 className="animate-spin text-purple-500" size={48} /><p className="text-xs font-black uppercase tracking-widest">Organitzant torns d'emergència...</p></div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {(() => {
                                        const groups: Record<string, any> = {};
                                        generatedCircs.forEach(c => {
                                            if (!c.torn || c.torn === '---') return;
                                            if (!groups[c.torn]) {
                                                groups[c.torn] = {
                                                    id: c.torn,
                                                    driver: c.driver,
                                                    start: c.shiftStart,
                                                    end: c.shiftEnd,
                                                    trips: []
                                                };
                                            }
                                            groups[c.torn].trips.push(c);
                                        });

                                        return Object.values(groups).sort((a, b) => a.id.localeCompare(b.id)).map((g: any) => (
                                            <div key={g.id} className="bg-white dark:bg-gray-800 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
                                                <div className="p-6 bg-gray-50/50 dark:bg-black/20 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 text-purple-600 rounded-2xl flex items-center justify-center font-black text-sm">{g.id}</div>
                                                        <div>
                                                            <p className="text-sm font-black text-fgc-grey dark:text-white uppercase truncate">{g.driver}</p>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Horari: {g.start} - {g.end}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-black bg-purple-50 dark:bg-purple-900/20 text-purple-600 px-3 py-1 rounded-full uppercase">{g.trips.length} SERVEIS</span>
                                                </div>
                                                <div className="p-4 space-y-2">
                                                    {g.trips.map((t: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 dark:bg-white/5 border border-gray-100/50 dark:border-white/5">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: getLiniaColorHex(t.linia) }} />
                                                                <div>
                                                                    <p className="text-xs font-black text-fgc-grey dark:text-white uppercase">{t.id} - {t.route}</p>
                                                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Tren: {t.train}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs font-black text-purple-600">{t.sortida} - {t.arribada}</p>
                                                                <p className="text-[8px] font-black text-gray-400 uppercase">{t.direction}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-black/40">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20 max-w-2xl">
                            <Info size={20} className="text-blue-500 mt-1 shrink-0" />
                            <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 leading-relaxed uppercase tracking-widest">
                                {(() => {
                                    const hasVU = MAP_SEGMENTS.some(seg => {
                                        if (!islandStations.has(seg.from) || !islandStations.has(seg.to)) return false;
                                        return selectedCutSegments.has(`${seg.from}-${seg.to}-V1`) || selectedCutSegments.has(`${seg.to}-${seg.from}-V1`) ||
                                            selectedCutSegments.has(`${seg.from}-${seg.to}-V2`) || selectedCutSegments.has(`${seg.to}-${seg.from}-V2`);
                                    });

                                    return (
                                        <>
                                            {hasVU && <span className="block font-black text-red-500 mb-1">⚠ VIA ÚNICA: CAPACITAT REDUÏDA (+Temps)</span>}
                                            Les circulacions es generen amb una cadència de {manualHeadway || (hasVU ? '20 (Mín)' : '15')} minuts, alternant sentits.
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Capacitat de zona</span>
                            <div className="h-2 w-32 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-fgc-green" style={{ width: `${(totalAssigned / Math.max(1, physicalTrains.length)) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AlternativeServiceOverlay;
