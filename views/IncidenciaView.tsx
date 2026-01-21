import React, { useState, useEffect, useMemo } from 'react';
import { Search, ShieldAlert, Loader2, UserCheck, Clock, MapPin, AlertCircle, Phone, Info, Users, Zap, User, Train, Map as MapIcon, X, Timer, Scissors, ArrowDownToLine, ArrowUpToLine, ArrowLeftToLine, ArrowRightToLine, Coffee, Layers, Trash2, Repeat, Rewind, FastForward, RotateCcw, RefreshCw, LayoutGrid, CheckCircle2, Activity, FilePlus, ArrowRight, Move, Plus, Minus, Bell } from 'lucide-react';
import { supabase } from '../supabaseClient.ts';
import { fetchFullTurns } from '../utils/queries.ts';
import IncidenciaPerTorn from '../components/IncidenciaPerTorn.tsx';
import { resolveStationId, getFgcMinutes, formatFgcTime } from '../utils/incidenciaUtils.ts';
import { RESERVAS_CONFIG, MAP_STATIONS, MAP_SEGMENTS, MAP_CROSSOVERS, S1_STATIONS, S2_STATIONS, L6_STATIONS, L7_STATIONS, L12_STATIONS } from '../constants/incidenciaData.ts';
import { GARAGE_PLAN } from '../constants/garageData.ts';
import { IncidenciaMode, LivePersonnel } from '../types.ts';
import { useIncidenciaGraph } from '../hooks/useIncidenciaGraph.ts';
import IncidenciaMapControls from '../components/Incidencia/IncidenciaMapControls.tsx';
import IncidenciaMap from '../components/Incidencia/IncidenciaMap.tsx';
import AlternativeServiceOverlay from '../components/Incidencia/AlternativeServiceOverlay.tsx';
import StationInfoBoard from '../components/Incidencia/StationInfoBoard.tsx';
import { getShortTornId } from '../utils/incidenciaUtils.ts';





interface IncidenciaViewProps {
  showSecretMenu: boolean;
}







