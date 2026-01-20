import { useMemo } from 'react';
import { MAP_SEGMENTS, MAP_STATIONS } from '../constants/incidenciaData';
import { LivePersonnel } from '../types';

export const useIncidenciaGraph = (
    liveData: LivePersonnel[],
    selectedCutStations: Set<string>,
    selectedCutSegments: Set<string>
) => {

    const getFullPath = (start: string, end: string): string[] => {
        if (start === end) return [start];

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

    const islands = useMemo(() => {
        const graph: Record<string, string[]> = {};
        MAP_STATIONS.forEach(s => graph[s.id] = []);
        MAP_SEGMENTS.forEach(seg => {
            const isV1Blocked = selectedCutSegments.has(`${seg.from}-${seg.to}-V1`) || selectedCutSegments.has(`${seg.to}-${seg.from}-V1`);
            const isV2Blocked = selectedCutSegments.has(`${seg.from}-${seg.to}-V2`) || selectedCutSegments.has(`${seg.to}-${seg.from}-V2`);
            const isSegmentBlocked = isV1Blocked && isV2Blocked;

            const isFromBlocked = selectedCutStations.has(seg.from);
            const isToBlocked = selectedCutStations.has(seg.to);
            if (!isSegmentBlocked && !isFromBlocked && !isToBlocked) {
                graph[seg.from].push(seg.to);
                graph[seg.to].push(seg.from);
            }
        });

        const getReachable = (startNode: string) => {
            if (selectedCutStations.has(startNode)) return new Set<string>();
            const visited = new Set<string>();
            const queue = [startNode];
            while (queue.length > 0) {
                const node = queue.shift()!;
                if (!visited.has(node)) {
                    visited.add(node);
                    (graph[node] || []).forEach(neighbor => {
                        if (!visited.has(neighbor)) queue.push(neighbor);
                    });
                }
            }
            return visited;
        };
        return { BCN: getReachable('PC'), S1: getReachable('NA'), S2: getReachable('PN'), L6: getReachable('RE'), L7: getReachable('TB') };
    }, [selectedCutStations, selectedCutSegments]);

    const dividedPersonnel = useMemo(() => {
        if (selectedCutStations.size === 0 && selectedCutSegments.size === 0) return null;

        const vallesUnified = islands.S1.has('PN') || islands.S2.has('NA');
        const result: Record<string, { list: LivePersonnel[], stations: Set<string>, isUnified: boolean, label: string }> = {
            AFFECTED: { list: [], stations: selectedCutStations, isUnified: false, label: 'Zona de Tall / Atrapats' },
            BCN: { list: [], stations: islands.BCN, isUnified: false, label: 'Illa Barcelona' },
            S1: { list: [], stations: islands.S1, isUnified: false, label: 'Illa S1 (Terrassa)' },
            S2: { list: [], stations: islands.S2, isUnified: false, label: 'Illa S2 (Sabadell)' },
            VALLES: { list: [], stations: new Set([...Array.from(islands.S1), ...Array.from(islands.S2)]), isUnified: vallesUnified, label: 'Illa Vallès (S1+S2)' },
            L6: { list: [], stations: islands.L6, isUnified: false, label: 'Illa L6' },
            L7: { list: [], stations: islands.L7, isUnified: false, label: 'Illa L7' },
            ISOLATED: { list: [], stations: new Set(), isUnified: false, label: 'Zones Aïllades' }
        };

        liveData.forEach(p => {
            const st = p.stationId.toUpperCase();
            if (selectedCutStations.has(st)) result.AFFECTED.list.push(p);
            else if (islands.BCN.has(st)) result.BCN.list.push(p);
            else if (vallesUnified && (islands.S1.has(st) || islands.S2.has(st))) result.VALLES.list.push(p);
            else if (islands.S1.has(st)) result.S1.list.push(p);
            else if (islands.S2.has(st)) result.S2.list.push(p);
            else if (islands.L6.has(st)) result.L6.list.push(p);
            else if (islands.L7.has(st)) result.L7.list.push(p);
            else result.AFFECTED.list.push(p); // Fix: Treat isolated zones as "Affected/Trapped" per user request
        });
        return result;
    }, [liveData, selectedCutStations, selectedCutSegments, islands]);

    return { getFullPath, islands, dividedPersonnel };
};