const IncidenciaView: React.FC<IncidenciaViewProps> = ({ showSecretMenu }) => {
  const [mode, setMode] = useState<IncidenciaMode>('INIT');
  const [selectedServei, setSelectedServei] = useState<string>('0');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const [isRealTime, setIsRealTime] = useState(true);
  const [customTime, setCustomTime] = useState('');
  const [displayMin, setDisplayMin] = useState<number>(0);
  const [liveData, setLiveData] = useState<LivePersonnel[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  const [isGeoTrenEnabled, setIsGeoTrenEnabled] = useState(false);
  const [geoTrenData, setGeoTrenData] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [originalShift, setOriginalShift] = useState<any>(null);
  const [selectedCircId, setSelectedCircId] = useState<string>('');
  const [selectedStation, setSelectedStation] = useState<string>('');

  const [selectedCutStations, setSelectedCutStations] = useState<Set<string>>(new Set());
  const [selectedCutSegments, setSelectedCutSegments] = useState<Set<string>>(new Set());
  const [selectedRestLocation, setSelectedRestLocation] = useState<string | null>(null);
  const [altServiceIsland, setAltServiceIsland] = useState<string | null>(null);

  const { getFullPath, dividedPersonnel, islands } = useIncidenciaGraph(liveData, selectedCutStations, selectedCutSegments);

  const [passengerResults, setPassengerResults] = useState<any[]>([]);
  const [adjacentResults, setAdjacentResults] = useState<{ anterior: any[], posterior: any[] }>({ anterior: [], posterior: [] });
  const [restingResults, setRestingResults] = useState<any[]>([]);
  const [extensibleResults, setExtensibleResults] = useState<any[]>([]);
  const [reserveInterceptResults, setReserveInterceptResults] = useState<any[]>([]);
  const [circDetailsData, setCircDetailsData] = useState<any[]>([]); // For GeoTren matching
  const [enrichedGeoTrenData, setEnrichedGeoTrenData] = useState<any[]>([]); // Matched results
  const [garageOccupation, setGarageOccupation] = useState<Record<string, number>>({});
  const [impactAnalysis, setImpactAnalysis] = useState<{ affectedTrains: number, estPassengers: number }>({ affectedTrains: 0, estPassengers: 0 });
  const [nearbyReserves, setNearbyReserves] = useState<any[]>([]);




  const serveiTypes = ['0', '100', '400', '500'];



  const getLiniaColorHex = (linia: string) => {
    const l = linia?.toUpperCase().trim() || '';
    if (l.startsWith('F')) return '#22c55e';
    if (l === 'L7' || l === '300') return '#8B4513';
    if (l === 'L6' || l === '100') return '#9333ea';
    if (l === 'L12') return '#d8b4fe';
    if (l === 'S1' || l === '400') return '#f97316';
    if (l === 'S2' || l === '500') return '#22c55e';
    return '#6b7280';
  };

  useEffect(() => {
    if (isRealTime && !isPaused) {
      const updateTime = () => {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        setCustomTime(timeStr);
        const m = getFgcMinutes(timeStr);
        if (m !== null) setDisplayMin(m);
      };
      updateTime();
      const interval = setInterval(updateTime, 30000);
      return () => clearInterval(interval);
    }
  }, [isRealTime, isPaused]);

  useEffect(() => {
    if (customTime) {
      const m = getFgcMinutes(customTime);
      if (m !== null) setDisplayMin(m);
    } else if (isRealTime && !isPaused) {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const m = getFgcMinutes(timeStr);
      if (m !== null) setDisplayMin(m);
    }
  }, [customTime, isRealTime, isPaused, mode]);

  const fetchGeoTrenData = async () => {
    try {
      const resp = await fetch('https://dadesobertes.fgc.cat/api/v2/catalog/datasets/posicionament-dels-trens/exports/json');
      if (!resp.ok) return;
      const data = await resp.json();
      setGeoTrenData(data);
    } catch (err) {
      console.error('GeoTren fetch error:', err);
    }
  };

  // Logic to enrich GeoTren data with deduced Circulation ID
  useEffect(() => {
    if (!geoTrenData.length || !circDetailsData.length) {
      setEnrichedGeoTrenData(geoTrenData);
      return;
    }

    const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    const enriched = geoTrenData.map(t => {
      // 1. Basic matching by Line, Origin, Destination
      // GeoTren: origen="PC", desti="PN", lin="S2"
      // Circulation: sortida="08:00", arribada="08:45" (must convert to mins)

      let bestMatchId = null;
      let minDiff = Infinity;

      // Filter potential candidates
      const candidates = circDetailsData.filter((c: any) => {
        // Resolve Station IDs for C and T to ensure match (e.g. GeoTren might use "PC" and our DB "PC")
        // Assuming DB uses same codes as GeoTren mostly.
        // Check Line (S1, S2...)
        if (c.linia !== t.lin) return false;

        // Check Origin/Dest (Simple check)
        // Geo: origen="PC", desti="NA"
        // DB: inici="Pl. Catalunya", final="Terrassa..." -> Need resolveStationId?
        // Actually DB 'circulations' table usually stores 'inici'/'final' as Station Names or Codes?
        // Based on previous code: circ.inici || (estacions[0]?.nom)
        // Let's rely on time matching heavily if O/D match is loose.

        return true; // Filter inside loop for more complex logic
      });

      for (const c of candidates) {
        // Normalize Origin/Dest from DB
        // We can use resolveStationId helper
        const cOrigin = resolveStationId(c.inici, c.linia);
        const cDest = resolveStationId(c.final, c.linia);

        if (cOrigin !== t.origen || cDest !== t.desti) continue;

        // Time Check: Match current location time?
        // Or match Origin Departure Time? 
        // GeoTren doesn't give departure time.
        // It gives "en_hora": "True" (on time).
        // So if we are at "PC" at 10:00, we look for a train leaving "PC" around 10:00.
        // If we are mid-route, it's harder.

        // Strategy: Find where the train IS (estacionat_a or properes_parades[0])
        // Find that station in the circulation's stop list.
        // Compare scheduled time at that station with currentMinutes.

        let stationNom = t.estacionat_a;
        if (!stationNom && t.properes_parades) {
          const match = t.properes_parades.match(/parada":\s*"([^"]+)"/);
          if (match && match[1]) stationNom = match[1];
        }
        if (!stationNom) continue; // Cant locate

        const stop = (c.estacions || []).find((s: any) => resolveStationId(s.nom || s.id, c.linia) === stationNom);
        if (stop) {
          const scheduledMin = getFgcMinutes(stop.hora || stop.sortida || stop.arribada);
          if (scheduledMin !== null) {
            const diff = Math.abs(scheduledMin - currentMinutes);
            if (diff < 15 && diff < minDiff) { // 15 min tolerance
              minDiff = diff;
              bestMatchId = c.id;
            }
          }
        }
      }

      if (bestMatchId) {
        return { ...t, deducedCirculationId: bestMatchId };
      }
      return t;
    });

    setEnrichedGeoTrenData(enriched);

  }, [geoTrenData, circDetailsData]); // Re-run when data updates

  // Feature 1: Calculem l'ocupació dels garatges
  useEffect(() => {
    const rawOccupation: Record<string, number> = {};
    const dataToUse = isGeoTrenEnabled && enrichedGeoTrenData.length > 0 ? enrichedGeoTrenData : liveData.filter(p => p.type === 'TRAIN');

    dataToUse.forEach((t: any) => {
      // Determine location
      let stationCode = '';
      if (t.stationId) stationCode = t.stationId;
      else if (t.estacionat_a) stationCode = t.estacionat_a;
      // We can also check properes_parades if parked nearby, but let's stick to explicit location or mapped stationId

      if (!stationCode) return;
      stationCode = resolveStationId(stationCode);

      // Increment count if this station is a garage
      // Note: Some trains might be "in service" at the station, but for this viz we might just count them
      // Ideally we only count those "stabled" / "parked", but "estacionat_a" is the key for GeoTren.
      // For Simulated, we assume if they are at start/end of shift? Or just current location.
      // Let's count ALL trains at that station for simplicity (Capacity vs Real Presence)

      // Refined Logic (Step Id: 681): Only count trains as "Garage/Depot" if they are NOT active.
      // Active trains have a deducedCirculationId (from matching) or properes_parades.
      // If a train has no active service assignment, we treat it as Parked/Stabled.
      const isActive = t.deducedCirculationId || (t.properes_parades && t.properes_parades.length > 2); // > 2 chars usually implies content

      if (!isActive) {
        if (rawOccupation[stationCode]) rawOccupation[stationCode]++;
        else rawOccupation[stationCode] = 1;
      }
    });
    setGarageOccupation(rawOccupation);
  }, [enrichedGeoTrenData, liveData, isGeoTrenEnabled]); // Recalculate when positions change



  // Feature 2: Intelligent Reallocation & Impact
  useEffect(() => {
    if (selectedCutStations.size === 0 && selectedCutSegments.size === 0) {
      setImpactAnalysis({ affectedTrains: 0, estPassengers: 0 });
      setNearbyReserves([]);
      return;
    }

    const affectedTrainsCount = (isGeoTrenEnabled ? enrichedGeoTrenData : liveData)
      .filter((t: any) => {
        if (t.type !== 'TRAIN') return false;
        // Check if train is AT a cut station
        if (selectedCutStations.has(t.stationId)) return true;
        // Check if train is ON a cut segment (heuristic: between stations?)
        // Simplified: Just station checks for now, or check next stops
        return false;
      }).length;

    // Heuristic: 150 passengers per train peak, 50 off-peak. Let's avg 100.
    const estPassengers = affectedTrainsCount * 120;
    setImpactAnalysis({ affectedTrains: affectedTrainsCount, estPassengers });

    // Find Reserves
    // Strategy: Look for shifts with service code "Guardia" (not standardized in this codebase yet, maybe 'S0' or specific descriptions?)
    // Or just "Available" personnel (Type 'REST' in database?)
    // For now, let's use the 'restingResults' or 'groupedRestPersonnel' logic we already have calculated via useIncidenciaGraph?
    // Actually, let's query 'shifts' for anyone with 'reserva' or 'guardia' in observacions or service.

    // Simplified: Find closest personnel in 'Rest' state near the cut.
    // We can use 'liveData' filtering for type 'REST'.

    const cuts = Array.from(selectedCutStations);
    const reserves = liveData
      .filter(p => p.type === 'REST')
      .map(p => {
        // Calculate distance to cut (Graph hops would be better, but simple station check for now)
        // Just return them all, let UI sort/display.
        return { ...p, distance: 0 }; // Placeholder
      });

    setNearbyReserves(reserves);

  }, [selectedCutStations, selectedCutSegments, liveData, enrichedGeoTrenData, isGeoTrenEnabled]);

  useEffect(() => {
    if (isGeoTrenEnabled && !isPaused) {
      fetchGeoTrenData();
      const interval = setInterval(fetchGeoTrenData, 20000);
      return () => clearInterval(interval);
    }
  }, [isGeoTrenEnabled, isPaused]);

  const getSegments = (turn: any) => {
    if (!turn) return [];
    const startMin = getFgcMinutes(turn.inici_torn);
    const endMin = getFgcMinutes(turn.final_torn);
    if (startMin === null || endMin === null) return [];

    const segments: any[] = [];
    let currentPos = startMin;
    const circs = turn.fullCirculations || [];

    circs.forEach((circ: any, index: number) => {
      const cStart = getFgcMinutes(circ.sortida);
      const cEnd = getFgcMinutes(circ.arribada);
      if (cStart !== null && cEnd !== null) {
        if (cStart > currentPos) {
          let locationCode = index === 0 ? (circ.machinistInici || turn.dependencia || '') : (circs[index - 1].machinistFinal || '');

          // Infer track for gap: Prefer next circ start track, or prev circ end track
          let via = circ.via_inici;
          if (!via && circ.estacions && circ.estacions.length > 0) via = circ.estacions[0].via;

          if (!via && index > 0) {
            const prev = circs[index - 1];
            via = prev.via_final;
            if (!via && prev.estacions && prev.estacions.length > 0) via = prev.estacions[prev.estacions.length - 1].via;
          }

          segments.push({ start: currentPos, end: cStart, type: 'gap', codi: (locationCode || '').trim().toUpperCase() || 'DESCANS', via });
        }
        segments.push({ start: cStart, end: cEnd, type: 'circ', codi: circ.codi, train: circ.train });
        currentPos = Math.max(currentPos, cEnd);
      }
    });

    if (currentPos < endMin) {
      const lastLoc = circs.length > 0 ? circs[circs.length - 1].machinistFinal : turn.dependencia;
      let via: string | undefined = undefined;
      if (circs.length > 0) {
        const last = circs[circs.length - 1];
        via = last.via_final;
        if (!via && last.estacions && last.estacions.length > 0) via = last.estacions[last.estacions.length - 1].via;
      }
      segments.push({ start: currentPos, end: endMin, type: 'gap', codi: (lastLoc || '').trim().toUpperCase() || 'FINAL', via });
    }
    return segments;
  };

  const getPcOffsetY = (viaStr: string | undefined): number => {
    // Robust parsing: "Via 3" -> 3, "3" -> 3, "V3" -> 3
    const numStr = viaStr ? String(viaStr).replace(/\D/g, '') : '';
    const v = parseInt(numStr || '0');
    // Mapping: V1->+4 (Inbound/V2 align), V2->-4 (Outbound/V1 align), V3->+12, V4->+20, V5->+28
    if (v === 1) return 4;
    if (v === 2) return -4;
    if (v === 3) return 12;
    if (v === 4) return 20;
    if (v === 5) return 28;
    return 4; // Default to Track 1 (Inbound align)
  };

  const fetchLiveMapData = async () => {
    setLoading(true);
    try {
      const displayTime = formatFgcTime(displayMin);

      // Optimizació: En lloc de portar TOTS els shifts i TOTES les circulacions,
      // intentem filtrar per horari o almenys processar de forma més eficient.

      // 1. Cercar shifts que podrien estar actius (aproximació per string o portar-los tots si són pocs)
      const { data: allShifts } = await supabase.from('shifts').select('*');
      if (!allShifts) return;

      const activeShifts = allShifts.filter(s => {
        const sMin = getFgcMinutes(s.inici_torn);
        const eMin = getFgcMinutes(s.final_torn);
        return sMin !== null && eMin !== null && displayMin >= sMin && displayMin <= eMin;
      });

      if (activeShifts.length === 0) {
        setLiveData([]);
        setLoading(false);
        return;
      }

      // 2. Cercar només les circulacions que apareixen en aquests shifts actius
      const requiredCircIds = new Set<string>();
      activeShifts.forEach(s => {
        (s.circulations as any[]).forEach(c => {
          const codi = typeof c === 'string' ? c : c.codi;
          if (codi && codi !== 'VIATGER') requiredCircIds.add(codi.toUpperCase());
        });
      });

      const { data: allDaily } = await supabase.from('daily_assignments').select('*');
      const { data: allPhones } = await supabase.from('phonebook').select('nomina, phones');

      const stationCoords = MAP_STATIONS.reduce((acc, st) => {
        acc[st.id.toUpperCase()] = { x: st.x, y: st.y };
        return acc;
      }, {} as Record<string, { x: number, y: number }>);

      const VALID_STATION_IDS = new Set(MAP_STATIONS.map(s => s.id));

      const currentPersonnel: LivePersonnel[] = [];
      const processedKeys = new Set<string>();

      let circDetailsData: any[] = [];
      if (requiredCircIds.size > 0) {
        const { data } = await supabase.from('circulations').select('*').in('id', Array.from(requiredCircIds));
        if (data) {
          circDetailsData = data;
          setCircDetailsData(data); // Save to state for GeoTren matching
        }
      }

      if (circDetailsData.length === 0) {
        setLoading(false);
        return;
      }

      const circDetailsMap = new Map<string, any>(circDetailsData.map((c: any) => [c.id.trim().toUpperCase(), c]));

      // Pre-calculate full turns for active shifts to use getSegments
      // We need to fetch full data for "gap" positioning
      // Optimization: Fetch all needed turns in one go if not "Tots"
      // But fetchFullTurns is heavy. Let's do it for logical correctness.
      let enrichedShifts: any[] = [];
      if (activeShifts.length > 0) {
        enrichedShifts = await fetchFullTurns(activeShifts.map(s => s.id), selectedServei === 'Tots' ? undefined : selectedServei);
      }
      const enrichedShiftsMap = new Map(enrichedShifts.map(s => [s.id, s]));

      enrichedShifts.forEach(shift => {
        const shiftService = (shift.servei || '').toString();

        let isShiftVisible = false;
        if (selectedServei === 'Tots') {
          isShiftVisible = true;
        } else {
          if (selectedServei === '400') isShiftVisible = shiftService === '400' || shiftService === 'S1';
          else if (selectedServei === '500') isShiftVisible = shiftService === '500' || shiftService === 'S2';
          else if (selectedServei === '100') isShiftVisible = shiftService === '100' || shiftService === 'L6';
          else if (selectedServei === '0') isShiftVisible = shiftService === '0' || shiftService === 'L12';
          else isShiftVisible = (shiftService === selectedServei);
        }

        if (!isShiftVisible) return;

        // Process Circulations (Moving Trains)
        (shift.circulations as any[]).forEach((cRef: any) => {
          const rawCodi = (typeof cRef === 'string' ? cRef : cRef.codi);
          const codi = rawCodi?.trim().toUpperCase() || '';

          if (!codi || codi === 'VIATGER') return;
          if (processedKeys.has(codi)) return; // Already processed as active train

          let circ = circDetailsMap.get(codi);

          if (!circ && typeof cRef === 'object' && cRef.sortida && cRef.arribada) {
            circ = { ...cRef, id: codi, linia: codi.startsWith('F') ? 'F' : (cRef.linia || 'S/L') };
          }

          if (!circ) return;

          let startMin = getFgcMinutes(circ.sortida);
          let endMin = getFgcMinutes(circ.arribada);
          const estacions = (circ.estacions as any[]) || [];

          if (startMin === null && estacions.length > 0) startMin = getFgcMinutes(estacions[0].hora || estacions[0].arribada || estacions[0].sortida);
          if (endMin === null && estacions.length > 0) endMin = getFgcMinutes(estacions[estacions.length - 1].hora || estacions[estacions.length - 1].arribada || estacions[estacions.length - 1].sortida);

          // If currently moving
          if (startMin !== null && endMin !== null && displayMin >= startMin && displayMin <= endMin) {

            const validStops = estacions
              .map((st: any) => ({
                nom: resolveStationId(st.nom || st.id, circ.linia),
                min: getFgcMinutes(st.hora || st.arribada || st.sortida),
                via: st.via // Capture stop specific track
              }))
              .filter((s: any) => s.min !== null && s.nom !== null && VALID_STATION_IDS.has(s.nom));

            // Extract via_inici / via_final from circ, or fallback to estacions
            let viaInici = circ.via_inici;
            if (!viaInici && estacions.length > 0) viaInici = estacions[0].via;

            let viaFinal = circ.via_final;
            if (!viaFinal && estacions.length > 0) viaFinal = estacions[estacions.length - 1].via;

            const startID = resolveStationId(circ.inici || (estacions[0]?.nom), circ.linia);
            const endID = resolveStationId(circ.final || (estacions[estacions.length - 1]?.nom), circ.linia);

            const stopsWithTimes = [
              { nom: startID, min: startMin, via: viaInici },
              ...validStops,
              { nom: endID, min: endMin, via: viaFinal }
            ]
              .filter(s => VALID_STATION_IDS.has(s.nom))
              .sort((a: any, b: any) => a.min - b.min);

            if (stopsWithTimes.length < 1) return;

            let x = 0, y = 0, currentStationId = stopsWithTimes[0].nom;

            if (stopsWithTimes.length === 1) {
              const p = stationCoords[currentStationId] || stationCoords['PC'];
              x = p.x; y = p.y;
              // Single stop track assign
              if (currentStationId === 'PC' && stopsWithTimes[0].via) {
                y = p.y + getPcOffsetY(stopsWithTimes[0].via);
              }
            } else {
              const expandedStops: { nom: string, min: number, via?: string }[] = [];
              for (let i = 0; i < stopsWithTimes.length - 1; i++) {
                const current = stopsWithTimes[i];
                const next = stopsWithTimes[i + 1];
                const path = getFullPath(current.nom, next.nom);
                if (path.length > 1) {
                  for (let j = 0; j < path.length - 1; j++) {
                    const ratio = j / (path.length - 1);
                    expandedStops.push({ nom: path[j], min: current.min + (next.min - current.min) * ratio, via: j === 0 ? current.via : undefined });
                  }
                } else expandedStops.push(current);
              }
              expandedStops.push(stopsWithTimes[stopsWithTimes.length - 1]);

              for (let i = 0; i < expandedStops.length - 1; i++) {
                const s1 = expandedStops[i];
                const s2 = expandedStops[i + 1];
                if (displayMin >= s1.min && displayMin <= s2.min) {
                  currentStationId = s1.nom;
                  const p1 = stationCoords[s1.nom] || stationCoords['PC'];
                  const p2 = stationCoords[s2.nom] || stationCoords['PC'];

                  const isMovingRight = (p2.x - p1.x) >= 0;
                  const offset = isMovingRight ? -4 : 4;

                  if (s1.min === s2.min) {
                    x = p1.x; y = p1.y + offset;
                    // Stop specific override for PC
                    if (s1.nom === 'PC') {
                      y = p1.y + getPcOffsetY(s1.via);
                    }
                  } else {
                    const progress = (displayMin - s1.min) / (s2.min - s1.min);
                    x = p1.x + (p2.x - p1.x) * progress;
                    y = p1.y + (p2.y - p1.y) * progress + offset;

                    // Smooth transition from PC track?
                    // If departing PC (s1=PC), interpolate from track Y to line Y?
                    // If arriving PC (s2=PC), interpolate from line Y to track Y?
                    // For now, let's keep it simple: On line between stations defaults to track offset.
                    // If user demands perfect animation, we interpolate Y offsets.

                    if (s1.nom === 'PC') {
                      const startYOffset = getPcOffsetY(s1.via);
                      const endYOffset = offset; // Segment line default
                      const interpOffset = startYOffset + (endYOffset - startYOffset) * progress;
                      y = p1.y + (p2.y - p1.y) * progress + interpOffset;
                    } else if (s2.nom === 'PC') {
                      const startYOffset = offset;
                      const endYOffset = getPcOffsetY(s2.via);
                      const interpOffset = startYOffset + (endYOffset - startYOffset) * progress;
                      y = p1.y + (p2.y - p1.y) * progress + interpOffset;
                    }
                  }
                  break;
                }
              }
            }

            const shortTorn = getShortTornId(shift.id);
            const assignment = allDaily?.find(d => d.torn === shortTorn);
            const driverPhones = allPhones?.find(p => p.nomina === assignment?.empleat_id)?.phones || [];

            if (manualOverrides[codi]) {
              const overrideStation = manualOverrides[codi];
              const overrideCoords = stationCoords[overrideStation] || { x: 0, y: 0 };
              let customY = overrideCoords.y - 4;
              if (overrideStation === 'PC') {
                // Assume Track 1 for overrides unless specified... hard to guess via for overrides
                customY = overrideCoords.y + 4; // Track 1 default
              }
              currentPersonnel.push({
                type: 'TRAIN', id: (circ as any).id as string, linia: (circ as any).linia as string,
                stationId: overrideStation, color: getLiniaColorHex((codi.startsWith('F') ? 'F' : (circ as any).linia) as string),
                driver: assignment ? `${(assignment as any).cognoms}, ${(assignment as any).nom}` : 'Sense assignar',
                driverName: (assignment as any)?.nom, driverSurname: (assignment as any)?.cognoms,
                torn: shift?.id || '---',
                shiftStartMin: getFgcMinutes(shift.inici_torn) || 0,
                shiftEndMin: getFgcMinutes(shift.final_torn) || 0,
                shiftDep: resolveStationId(shift.dependencia || '', shiftService),
                phones: driverPhones, inici: (circ as any).inici, final: (circ as any).final,
                horaPas: formatFgcTime(displayMin), x: overrideCoords.x, y: customY
              });
              processedKeys.add(codi);
              return;
            }

            currentPersonnel.push({
              type: 'TRAIN',
              id: (circ as any).id as string,
              linia: (circ as any).linia as string,
              stationId: currentStationId as string,
              color: getLiniaColorHex((codi.startsWith('F') ? 'F' : (circ as any).linia) as string),
              driver: assignment ? `${(assignment as any).cognoms}, ${(assignment as any).nom}` : 'Sense assignar',
              driverName: (assignment as any)?.nom, driverSurname: (assignment as any)?.cognoms,
              torn: shift?.id || '---',
              shiftStartMin: getFgcMinutes(shift.inici_torn) || 0,
              shiftEndMin: getFgcMinutes(shift.final_torn) || 0,
              shiftDep: resolveStationId(shift.dependencia || '', shiftService),
              phones: driverPhones,
              inici: (circ as any).inici, final: (circ as any).final,
              horaPas: formatFgcTime(displayMin),
              x, y
            });
            processedKeys.add(codi);
          }
        });

        // Stationary / Gap Handling
        const startMin = getFgcMinutes(shift.inici_torn);
        const endMin = getFgcMinutes(shift.final_torn);

        if (startMin !== null && endMin !== null && displayMin >= startMin && displayMin < endMin) {
          const isWorking = currentPersonnel.some(p => p.torn === shift.id);
          if (!isWorking) {
            const shortTorn = getShortTornId(shift.id);
            const assignment = allDaily?.find(d => d.torn === shortTorn);

            // Use getSegments to find accurate location
            const segs = getSegments(shift);
            const currentSeg = segs.find(s => displayMin >= s.start && displayMin < s.end);

            let rawLoc = (shift.dependencia || '').trim().toUpperCase();
            let isStationaryTrain = false;
            let gapVia: string | undefined = undefined;

            if (currentSeg && currentSeg.type === 'gap') {
              rawLoc = (currentSeg.codi || '').trim().toUpperCase();
              isStationaryTrain = true;
              gapVia = currentSeg.via;
            }

            const loc = resolveStationId(rawLoc, shiftService);

            if (loc && stationCoords[loc] && assignment) {
              const driverPhones = allPhones?.find(p => p.nomina === (assignment as any).empleat_id)?.phones || [];
              const coords = stationCoords[loc] || { x: 0, y: 0 };

              let yPos = coords.y - (isStationaryTrain ? 4 : 0);
              if (loc === 'PC' && isStationaryTrain) {
                yPos = coords.y + getPcOffsetY(gapVia);
              }

              currentPersonnel.push({
                type: isStationaryTrain ? 'TRAIN' : 'REST',
                id: isStationaryTrain ? 'EST' : 'DESCANS',
                linia: 'S/L',
                stationId: loc,
                color: isStationaryTrain ? '#9ca3af' : '#53565A', // Grey for stationary
                driver: `${(assignment as any).cognoms}, ${(assignment as any).nom}`,
                driverName: (assignment as any).nom,
                driverSurname: (assignment as any).cognoms,
                torn: shift.id,
                shiftStartMin: getFgcMinutes(shift.inici_torn) || 0,
                shiftEndMin: getFgcMinutes(shift.final_torn) || 0,
                shiftDep: resolveStationId(shift.dependencia || '', shiftService),
                phones: driverPhones,
                inici: loc, final: loc, horaPas: formatFgcTime(displayMin),
                x: coords.x, y: yPos,
                label: isStationaryTrain ? (gapVia ? `E${gapVia.replace(/\D/g, '')}` : 'EST') : undefined
              });
            }
          }
        }
      });

      const collisionMap: Record<string, number> = {};
      const offsetData = currentPersonnel.map(p => {
        const key = `${Math.round(p.x)},${Math.round(p.y)}`;
        const count = collisionMap[key] || 0;
        collisionMap[key] = count + 1;
        return { ...p, visualOffset: count };
      });
      setLiveData(offsetData);
    } catch (e) { console.error("Error live map:", e); } finally { setLoading(false); }
  };



  useEffect(() => { if (mode === 'LINIA') fetchLiveMapData(); }, [mode, displayMin, selectedServei, manualOverrides]);



  const fetchFullTurnData = async (turnId: string) => {
    const results = await fetchFullTurns([turnId], selectedServei === 'Tots' ? undefined : selectedServei);
    return results[0] || null;
  };



  const handleSearch = async () => {
    if (!query) return;
    setLoading(true); setOriginalShift(null);
    setPassengerResults([]); setAdjacentResults({ anterior: [], posterior: [] }); setRestingResults([]); setExtensibleResults([]); setReserveInterceptResults([]);
    try {
      const { data: shifts } = await supabase.from('shifts').select('*');
      const target = shifts?.find(s => (s.circulations as any[]).some(c => (typeof c === 'string' ? c : c.codi).toUpperCase() === query.toUpperCase()));
      if (target) {
        const enriched = await fetchFullTurnData(target.id);
        setOriginalShift(enriched);
        setSelectedCircId(query.toUpperCase());
        setSelectedStation(enriched?.fullCirculations.find((c: any) => c.codi.toUpperCase() === query.toUpperCase())?.inici || '');
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const calculateRelief = async () => {
    if (!selectedCircId || !selectedStation || !originalShift) return;
    setCalculating(true);
    setPassengerResults([]); setAdjacentResults({ anterior: [], posterior: [] }); setRestingResults([]); setExtensibleResults([]); setReserveInterceptResults([]);
    try {
      let shiftsQuery = supabase.from('shifts').select('id, servei, circulations, inici_torn, final_torn, duracio, dependencia');

      if (selectedServei !== 'Tots') {
        shiftsQuery = (shiftsQuery as any).eq('servei', selectedServei);
      }

      const { data: allShiftsRaw = [] } = await (shiftsQuery as any);
      const { data: tcDetail = null } = await (supabase.from('circulations').select('*').eq('id', selectedCircId).single() as any);

      if (!allShiftsRaw || !tcDetail) { setCalculating(false); return; }

      const reliefTimeStr = (tcDetail.inici === selectedStation ? tcDetail.sortida : (tcDetail.estacions?.find((s: any) => s.nom === selectedStation)?.hora || tcDetail.arribada)) as string | undefined;
      const reliefMin = getFgcMinutes(reliefTimeStr);
      const arribadaMin = getFgcMinutes(tcDetail.arribada as string | undefined);

      if (reliefMin === null || arribadaMin === null) { setCalculating(false); return; }

      const passIds: string[] = [];
      const antIds: string[] = [];
      const postIds: string[] = [];

      const { data: sameLine } = await (supabase.from('circulations').select('id, sortida').eq('linia', (tcDetail as any).linia).eq('final', (tcDetail as any).final) as any);
      const sorted = (sameLine as any[])?.sort((a: any, b: any) => (getFgcMinutes(a.sortida as string) || 0) - (getFgcMinutes(b.sortida as string) || 0)) || [];
      const idx = sorted.findIndex((c: any) => (c as any).id === (tcDetail as any).id);
      const antId = idx > 0 ? (sorted[idx - 1] as any).id : null;
      const postId = idx < sorted.length - 1 ? (sorted[idx + 1] as any).id : null;

      (allShiftsRaw as any[]).forEach((s: any) => {
        (s.circulations as any[]).forEach(c => {
          if (c.codi === 'Viatger' && c.observacions) {
            const obs = c.observacions.split('-')[0].toUpperCase();
            if (obs === selectedCircId) passIds.push(s.id);
            if (antId && obs === antId) antIds.push(s.id);
            if (postId && obs === postId) postIds.push(s.id);
          }
        });
      });

      const [resPass, resAnt, resPost] = await Promise.all([
        fetchFullTurns(passIds, selectedServei === 'Tots' ? undefined : selectedServei),
        fetchFullTurns(antIds, selectedServei === 'Tots' ? undefined : selectedServei),
        fetchFullTurns(postIds, selectedServei === 'Tots' ? undefined : selectedServei)
      ]);

      setPassengerResults(resPass);
      setAdjacentResults({
        anterior: resAnt.map(t => ({ ...t, adjCode: antId })),
        posterior: resPost.map(t => ({ ...t, adjCode: postId }))
      });

      const resting: any[] = [];
      const extensible: any[] = [];
      const reserves: any[] = [];
      const enrichedAll = await fetchFullTurns(allShiftsRaw.map(s => s.id), selectedServei === 'Tots' ? undefined : selectedServei);

      const normalizedStation = resolveStationId(selectedStation);

      enrichedAll.forEach(tData => {
        if (!tData || tData.id === originalShift.id) return;
        const segs = getSegments(tData);
        const [h, m] = (tData.duracio || "00:00").split(':').map(Number);
        const dur = h * 60 + m;

        const isRestHere = segs.find(seg =>
          seg.type === 'gap' &&
          resolveStationId(seg.codi as string) === normalizedStation &&
          seg.start <= (reliefMin + 1) &&
          seg.end >= (reliefMin - 1)
        );

        if (isRestHere) resting.push({ ...tData, restSeg: isRestHere });

        if (dur < 525 && isRestHere) {
          const conflict = segs.some(seg => seg.type === 'circ' && seg.start >= reliefMin && seg.start < (arribadaMin + 15));
          if (!conflict) {
            const tFinal = getFgcMinutes(tData.final_torn);
            if (tFinal !== null) {
              const extra = Math.max(0, (arribadaMin + 15) - tFinal);
              if (dur + extra <= 525) extensible.push({ ...tData, extData: { estimatedReturn: arribadaMin + 15, extra } });
            }
          }
        }

        const isS1Zone = ['MS', 'HG', 'RB', 'FN', 'TR', 'VP', 'EN', 'NA'].includes(normalizedStation);
        const isS2Zone = ['VO', 'SJ', 'BT', 'UN', 'SQ', 'CF', 'PJ', 'CT', 'NO', 'PN'].includes(normalizedStation);

        const resPoint = RESERVAS_CONFIG.find(r => {
          const timeOk = isReserveActive(r, reliefMin);
          if (!timeOk) return false;
          if (isS1Zone) return r.loc === 'RB';
          if (isS2Zone) return r.loc === 'SR' || r.loc === 'PN';
          return normalizedStation === r.loc;
        });

        if (resPoint && tData.id.includes(resPoint.id)) {
          reserves.push({ ...tData, resData: { resId: resPoint.id, loc: resPoint.loc, time: reliefTimeStr } });
        }
      });

      setRestingResults(resting);
      setExtensibleResults(extensible);
      setReserveInterceptResults(reserves);
    } catch (e) { console.error(e); } finally { setCalculating(false); }
  };

  const isReserveActive = (res: any, timeMin: number) => {
    const start = getFgcMinutes(res.start as string | undefined);
    const end = getFgcMinutes(res.end as string | undefined);
    if (start === null || end === null) return false;
    if (start > end) {
      return timeMin >= start || timeMin < end;
    }
    return timeMin >= start && timeMin < end;
  };

  const resetAllModeData = () => {
    setMode('INIT'); setQuery(''); setOriginalShift(null); setSelectedCircId(''); setSelectedStation('');
    setPassengerResults([]); setAdjacentResults({ anterior: [], posterior: [] }); setRestingResults([]); setExtensibleResults([]); setReserveInterceptResults([]);
    setSelectedCutStations(new Set()); setSelectedCutSegments(new Set()); setAltServiceIsland(null);
  };

  const toggleStationCut = (id: string) => {
    setSelectedCutStations(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTrackCut = (from: string, to: string, track: 1 | 2) => {
    const id = `${from}-${to}-V${track}`;
    const reverseId = `${to}-${from}-V${track}`;
    setSelectedCutSegments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.has(reverseId)) next.delete(reverseId);
      else next.add(id);
      return next;
    });
  };

  const clearAllCuts = () => { setSelectedCutStations(new Set()); setSelectedCutSegments(new Set()); setAltServiceIsland(null); };



  const groupedRestPersonnel = useMemo(() => {
    const rest = liveData.filter(p => p.type === 'REST');
    const grouped: Record<string, LivePersonnel[]> = {};
    rest.forEach(p => { if (!grouped[p.stationId]) grouped[p.stationId] = []; grouped[p.stationId].push(p); });
    return grouped;
  }, [liveData]);

  const CompactRow: React.FC<{ torn: any, color: string, label?: React.ReactNode, sub?: string }> = ({ torn, color, label, sub }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all flex items-center gap-4 border-l-4 ${color}`}>
      <div className="h-10 min-w-[2.5rem] px-2 bg-fgc-grey/10 dark:bg-black text-fgc-grey dark:text-gray-300 rounded-xl flex items-center justify-center font-black text-xs shrink-0">{torn.id}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2"><p className="text-sm font-black text-fgc-grey dark:text-gray-200 uppercase">{torn.drivers[0]?.cognoms}, {torn.drivers[0]?.nom}</p>{label}</div>
        <p className="text-[8px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest truncate">Nom. {torn.drivers[0]?.nomina} • {torn.inici_torn}-{torn.final_torn} {sub ? `• ${sub}` : ''}</p>
      </div>
      <div className="flex gap-1 shrink-0">{torn.drivers[0]?.phones?.map((p: string, i: number) => (
        <a key={i} href={`tel:${p}`} className="w-9 h-9 bg-fgc-grey dark:bg-black text-white rounded-xl flex items-center justify-center hover:bg-fgc-green transition-all shadow-sm"><Phone size={14} /></a>
      ))}</div>
    </div>
  );

  const ListPersonnelRow: React.FC<{ item: LivePersonnel; variant: 'normal' | 'affected'; isDisplaced?: boolean }> = ({ item, variant, isDisplaced }) => {
    const isRest = item.type === 'REST';
    return (
      <div className={`px-4 py-2.5 flex items-center justify-between transition-all group hover:bg-gray-50 dark:hover:bg-white/5 ${variant === 'affected' ? 'bg-red-50/20' : ''}`}>
        <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
          {isDisplaced && (
            <div className="flex items-center justify-center p-2 bg-red-500 rounded-xl text-white shadow-lg animate-pulse" title="Maquinista desplaçat de la seva zona d'inici">
              <Bell size={16} fill="currentColor" />
            </div>
          )}
          {(!isRest && (variant === 'affected' || manualOverrides[item.id])) && (
            <div className="relative">
              <button
                onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                className={`p-2 rounded-xl transition-all shadow-sm flex items-center justify-center ${openMenuId === item.id ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500' : manualOverrides[item.id] ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-[#fff1e6] text-[#f97316] hover:bg-[#ffe2cc]'}`}
                title={manualOverrides[item.id] ? "Mogut manualment" : "Moure a una altra zona"}
              >
                <Repeat size={16} />
              </button>

              {openMenuId === item.id && (
                <div className="absolute left-0 top-full mt-2 w-56 sm:w-64 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 z-[300] py-4 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 pb-3 border-b border-gray-50 dark:border-white/5 mb-2">
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Moure {item.id} a...</p>
                  </div>
                  <div className="flex flex-col">
                    {manualOverrides[item.id] && (
                      <button
                        onClick={() => {
                          setManualOverrides(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                          setOpenMenuId(null);
                        }}
                        className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-left group mb-2 mx-2 rounded-xl"
                      >
                        <RotateCcw size={14} className="text-red-500" />
                        <span className="text-xs font-black text-red-600 dark:text-red-400 uppercase">Restaurar Original</span>
                      </button>
                    )}
                    {[
                      { id: 'BCN', label: 'Costat Pl. Catalunya', target: 'PC' },
                      { id: 'VALLES', label: 'Costat Vallès (S1 + S2)', target: 'SC' },
                      { id: 'S1', label: 'Ramal Terrassa S1', target: 'NA' },
                      { id: 'S2', label: 'Ramal Sabadell S2', target: 'PN' },
                      { id: 'L6', label: 'Reina Elisenda L12', target: 'RE' },
                      { id: 'L7', label: 'Ramal Tibidabo', target: 'TB' }
                    ].map((dest) => {
                      const island = dividedPersonnel?.[dest.id];
                      const vallesUnified = dividedPersonnel?.VALLES.isUnified;

                      // Filtres segons topologia
                      if (dest.id === 'VALLES' && !vallesUnified) return null;
                      if ((dest.id === 'S1' || dest.id === 'S2') && vallesUnified) return null;

                      if (!island || island.stations.size === 0) return null;

                      // Determinar estació de destí real dins de l'illa si la preferida no hi és
                      const finalTarget = island.stations.has(dest.target) ? dest.target : Array.from(island.stations)[0];

                      return (
                        <button
                          key={dest.id}
                          onClick={() => {
                            setManualOverrides(prev => ({ ...prev, [item.id]: finalTarget }));
                            setOpenMenuId(null);
                          }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left group"
                        >
                          <Move size={14} className="text-gray-400 group-hover:text-blue-500" />
                          <span className="text-xs font-black text-fgc-grey dark:text-gray-200 uppercase">{dest.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className={`min-w-[60px] sm:min-w-[75px] px-2 py-1 rounded-lg text-[10px] sm:text-xs font-black text-white text-center shadow-sm flex items-center justify-center gap-1.5 ${isRest ? 'bg-fgc-green border border-fgc-green/30 text-fgc-grey' : ''}`} style={isRest ? {} : { backgroundColor: item.color }}>
            {isRest ? <Coffee size={12} /> : null} {isRest ? 'DES' : item.id}
          </div>
          <div className="bg-fgc-grey dark:bg-black text-white px-2 py-1 rounded text-[9px] sm:text-[10px] font-black min-w-[45px] text-center shrink-0 border border-white/10">{item.torn}</div>
          <p className={`text-[12px] sm:text-sm font-bold uppercase ${variant === 'affected' ? 'text-red-700 dark:text-red-400 font-black' : isRest ? 'text-fgc-green font-black' : 'text-fgc-grey dark:text-gray-300'}`}>{item.driver}</p>
          <div className="hidden md:flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest"><MapPin size={10} className="text-gray-300" /> {item.stationId}</div>
        </div>
        <div className="flex items-center gap-2 pl-4">
          {item.phones && item.phones.length > 0 && (
            <a href={`tel:${item.phones[0]}`} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all shadow-sm ${variant === 'affected' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-100 dark:bg-black text-fgc-grey dark:text-gray-400 hover:bg-fgc-green hover:text-white'}`}>
              <Phone size={12} /> <span className="hidden sm:inline text-[10px] font-black">{item.phones[0]}</span>
            </a>
          )}
        </div>
      </div>
    );
  };





  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-500 rounded-2xl text-white shadow-lg shadow-red-500/20"><ShieldAlert size={28} /></div>
          <div><h1 className="text-3xl font-black text-fgc-grey dark:text-white tracking-tight uppercase">Gestió d'Incidències</h1><p className="text-gray-500 dark:text-gray-400 font-medium">Cerca cobertures avançades i gestiona talls operatius.</p></div>
        </div>
        {mode !== 'INIT' && (
          <div className="flex flex-col gap-2"><span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Filtre de Servei (Torn)</span><div className="inline-flex bg-white dark:bg-gray-900 p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5">{['Tots', ...serveiTypes].map(s => (<button key={s} onClick={() => setSelectedServei(s)} className={`px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${selectedServei === s ? 'bg-fgc-grey dark:bg-fgc-green dark:text-fgc-grey text-white shadow-lg' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'}`}>{s === 'Tots' ? 'Tots' : `S-${s}`}</button>))}</div></div>
        )}
      </header>

      {mode === 'INIT' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-12 max-w-6xl mx-auto">
          <button onClick={() => setMode('MAQUINISTA')} className="group bg-white dark:bg-gray-900 p-10 rounded-[48px] border border-gray-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all flex flex-col items-center gap-6"><div className="w-24 h-24 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform"><User size={48} /></div><div className="text-center"><h3 className="text-2xl font-black text-fgc-grey dark:text-white uppercase tracking-tight">Per Maquinista</h3><p className="text-sm font-medium text-gray-400 mt-2">Identifica tren i busca cobertura avançada amb intercepció de reserves.</p></div></button>
          <button onClick={() => setMode('LINIA')} className="group bg-white dark:bg-gray-900 p-10 rounded-[48px] border border-gray-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all flex flex-col items-center gap-6"><div className="w-24 h-24 bg-fgc-green/10 rounded-full flex items-center justify-center text-fgc-green group-hover:scale-110 transition-transform"><MapIcon size={48} /></div><div className="text-center"><h3 className="text-2xl font-black text-fgc-grey dark:text-white uppercase tracking-tight">Per Línia / Tram</h3><p className="text-sm font-medium text-gray-400 mt-2">Gestiona talls de servei i identifica personal a cada costat.</p></div></button>
          <button onClick={() => setMode('PER_TORN')} className="group bg-white dark:bg-gray-900 p-10 rounded-[48px] border border-gray-100 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all flex flex-col items-center gap-6"><div className="w-24 h-24 bg-blue-50 dark:bg-blue-950/20 rounded-full flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"><RotateCcw size={48} /></div><div className="text-center"><h3 className="text-2xl font-black text-fgc-grey dark:text-white uppercase tracking-tight">Per Torn</h3><p className="text-sm font-medium text-gray-400 mt-2">Cobreix totes les circulacions d'un torn descobert utilitzant els buits d'altres.</p></div></button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-start"><button onClick={resetAllModeData} className="text-[10px] font-black text-fgc-green hover:underline uppercase tracking-[0.2em] flex items-center gap-2">← Tornar al selector</button></div>
          {mode === 'MAQUINISTA' && (
            <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-white/5 transition-colors">
              <div className="max-w-2xl mx-auto space-y-6 text-center w-full">
                <h3 className="text-sm font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Identifica el Tren afectat</h3>
                <div className="relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={24} />
                  <input type="text" placeholder="Ex: 1104, 2351..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="w-full bg-gray-50 dark:bg-black/20 border-none rounded-[28px] py-6 pl-16 pr-8 focus:ring-4 focus:ring-red-500/20 outline-none text-xl font-bold transition-all dark:text-white shadow-inner" />
                  <button onClick={handleSearch} disabled={loading || !query} className="absolute right-3 top-1/2 -translate-y-1/2 bg-fgc-grey dark:bg-fgc-green text-white dark:text-fgc-grey px-8 py-3 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={20} /> : 'BUSCAR'}</button>
                </div>
              </div>
            </div>
          )}
          {mode === 'LINIA' && (
            <div className="w-full">
              <IncidenciaMap
                isRealTime={isRealTime}
                setIsRealTime={setIsRealTime}
                customTime={customTime}
                setCustomTime={setCustomTime}
                isPaused={isPaused}
                setIsPaused={setIsPaused}
                isGeoTrenEnabled={isGeoTrenEnabled}
                setIsGeoTrenEnabled={setIsGeoTrenEnabled}
                fetchLiveMapData={fetchLiveMapData}
                selectedCutStations={selectedCutStations}
                selectedCutSegments={selectedCutSegments}
                clearAllCuts={clearAllCuts}
                toggleTrackCut={toggleTrackCut}
                toggleStationCut={toggleStationCut}
                groupedRestPersonnel={groupedRestPersonnel}
                liveData={liveData}
                dividedPersonnel={dividedPersonnel}
                setAltServiceIsland={setAltServiceIsland}
                islands={islands}
                selectedRestLocation={selectedRestLocation}
                setSelectedRestLocation={setSelectedRestLocation}
                geoTrenData={enrichedGeoTrenData}
                garageOccupation={garageOccupation}
                impactAnalysis={impactAnalysis}
                nearbyReserves={nearbyReserves}
                manualOverrides={manualOverrides}
                setManualOverrides={setManualOverrides}
              />
            </div>
          )}
          {mode === 'PER_TORN' && (<IncidenciaPerTorn selectedServei={selectedServei} showSecretMenu={showSecretMenu} />)}
          {mode === 'MAQUINISTA' && originalShift && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-white/5 space-y-8">
                  <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-6">
                    <div className="h-12 min-w-[3.5rem] bg-red-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-lg">{originalShift.id}</div>
                    <div><h3 className="text-xl font-black text-fgc-grey dark:text-white uppercase tracking-tight">Detalls del Torn</h3><p className="text-xs font-bold text-gray-400">{originalShift.drivers[0]?.cognoms}, {originalShift.drivers[0]?.nom}</p></div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Tria la Circulació de Relleu</label>
                      <div className="grid grid-cols-1 gap-2">
                        {originalShift.fullCirculations.map((c: any) => (
                          <button key={c.codi} onClick={() => { setSelectedCircId(c.codi); setSelectedStation(c.inici); setPassengerResults([]); setAdjacentResults({ anterior: [], posterior: [] }); setRestingResults([]); setExtensibleResults([]); setReserveInterceptResults([]); }} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${selectedCircId === c.codi ? 'bg-red-50 dark:bg-red-950/20 border-red-500 shadow-md ring-1 ring-red-500' : 'bg-gray-50 dark:bg-black/20 border-gray-100 dark:border-white/5 hover:border-red-200'}`}>
                            <div className="flex items-center gap-4"><span className="font-black text-lg text-fgc-grey dark:text-white">{c.codi}</span><div className="flex items-center gap-2 text-gray-400"><Clock size={14} /><span className="text-xs font-bold">{c.sortida} — {c.arribada}</span></div></div>{selectedCircId === c.codi && <UserCheck size={20} className="text-red-500" />}
                          </button>
                        ))}
                      </div>
                    </div>
                    {selectedCircId && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">Estació de Relleu</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(() => {
                            const tc = originalShift.fullCirculations.find((c: any) => c.codi === selectedCircId);
                            if (!tc) return null;
                            const stations = [tc.inici, ...(tc.estacions?.map((s: any) => s.nom) || []), tc.final];
                            return stations.map((st: string, idx: number) => (
                              <button key={`${st}-${idx}`} onClick={() => { setSelectedStation(st); setPassengerResults([]); setAdjacentResults({ anterior: [], posterior: [] }); setRestingResults([]); setExtensibleResults([]); setReserveInterceptResults([]); }} className={`p-3 rounded-xl border text-[10px] font-black uppercase transition-all ${selectedStation === st ? 'bg-fgc-green text-fgc-grey border-fgc-green shadow-md' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-white/5 hover:border-fgc-green'}`}>{st}</button>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                    <button onClick={calculateRelief} disabled={calculating || !selectedStation} className="w-full bg-fgc-grey dark:bg-white text-white dark:text-fgc-grey py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-95 disabled:opacity-50">ANALITZAR COBERTURA</button>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-white/5 min-h-[600px] space-y-8">
                  <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-6"><Users size={20} className="text-fgc-green" /><h3 className="text-xl font-black text-fgc-grey dark:text-white uppercase tracking-tight">Personal Disponible</h3></div>
                  {calculating ? (<div className="py-20 flex flex-col items-center justify-center gap-4 opacity-30"><Loader2 size={48} className="animate-spin text-fgc-green" /><p className="text-xs font-black uppercase tracking-widest">Escanejant malla ferroviària...</p></div>) : (passengerResults.length > 0 || adjacentResults.anterior.length > 0 || adjacentResults.posterior.length > 0 || restingResults.length > 0 || extensibleResults.length > 0 || reserveInterceptResults.length > 0) ? (
                    <div className="space-y-10">
                      {passengerResults.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2"><Users size={14} className="text-blue-500" /> Viatgers al tren afectat</h3>
                          <div className="flex flex-col gap-2">
                            {passengerResults.map((t, i) => <CompactRow key={i} torn={t} color="border-l-blue-500" />)}
                          </div>
                        </div>
                      )}

                      {(adjacentResults.anterior.length > 0 || adjacentResults.posterior.length > 0) && (
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2"><Users size={14} className="text-purple-500" /> Viatgers (Anterior / Posterior)</h3>
                          <div className="flex flex-col gap-2">
                            {adjacentResults.anterior.map((t, i) => <CompactRow key={`ant-${i}`} torn={t} color="border-l-purple-400" label={<span className="flex items-center gap-1 text-[8px] text-purple-600 font-black uppercase"><Rewind size={10} /> {t.adjCode} (Ant)</span>} />)}
                            {adjacentResults.posterior.map((t, i) => <CompactRow key={`post-${i}`} torn={t} color="border-l-purple-600" label={<span className="flex items-center gap-1 text-[8px] text-purple-600 font-black uppercase"><FastForward size={10} /> {t.adjCode} (Post)</span>} />)}
                          </div>
                        </div>
                      )}

                      {reserveInterceptResults.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2"><Repeat size={14} className="text-indigo-500" /> Intercepció de Reserves</h3>
                          <div className="flex flex-col gap-2">
                            {reserveInterceptResults.map((t, i) => <CompactRow key={i} torn={t} color="border-l-indigo-500" label={<span className="flex items-center gap-1 text-[8px] text-indigo-500 font-black uppercase tracking-widest"><Repeat size={10} /> {t.resData.resId}</span>} sub={`Intercepció proposada a ${t.resData.loc}`} />)}
                          </div>
                        </div>
                      )}

                      {restingResults.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2"><Coffee size={14} className="text-fgc-green" /> En descans a {selectedStation}</h3>
                          <div className="flex flex-col gap-2">
                            {restingResults.map((t, i) => <CompactRow key={i} torn={t} color="border-l-fgc-green" sub={`Lliure fins les ${formatFgcTime(t.restSeg.end)}`} />)}
                          </div>
                        </div>
                      )}

                      {extensibleResults.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2"><Timer size={14} className="text-orange-500" /> Perllongaments de Jornada</h3>
                          <div className="flex flex-col gap-2">
                            {extensibleResults.map((t, i) => <CompactRow key={i} torn={t} color="border-l-orange-500" sub={`Retorn estimat: ${formatFgcTime(t.extData.estimatedReturn)}`} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : selectedStation ? (
                    <div className="py-20 text-center space-y-4 opacity-40">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-black/20 rounded-full flex items-center justify-center mx-auto text-gray-300 dark:text-gray-700"><Info size={28} /></div>
                      <p className="text-sm font-bold text-gray-500 max-w-[280px] mx-auto">Cap maquinista detectat en disposició de cobrir el relleu a {selectedStation}.</p>
                    </div>
                  ) : (
                    <div className="py-20 text-center space-y-4 opacity-40">
                      <div className="w-20 h-20 bg-gray-50 dark:bg-black/20 rounded-full flex items-center justify-center mx-auto text-gray-200 dark:text-gray-800"><User size={40} /></div>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest italic">Selecciona un punt de relleu</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {altServiceIsland && <AlternativeServiceOverlay islandId={altServiceIsland} onClose={() => setAltServiceIsland(null)} dividedPersonnel={dividedPersonnel || {}} displayMin={displayMin} garageOccupation={garageOccupation} selectedCutSegments={selectedCutSegments} />}

      {/* Feature 6.2: Station Info Board (P.I.B) */}
      {selectedStation && isGeoTrenEnabled && (
        <StationInfoBoard
          stationId={selectedStation}
          onClose={() => setSelectedStation('')}
          enrichedGeoTrenData={enrichedGeoTrenData}
        />
      )}

      {mode === 'INIT' && !loading && (<div className="py-32 text-center opacity-10 flex flex-col items-center"><ShieldAlert size={100} className="text-fgc-grey mb-8" /><p className="text-xl font-black uppercase tracking-[0.4em] text-fgc-grey">Centre de Gestió Operativa</p></div>)}
    </div>
  );
};



export default IncidenciaView;