import React, { useState, useEffect, useRef, useMemo } from 'react';
import { OrganizeType, PhonebookEntry, DailyAssignment } from '../types.ts';
import { Columns, ShieldAlert, Search, Phone, User, Hash, Loader2, Clock, LayoutGrid, ArrowRight, CheckCircle2, Coffee, X, Train, Info, UserCheck, Users, FastForward, Rewind, Bed, Timer, MapPin, Repeat, Filter, UserCircle, ChevronDown } from 'lucide-react';
import { supabase } from '../supabaseClient.ts';
import { fetchFullTurns } from '../utils/queries.ts';
import { getShortTornId } from '../utils/fgc.ts';
import { getServiceToday } from '../utils/serviceCalendar';
const RESERVAS_DATA = [
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

type DisDesFilterType = 'ALL' | 'DIS' | 'DES' | 'DIS_DES' | 'FOR' | 'VAC' | 'DAG';

export const OrganitzaView: React.FC = () => {
  const [organizeType, setOrganizeType] = useState<OrganizeType>(OrganizeType.Comparador);
  const [loading, setLoading] = useState(false);
  const [nowMin, setNowMin] = useState<number>(0);
  const [selectedServei, setSelectedServei] = useState<string>(getServiceToday());

  const [turn1Id, setTurn1Id] = useState('');
  const [turn2Id, setTurn2Id] = useState('');
  const [turn1Data, setTurn1Data] = useState<any>(null);
  const [turn2Data, setTurn2Data] = useState<any>(null);
  const [loadingComparator, setLoadingComparator] = useState(false);

  const [coverageQuery, setCoverageQuery] = useState('');
  const [searchedCircData, setSearchedCircData] = useState<any>(null);
  const [mainDriverInfo, setMainDriverInfo] = useState<any>(null);
  const [passengerResults, setPassengerResults] = useState<any[]>([]);
  const [adjacentPassengerResults, setAdjacentPassengerResults] = useState<{ anterior: any[], posterior: any[] }>({ anterior: [], posterior: [] });
  const [restingDriversResults, setRestingDriversResults] = useState<any[]>([]);
  const [extensibleDriversResults, setExtensibleDriversResults] = useState<any[]>([]);
  const [reserveExtensionResults, setReserveExtensionResults] = useState<any[]>([]);
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  const [maquinistaQuery, setMaquinistaQuery] = useState('');
  const [allAssignments, setAllAssignments] = useState<DailyAssignment[]>([]);
  const [phonebook, setPhonebook] = useState<Record<string, string[]>>({});
  const [disDesFilter, setDisDesFilter] = useState<DisDesFilterType>('DIS');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [loadingMaquinistes, setLoadingMaquinistes] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const serveiTypes = ['0', '100', '400', '500'];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setNowMin(getFgcMinutes(timeStr));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (organizeType === OrganizeType.Maquinista) {
      fetchMaquinistes();
    }
  }, [organizeType]);

  const fetchMaquinistes = async () => {
    setLoadingMaquinistes(true);
    try {
      const [assigRes, phoneRes] = await Promise.all([
        supabase.from('daily_assignments').select('*').order('cognoms', { ascending: true }),
        supabase.from('phonebook').select('nomina, phones')
      ]);

      if (assigRes.data) setAllAssignments(assigRes.data);
      if (phoneRes.data) {
        const phoneMap: Record<string, string[]> = {};
        phoneRes.data.forEach((p: any) => {
          phoneMap[p.nomina] = p.phones;
        });
        setPhonebook(phoneMap);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMaquinistes(false);
    }
  };

  useEffect(() => {
    if (organizeType === OrganizeType.CirculacioDescoberta) {
      setMainDriverInfo(null);
      setSearchedCircData(null);
      setPassengerResults([]);
      setAdjacentPassengerResults({ anterior: [], posterior: [] });
      setRestingDriversResults([]);
      setExtensibleDriversResults([]);
      setReserveExtensionResults([]);
      if (coverageQuery) handleSearchCoverage();
    }
  }, [selectedServei, organizeType]);

  function getFgcMinutes(timeStr: string) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    let total = h * 60 + m;
    if (h < 4) total += 24 * 60;
    return total;
  }

  function formatFgcTime(totalMinutes: number) {
    let mins = totalMinutes;
    if (mins >= 24 * 60) mins -= 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  const isReserveActive = (res: any, timeMin: number) => {
    const start = getFgcMinutes(res.start);
    const end = getFgcMinutes(res.end);
    if (start > end) {
      return timeMin >= start || timeMin < end;
    }
    return timeMin >= start && timeMin < end;
  };

  const getStatusColor = (codi: string) => {
    const c = (codi || '').toUpperCase().trim();
    if (c === 'PC') return 'bg-blue-400';
    if (c === 'SR') return 'bg-purple-600';
    if (c === 'RE') return 'bg-purple-300';
    if (c === 'RB') return 'bg-pink-500';
    if (c === 'NA') return 'bg-orange-500';
    if (c === 'PN') return 'bg-[#00B140]';
    if (c === 'TB') return 'bg-[#a67c52]';
    return 'bg-gray-200 dark:bg-gray-700';
  };

  const getShortTornId = (id: string) => {
    const trimmed = id.trim();
    if (trimmed.startsWith('Q') && !trimmed.startsWith('QR') && trimmed.length === 5) return trimmed[0] + trimmed.slice(2);
    return trimmed;
  };

  const fetchFullTurnData = async (turnId: string) => {
    const results = await fetchFullTurns([turnId], selectedServei === '0' ? undefined : selectedServei);
    return results[0] || null;
  };

  const handleCompare = async () => {
    if (!turn1Id || !turn2Id) return;
    setLoadingComparator(true);
    try {
      const [d1, d2] = await Promise.all([fetchFullTurnData(turn1Id), fetchFullTurnData(turn2Id)]);
      setTurn1Data(d1); setTurn2Data(d2);
    } catch (e) { console.error(e); } finally { setLoadingComparator(false); }
  };

  const handleSearchCoverage = async () => {
    if (!coverageQuery) return;
    setLoadingCoverage(true);
    setMainDriverInfo(null); setSearchedCircData(null); setPassengerResults([]); setAdjacentPassengerResults({ anterior: [], posterior: [] }); setRestingDriversResults([]); setExtensibleDriversResults([]); setReserveExtensionResults([]);

    try {
      const { data: searchedCirc } = await supabase.from('circulations').select('*').eq('id', coverageQuery.toUpperCase()).single();
      if (searchedCirc) setSearchedCircData(searchedCirc);

      const { data: allShifts } = await supabase.from('shifts').select('*').eq('servei', selectedServei);
      if (!allShifts) return;

      let mainDriverShiftId = null;
      const passengerShiftIds: string[] = [];
      allShifts.forEach(shift => {
        const circs = (shift.circulations as any[]) || [];
        circs.forEach(c => {
          const codi = typeof c === 'string' ? c : c.codi;
          if (codi.toUpperCase() === coverageQuery.toUpperCase()) mainDriverShiftId = shift.id;
          else if (codi === 'Viatger' && c.observacions && c.observacions.split('-')[0].toUpperCase() === coverageQuery.toUpperCase()) passengerShiftIds.push(shift.id);
        });
      });

      if (mainDriverShiftId || passengerShiftIds.length > 0) {
        const turnIdsToFetch = Array.from(new Set([
          ...(mainDriverShiftId ? [mainDriverShiftId] : []),
          ...passengerShiftIds
        ]));
        const enrichedTurns = await fetchFullTurns(turnIdsToFetch, selectedServei === '0' ? undefined : selectedServei);

        if (mainDriverShiftId) {
          setMainDriverInfo(enrichedTurns.find(t => t.id === mainDriverShiftId));
        }
        setPassengerResults(enrichedTurns.filter(t => passengerShiftIds.includes(t.id)));
      }

      if (searchedCirc) {
        const { data: relatedCircs } = await supabase.from('circulations').select('id, sortida, linia, final').eq('linia', searchedCirc.linia).eq('final', searchedCirc.final);
        if (relatedCircs && relatedCircs.length > 1) {
          const sorted = relatedCircs.sort((a, b) => getFgcMinutes(a.sortida) - getFgcMinutes(b.sortida));
          const currentIndex = sorted.findIndex(c => c.id === searchedCirc.id);
          const anteriorId = currentIndex > 0 ? sorted[currentIndex - 1].id : null;
          const posteriorId = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1].id : null;
          const anteriorShifts: string[] = []; const posteriorShifts: string[] = [];
          allShifts.forEach(shift => {
            const circs = (shift.circulations as any[]) || [];
            circs.forEach(c => {
              if (c.codi === 'Viatger' && c.observacions) {
                const obsCode = c.observacions.split('-')[0].toUpperCase();
                if (anteriorId && obsCode === anteriorId) anteriorShifts.push(shift.id);
                if (posteriorId && obsCode === posteriorId) posteriorShifts.push(shift.id);
              }
            });
          });
          const [enrichedAnterior, enrichedPosterior] = await Promise.all([
            fetchFullTurns(anteriorShifts, selectedServei === '0' ? undefined : selectedServei),
            fetchFullTurns(posteriorShifts, selectedServei === '0' ? undefined : selectedServei)
          ]);
          setAdjacentPassengerResults({ anterior: enrichedAnterior.map(t => ({ ...t, adjacentCode: anteriorId })), posterior: enrichedPosterior.map(t => ({ ...t, adjacentCode: posteriorId })) });
        }

        const depOrigen = searchedCirc.inici;
        const sortidaMin = getFgcMinutes(searchedCirc.sortida);
        const arribadaMin = getFgcMinutes(searchedCirc.arribada);
        const enrichedAll = await fetchFullTurns(allShifts.map(s => s.id), selectedServei === '0' ? undefined : selectedServei);

        const restingResults: any[] = [];
        const extensibleResults: any[] = [];
        const reserveResults: any[] = [];

        enrichedAll.forEach(tData => {
          if (!tData) return;
          const segs = getSegments(tData);
          const [h, m] = (tData.duracio || "00:00").split(':').map(Number);
          const originalDurationMin = h * 60 + m;
          const maxExtensionCapacityMin = 525 - originalDurationMin;

          const currentRestSeg = segs.find(seg => seg.type === 'gap' && seg.codi.toUpperCase() === depOrigen.toUpperCase() && seg.start <= sortidaMin && seg.end > sortidaMin);
          if (currentRestSeg) restingResults.push({ ...tData, restSegment: currentRestSeg });

          if (maxExtensionCapacityMin > 0) {
            const isAtOriginAtDeparture = segs.find(seg => seg.type === 'gap' && seg.codi.toUpperCase() === depOrigen.toUpperCase() && seg.start <= sortidaMin && seg.end > sortidaMin);
            if (isAtOriginAtDeparture) {
              const hasConflictsTotal = segs.some(seg => seg.type === 'circ' && seg.start >= sortidaMin && seg.start < (arribadaMin + (arribadaMin - sortidaMin) + 10));
              if (!hasConflictsTotal) {
                const shiftFinalMin = getFgcMinutes(tData.final_torn);
                const extraNeededTotal = Math.max(0, (arribadaMin + (arribadaMin - sortidaMin) + 10) - shiftFinalMin);
                if (extraNeededTotal <= maxExtensionCapacityMin) {
                  extensibleResults.push({ ...tData, extData: { extraNeeded: extraNeededTotal, originalDuration: originalDurationMin, estimatedReturn: (arribadaMin + (arribadaMin - sortidaMin) + 10) } });
                }
              }

              const itinerary = [
                { nom: searchedCirc.inici, hora: searchedCirc.sortida },
                ...(searchedCirc.estacions || []),
                { nom: searchedCirc.final, hora: searchedCirc.arribada }
              ];

              let bestIntercept = null;
              for (const point of itinerary) {
                const pointMin = getFgcMinutes(point.hora || point.arribada || point.sortida);
                const pointName = (point.nom || '').toUpperCase();

                const reserve = RESERVAS_DATA.find(r => pointName.includes(r.loc) && isReserveActive(r, pointMin));

                if (reserve) {
                  const returnToOriginTimeMin = pointMin + 25;
                  const hasConflictsPartial = segs.some(seg => seg.type === 'circ' && seg.start >= sortidaMin && seg.start < returnToOriginTimeMin);

                  if (!hasConflictsPartial) {
                    const shiftFinalMin = getFgcMinutes(tData.final_torn);
                    const extraNeededPartial = Math.max(0, returnToOriginTimeMin - shiftFinalMin);

                    if (extraNeededPartial <= maxExtensionCapacityMin) {
                      if (!bestIntercept || pointMin < bestIntercept.time) {
                        bestIntercept = { time: pointMin, name: pointName, reservaId: reserve.id, extraNeeded: extraNeededPartial };
                      }
                    }
                  }
                }
              }

              if (bestIntercept) {
                reserveResults.push({ ...tData, resData: { ...bestIntercept, originalDuration: originalDurationMin, interceptTime: formatFgcTime(bestIntercept.time) } });
              }
            }
          }
        });

        setRestingDriversResults(restingResults.sort((a, b) => (b.restSegment.end - b.restSegment.start) - (a.restSegment.end - a.restSegment.start)));
        setExtensibleDriversResults(extensibleResults.sort((a, b) => a.extData.extraNeeded - b.extData.extraNeeded));
        setReserveExtensionResults(reserveResults.sort((a, b) => a.resData.extraNeeded - b.resData.extraNeeded));
      }
    } catch (e) { console.error(e); } finally { setLoadingCoverage(false); }
  };

  const getSegments = (turn: any) => {
    if (!turn) return [];
    const startMin = getFgcMinutes(turn.inici_torn);
    const endMin = getFgcMinutes(turn.final_torn);
    const segments: any[] = [];
    let currentPos = startMin;
    const circs = turn.fullCirculations || [];
    circs.forEach((circ: any, index: number) => {
      const cStart = getFgcMinutes(circ.sortida);
      const cEnd = getFgcMinutes(circ.arribada);
      if (cStart > currentPos) {
        let locationCode = index === 0 ? (circ.machinistInici || turn.dependencia || '') : (circs[index - 1].machinistFinal || '');
        segments.push({ start: currentPos, end: cStart, type: 'gap', codi: (locationCode || '').trim().toUpperCase() || 'DESCANS' });
      }
      segments.push({ start: cStart, end: cEnd, type: 'circ', codi: circ.codi, train: circ.train });
      currentPos = Math.max(currentPos, cEnd);
    });
    if (currentPos < endMin) {
      const lastLoc = circs.length > 0 ? circs[circs.length - 1].machinistFinal : turn.dependencia;
      segments.push({ start: currentPos, end: endMin, type: 'gap', codi: (lastLoc || '').trim().toUpperCase() || 'FINAL' });
    }
    return segments;
  };

  const calculateCoincidences = (t1: any, t2: any) => {
    if (!t1 || !t2) return [];
    const segs1 = getSegments(t1).filter(s => s.type === 'gap');
    const segs2 = getSegments(t2).filter(s => s.type === 'gap');
    const coincidences: any[] = [];
    segs1.forEach(s1 => {
      segs2.forEach(s2 => {
        const c1 = s1.codi.toUpperCase(); const c2 = s2.codi.toUpperCase();
        if (c1 === c2 && c1 !== 'DESCANS' && c1 !== 'FINAL' && c1 !== '') {
          const overlapStart = Math.max(s1.start, s2.start); const overlapEnd = Math.min(s1.end, s2.end);
          if (overlapStart < overlapEnd) {
            if (!coincidences.some(c => c.codi === c1 && c.start === overlapStart && c.end === overlapEnd)) {
              coincidences.push({ codi: c1, start: overlapStart, end: overlapEnd, duration: overlapEnd - overlapStart, driver1: t1.drivers[0].nom, driver2: t2.drivers[0].nom, turn1: t1.id, turn2: t2.id });
            }
          }
        }
      });
    });
    return coincidences.sort((a, b) => a.start - b.start);
  };

  const SimpleTimeline = ({ segments, label, colorMode = 'normal', turnId = '', globalMin, globalMax, nowMin }: { segments: any[], label: string, colorMode?: 'normal' | 'coincidence', turnId?: string, globalMin: number, globalMax: number, nowMin?: number }) => {
    if (segments.length === 0 && colorMode !== 'coincidence') return null;
    const total = globalMax - globalMin; if (total <= 0) return null;

    // Calculate position of "Now" line
    let nowLeft = null;
    if (nowMin !== undefined && nowMin >= globalMin && nowMin <= globalMax) {
      nowLeft = ((nowMin - globalMin) / total) * 100;
    }

    return (
      <div className="space-y-3 relative z-10 w-full">
        <div className="flex justify-between items-center px-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</span>
            {turnId && <span className="bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase whitespace-nowrap">Torn {turnId}</span>}
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
            <Clock size={12} />
            <span className="text-[10px] font-medium font-mono">{formatFgcTime(globalMin)} — {formatFgcTime(globalMax)}</span>
          </div>
        </div>
        <div className="h-14 bg-gray-100/50 dark:bg-black/40 rounded-[20px] p-1.5 relative border border-gray-200 dark:border-white/5 shadow-inner transition-colors overflow-hidden">
          {/* Striped Background for Gap/Rest */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 50%, #000 50%, #000 75%, transparent 75%, transparent)', backgroundSize: '16px 16px' }}></div>

          {/* Now Line */}
          {nowLeft !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500/50 z-20 pointer-events-none"
              style={{ left: `${nowLeft}%` }}
            >
              <div className="absolute top-0 -translate-x-1/2 bg-red-500 text-white text-[8px] font-bold px-1 rounded-b-sm shadow-sm">ARA</div>
            </div>
          )}

          {segments.map((seg, i) => {
            const left = ((seg.start - globalMin) / total) * 100; const width = ((seg.end - seg.start) / total) * 100;
            return (
              <div key={i} style={{ left: `${left}%`, width: `${width}%` }} className={`absolute top-1.5 bottom-1.5 rounded-xl flex items-center justify-center transition-all group cursor-pointer z-10 ${colorMode === 'coincidence' ? 'bg-fgc-green border-2 border-white/40 shadow-sm hover:brightness-105' : seg.type === 'circ' ? 'bg-gray-300 dark:bg-gray-600' : getStatusColor(seg.codi)}`}>
                {width > 4 && <span className={`text-[9px] font-bold truncate px-1 ${seg.type === 'circ' ? 'text-gray-600 dark:text-gray-200' : 'text-white'}`}>{seg.codi}</span>}
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 text-gray-700 dark:text-white text-[10px] font-medium py-2 px-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 whitespace-nowrap z-[100] pointer-events-none shadow-xl border border-gray-100 dark:border-white/10">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 uppercase text-[8px] tracking-widest font-bold">{seg.type === 'gap' || colorMode === 'coincidence' ? 'ESTADA' : 'CIRCULACIÓ'}</span>
                    <span className="text-base font-bold">{seg.codi}</span>
                    <span className="opacity-60 font-mono">{formatFgcTime(seg.start)} — {formatFgcTime(seg.end)} ({seg.end - seg.start} min)</span>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-white dark:border-t-gray-800" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const gr = (turn1Data && turn2Data) ? { min: Math.min(getFgcMinutes(turn1Data.inici_torn), getFgcMinutes(turn2Data.inici_torn)), max: Math.max(getFgcMinutes(turn1Data.final_torn), getFgcMinutes(turn2Data.final_torn)) } : { min: 0, max: 0 };
  const coincidences = calculateCoincidences(turn1Data, turn2Data);

  const filteredMaquinistes = allAssignments.filter(maquinista => {
    const searchStr = maquinistaQuery.toLowerCase();
    const queryMatch = (maquinista.nom || '').toLowerCase().includes(searchStr) ||
      (maquinista.cognoms || '').toLowerCase().includes(searchStr) ||
      maquinista.empleat_id.includes(searchStr);

    if (!queryMatch) return false;
    if (disDesFilter === 'ALL') return true;
    if (disDesFilter === 'DIS') return maquinista.torn.startsWith('DIS');
    if (disDesFilter === 'DES') return maquinista.torn.startsWith('DES');
    if (disDesFilter === 'DIS_DES') return maquinista.torn.startsWith('DIS') || maquinista.torn.startsWith('DES');
    if (disDesFilter === 'FOR') return maquinista.torn.startsWith('FOR');
    if (disDesFilter === 'VAC') return maquinista.torn.startsWith('VAC');
    if (disDesFilter === 'DAG') return maquinista.torn.startsWith('DAG');

    return true;
  });

  const filterLabels: Record<DisDesFilterType, string> = {
    ALL: 'Tots',
    DIS: 'DIS',
    DES: 'DES',
    DIS_DES: 'DIS + DES',
    FOR: 'FOR',
    VAC: 'VAC',
    DAG: 'DAG'
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Organització i Circulació Descoberta</h1><p className="text-gray-500 dark:text-gray-400 font-medium">Anàlisi comparativa i gestió de "Viatgers".</p></div>
        {/* Segmented Control Navigation */}
        <div className="relative flex bg-gray-100/50 dark:bg-gray-800/50 p-1.5 rounded-2xl shadow-inner md:w-auto w-full">
          <div className="absolute top-1.5 bottom-1.5 transition-all duration-300 ease-out bg-white dark:bg-gray-700 shadow-md rounded-xl"
            style={{
              left: organizeType === OrganizeType.Comparador ? '0.375rem' : organizeType === OrganizeType.CirculacioDescoberta ? '33.3333%' : '66.6666%',
              width: 'calc(33.3333% - 0.5rem)',
              transform: organizeType === OrganizeType.CirculacioDescoberta ? 'translateX(0.125rem)' : organizeType === OrganizeType.Maquinista ? 'translateX(0.25rem)' : 'translateX(0)'
            }}
          />
          <button onClick={() => setOrganizeType(OrganizeType.Comparador)} className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all z-10 ${organizeType === OrganizeType.Comparador ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}><Columns size={16} /><span className="truncate">Comparador</span></button>
          <button onClick={() => setOrganizeType(OrganizeType.CirculacioDescoberta)} className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all z-10 ${organizeType === OrganizeType.CirculacioDescoberta ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}><ShieldAlert size={16} /><span className="truncate">Circulació descoberta</span></button>
          <button onClick={() => setOrganizeType(OrganizeType.Maquinista)} className={`relative flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all z-10 ${organizeType === OrganizeType.Maquinista ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}><User size={16} /><span className="truncate">Maquinistes</span></button>
        </div>
      </header>

      {organizeType === OrganizeType.Comparador ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-center"><div className="inline-flex bg-white dark:bg-gray-900 p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 transition-colors">{serveiTypes.map(s => (<button key={s} onClick={() => { setSelectedServei(s); setTurn1Data(null); setTurn2Data(null); setTurn1Id(''); setTurn2Id(''); }} className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${selectedServei === s ? 'bg-fgc-grey dark:bg-fgc-green dark:text-fgc-grey text-white shadow-lg' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'}`}>S-{s}</button>))}</div></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CompareInputSlot label="Primer Torn" value={turn1Id} onChange={setTurn1Id} data={turn1Data} nowMin={nowMin} getSegments={getSegments} onClear={() => { setTurn1Id(''); setTurn1Data(null); }} activeService={selectedServei} />
            <CompareInputSlot label="Segon Torn" value={turn2Id} onChange={setTurn2Id} data={turn2Data} nowMin={nowMin} getSegments={getSegments} onClear={() => { setTurn2Id(''); setTurn2Data(null); }} activeService={selectedServei} />
          </div>
          <div className="flex justify-center"><button onClick={handleCompare} disabled={!turn1Id || !turn2Id || loadingComparator} className="bg-fgc-green text-fgc-grey px-12 py-5 rounded-[28px] font-black text-lg shadow-xl shadow-fgc-green/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:scale-100 group">{loadingComparator ? <Loader2 className="animate-spin" size={24} /> : <RefreshCcw size={24} />}ANALITZAR COINCIDÈNCIES</button></div>
          {(turn1Data && turn2Data) && (
            <div className="bg-white dark:bg-gray-900 rounded-[48px] p-8 sm:p-14 border border-gray-100 dark:border-white/5 shadow-sm space-y-16 animate-in zoom-in-95 duration-500 overflow-visible transition-colors">
              <SimpleTimeline label="CRONOGRAMA TORN A" turnId={turn1Data.id} segments={getSegments(turn1Data)} globalMin={gr.min} globalMax={gr.max} nowMin={nowMin} />
              <SimpleTimeline label="CRONOGRAMA TORN B" turnId={turn2Data.id} segments={getSegments(turn2Data)} globalMin={gr.min} globalMax={gr.max} nowMin={nowMin} />
              <div className="pt-10 border-t border-dashed border-gray-100 dark:border-white/10 overflow-visible transition-colors">
                <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-4"><div className="p-3 bg-fgc-green rounded-2xl text-fgc-grey shadow-lg shadow-fgc-green/10"><LayoutGrid size={24} /></div><div><h3 className="text-xl font-black text-fgc-grey dark:text-white tracking-tight">Timeline de Coincidències</h3><p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">Moments en què coincideixen a la mateixa estació</p></div></div><div className="bg-gray-50 dark:bg-black/20 px-5 py-2 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center gap-3 transition-colors"><span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase">Trobades detectades:</span><span className="text-xl font-black text-fgc-green">{coincidences.length}</span></div></div>
                <SimpleTimeline label="Mapa visual de trobades" segments={coincidences} colorMode="coincidence" globalMin={gr.min} globalMax={gr.max} />
                {coincidences.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
                    {coincidences.map((c, i) => (
                      <div key={i} className="bg-white dark:bg-gray-800 rounded-[32px] p-7 border border-gray-100 dark:border-white/5 flex flex-col gap-6 hover:shadow-2xl hover:border-fgc-green/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-fgc-green/5 -mr-8 -mt-8 rounded-full blur-2xl group-hover:bg-fgc-green/10 transition-colors" />
                        <div className="flex items-center justify-between relative z-10"><div className={`px-5 py-2 rounded-2xl font-black text-sm text-white shadow-lg ${getStatusColor(c.codi)}`}>{c.codi}</div><div className="flex items-center gap-2 bg-fgc-green/10 text-fgc-green px-3 py-1.5 rounded-xl font-black text-xs border border-fgc-green/10"><Clock size={14} />{c.duration} min</div></div>
                        <div className="space-y-1 relative z-10"><p className="text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest ml-1">Franja Horària</p><div className="flex items-center gap-3"><span className="text-2xl font-black text-gray-800 dark:text-gray-200">{formatFgcTime(c.start)}</span><ArrowRight className="text-gray-300" size={18} /><span className="text-2xl font-black text-gray-800 dark:text-gray-200">{formatFgcTime(c.end)}</span></div></div>
                        <div className="h-px bg-gray-50 dark:bg-white/5 w-full transition-colors" />
                        <div className="space-y-4 relative z-10">
                          <div className="flex items-center gap-4"><div className="h-10 min-w-[2.5rem] px-2 rounded-xl bg-fgc-grey dark:bg-black text-white flex items-center justify-center font-black text-xs shadow-md">{getShortTornId(c.turn1)}</div><div className="min-w-0"><p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-tighter leading-none">Maquinista A</p><p className="text-sm font-bold text-fgc-grey dark:text-gray-300 truncate">{c.driver1}</p></div></div>
                          <div className="flex items-center gap-4"><div className="h-10 min-w-[2.5rem] px-2 rounded-xl bg-fgc-grey/10 dark:bg-white/5 text-fgc-grey dark:text-gray-400 flex items-center justify-center font-black text-xs border border-fgc-grey/20 dark:border-white/10 transition-colors">{getShortTornId(c.turn2)}</div><div className="min-w-0"><p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-tighter leading-none">Maquinista B</p><p className="text-sm font-bold text-fgc-grey dark:text-gray-300 truncate">{c.driver2}</p></div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50/50 dark:bg-black/20 rounded-[40px] p-20 text-center border-2 border-dashed border-gray-100 dark:border-white/5 mt-6 transition-colors"><div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm"><Coffee className="text-gray-300 dark:text-gray-600" size={32} /></div><p className="text-gray-400 dark:text-gray-500 font-black uppercase tracking-[0.2em] text-sm">Cap coincidència detectada</p></div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : organizeType === OrganizeType.CirculacioDescoberta ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white dark:bg-gray-900 rounded-[40px] p-8 sm:p-10 border border-gray-100 dark:border-white/5 shadow-sm space-y-8 transition-colors">
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="text-center space-y-1"><h2 className="text-2xl font-black text-fgc-grey dark:text-white uppercase tracking-tight">Consulta de Circulació</h2><p className="text-xs font-medium text-gray-400 dark:text-gray-500">Personal assignat a la circulació en temps real.</p></div>
              <div className="flex justify-center gap-2"><div className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 p-1 rounded-xl border border-gray-100 dark:border-white/5 transition-colors">{serveiTypes.map(s => (<button key={s} onClick={() => setSelectedServei(s)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedServei === s ? 'bg-fgc-grey dark:bg-fgc-green dark:text-fgc-grey text-white shadow-md' : 'text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-white/5'}`}>S-{s}</button>))}</div></div>
              <div className="relative"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} /><input type="text" placeholder="Número de circulació (Ex: 1102)..." value={coverageQuery} onChange={(e) => setCoverageQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchCoverage()} className="w-full bg-gray-50 dark:bg-black/20 border-none rounded-[24px] py-4 pl-14 pr-8 focus:ring-4 focus:ring-fgc-green/20 outline-none font-black text-lg transition-all placeholder:text-gray-300 dark:text-white dark:placeholder:text-gray-600 shadow-inner" /><button onClick={handleSearchCoverage} disabled={!coverageQuery || loadingCoverage} className="absolute right-3 top-1/2 -translate-y-1/2 bg-fgc-green text-fgc-grey px-6 py-2 rounded-xl font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-md disabled:opacity-50">{loadingCoverage ? <Loader2 className="animate-spin" size={16} /> : 'CERCAR'}</button></div>
            </div>

            <div className="pt-6 border-t border-dashed border-gray-100 dark:border-white/10 transition-colors">
              {loadingCoverage ? (<div className="py-20 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-fgc-green" size={40} /><p className="font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-[10px]">Actualitzant dades...</p></div>) : (mainDriverInfo || passengerResults.length > 0 || adjacentPassengerResults.anterior.length > 0 || adjacentPassengerResults.posterior.length > 0 || restingDriversResults.length > 0 || extensibleDriversResults.length > 0 || reserveExtensionResults.length > 0) ? (
                <div className="relative pl-0 sm:pl-4 transition-all">
                  {/* Vertical Connection Line */}
                  <div className="absolute left-[19px] sm:left-[35px] top-6 bottom-6 w-0.5 bg-gray-100 dark:bg-white/5 -z-10 hidden sm:block" />

                  {/* ANTERIOR */}
                  {(adjacentPassengerResults.anterior.length > 0) && (
                    <div className="mb-10 relative sm:pl-12 pl-0 animate-in slide-in-from-left-4 duration-500">
                      <div className="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 border-4 border-white dark:border-gray-900 hidden sm:block" />
                      <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Rewind size={14} /> Circulació Anterior</h3>
                      <div className="flex flex-col gap-3 opacity-75 hover:opacity-100 transition-opacity">
                        {adjacentPassengerResults.anterior.map((torn, idx) => (
                          <CompactViatgerRow key={`ant-${idx}`} torn={torn} viatgerCirc={torn.fullCirculations?.find((c: any) => c.codi === 'Viatger')} colorClass="border-l-purple-300" label={<span className="text-purple-400 font-bold uppercase text-[9px]">Anterior</span>} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CURRENT (TITULAR + VIATGERS) */}
                  <div className="mb-10 relative sm:pl-12 pl-0">
                    <div className="absolute left-0 top-8 -translate-x-1/2 w-6 h-6 rounded-full bg-fgc-green border-4 border-white dark:border-gray-900 shadow-md hidden sm:block z-10" />
                    <div className="absolute left-0 top-8 -translate-x-1/2 w-6 h-6 rounded-full bg-fgc-green animate-ping opacity-20 hidden sm:block" />

                    <h3 className="text-[10px] font-black text-fgc-green uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-fgc-green animate-pulse" /> Circulació Actual {coverageQuery && <span className="text-gray-300 dark:text-gray-600">— {coverageQuery}</span>}</h3>

                    <div className="space-y-6">
                      {/* MAQUINISTA TITULAR HERO CARD */}
                      {mainDriverInfo && (
                        <div className="bg-white dark:bg-gray-800 rounded-[32px] p-1 bg-gradient-to-br from-fgc-green/40 to-transparent shadow-xl relative overflow-hidden group animate-in zoom-in-95 duration-500">
                          <div className="bg-white dark:bg-gray-900 rounded-[30px] p-6 relative overflow-hidden h-full">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity rotate-12 origin-center scale-150"><Train size={120} /></div>

                            <div className="flex flex-col md:flex-row gap-6 relative z-10">
                              <div className="flex flex-col items-center gap-3 shrink-0">
                                <div className="w-20 h-20 rounded-2xl bg-fgc-grey dark:bg-white text-white dark:text-fgc-grey flex items-center justify-center font-black text-3xl shadow-lg border-4 border-white dark:border-gray-800">
                                  {mainDriverInfo.drivers[0]?.cognoms?.charAt(0) || mainDriverInfo.drivers[0]?.nom?.charAt(0)}
                                </div>
                                <span className="px-3 py-1 bg-gray-100 dark:bg-white/10 rounded-full text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider shadow-sm">Titular</span>
                              </div>

                              <div className="flex-1 min-w-0 space-y-5">
                                <div>
                                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white leading-none truncate tracking-tight">{mainDriverInfo.drivers[0]?.cognoms}, {mainDriverInfo.drivers[0]?.nom}</h2>
                                  <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                                      <Hash size={12} className="text-gray-400" />
                                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Nom. {mainDriverInfo.drivers[0]?.nomina}</span>
                                    </div>
                                    {mainDriverInfo.drivers[0]?.tipus_torn && (
                                      <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border shrink-0 ${mainDriverInfo.drivers[0].tipus_torn === 'Reducció' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                        {mainDriverInfo.drivers[0].tipus_torn}
                                      </span>
                                    )}
                                    <a href={`tel:${mainDriverInfo.drivers[0]?.phones?.[0]}`} className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-fgc-grey dark:bg-white text-white dark:text-fgc-grey font-black text-xs hover:scale-105 active:scale-95 shadow-lg shadow-fgc-grey/10 transition-all ml-auto">
                                      <Phone size={12} />
                                      Trucar
                                    </a>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-dashed border-gray-200 dark:border-white/10">
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1"><Clock size={10} /> Torn</p>
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{mainDriverInfo.inici_torn} — {mainDriverInfo.final_torn}</p>
                                  </div>
                                  {searchedCircData && (
                                    <>
                                      <div className="space-y-1">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1"><Train size={10} /> Servei</p>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{searchedCircData.sortida} — {searchedCircData.arribada} {searchedCircData.via_inici && `(V${searchedCircData.via_inici}→V${searchedCircData.via_final})`}</p>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* VIATGERS CURRENT */}
                      {passengerResults.length > 0 && (
                        <div className="space-y-3 pl-2 border-l-2 border-blue-500/20 ml-4 py-2">
                          <p className="text-[10px] font-bold text-blue-500 uppercase ml-2 flex items-center gap-2"><Users size={12} /> Maquinistes de Viatger ({passengerResults.length})</p>
                          <div className="grid gap-2">
                            {passengerResults.map((torn, idx) => (
                              <CompactViatgerRow key={idx} torn={torn} viatgerCirc={torn.fullCirculations?.find((c: any) => c.codi === 'Viatger')} colorClass="border-l-blue-500" />
                            ))}
                          </div>
                        </div>
                      )}
                      {passengerResults.length === 0 && !mainDriverInfo && (
                        <div className="bg-gray-50/50 dark:bg-black/20 rounded-2xl p-6 text-center border border-dashed border-gray-200 dark:border-white/10 transition-colors"><p className="text-gray-400 dark:text-gray-600 font-bold italic text-xs">Cap maquinista principal o viatger detectat.</p></div>
                      )}
                    </div>
                  </div>

                  {/* POSTERIOR */}
                  {(adjacentPassengerResults.posterior.length > 0) && (
                    <div className="mb-10 relative sm:pl-12 pl-0 animate-in slide-in-from-left-4 duration-500 delay-100">
                      <div className="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 border-4 border-white dark:border-gray-900 hidden sm:block" />
                      <h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><FastForward size={14} /> Circulació Posterior</h3>
                      <div className="flex flex-col gap-3 opacity-75 hover:opacity-100 transition-opacity">
                        {adjacentPassengerResults.posterior.map((torn, idx) => (
                          <CompactViatgerRow key={`post-${idx}`} torn={torn} viatgerCirc={torn.fullCirculations?.find((c: any) => c.codi === 'Viatger')} colorClass="border-l-purple-400" label={<span className="text-purple-400 font-bold uppercase text-[9px]">Posterior</span>} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OTHER RESOURCES SECTION */}
                  {(restingDriversResults.length > 0 || extensibleDriversResults.length > 0 || reserveExtensionResults.length > 0) && (
                    <div className="mt-12 pt-8 border-t border-dashed border-gray-200 dark:border-white/10">
                      <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2"><LayoutGrid size={16} /> Altres Recursos Disponibles</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Resting */}
                        {restingDriversResults.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 px-2"><Coffee className="text-fgc-green" size={16} /><h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">En descans ({restingDriversResults.length})</h3></div>
                            <div className="flex flex-col gap-2">
                              {restingDriversResults.map((torn, idx) => (<div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all flex items-center gap-4 border-l-[3px] border-l-fgc-green group">
                                <div className="h-10 min-w-[2.5rem] px-2 bg-fgc-green/10 text-fgc-green rounded-xl flex items-center justify-center font-black text-xs shadow-sm shrink-0 whitespace-nowrap">{torn.id}</div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{torn.drivers[0]?.cognoms}, {torn.drivers[0]?.nom}</p>
                                  <div className="flex items-center gap-2 mt-1"><span className="text-[9px] font-black text-gray-400 uppercase">fins {formatFgcTime(torn.restSegment.end)}</span><span className="text-[9px] font-black text-fgc-green bg-fgc-green/10 px-1.5 py-0.5 rounded">{torn.restSegment.end - torn.restSegment.start} min</span></div>
                                </div>
                                <a href={`tel:${torn.drivers[0]?.phones?.[0]}`} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:bg-fgc-green hover:text-white transition-colors"><Phone size={14} /></a>
                              </div>))}
                            </div>
                          </div>
                        )}

                        {/* Extensible & Reserves */}
                        {(extensibleDriversResults.length > 0 || reserveExtensionResults.length > 0) && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 px-2"><Timer className="text-orange-500" size={16} /><h3 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">Possibilitat de Perllongar</h3></div>
                            <div className="flex flex-col gap-2">
                              {extensibleDriversResults.map((torn, idx) => (<div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all flex items-center gap-4 border-l-[3px] border-l-orange-500 group">
                                <div className="h-10 min-w-[2.5rem] px-2 bg-orange-50 dark:bg-orange-500/10 text-orange-600 rounded-xl flex items-center justify-center font-black text-xs shadow-sm shrink-0 whitespace-nowrap">{torn.id}</div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{torn.drivers[0]?.cognoms}</p>
                                  <p className="text-[9px] text-gray-400 font-bold mt-0.5">Marge: {Math.floor((525 - (torn.extData.originalDuration + torn.extData.extraNeeded)))} min</p>
                                </div>
                                <a href={`tel:${torn.drivers[0]?.phones?.[0]}`} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:bg-orange-500 hover:text-white transition-colors"><Phone size={14} /></a>
                              </div>))}
                              {reserveExtensionResults.map((torn, idx) => (<div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all flex items-center gap-4 border-l-[3px] border-l-indigo-500 group">
                                <div className="h-10 min-w-[2.5rem] px-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs shadow-sm shrink-0 whitespace-nowrap">{torn.id}</div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{torn.drivers[0]?.cognoms} (Res)</p>
                                  <p className="text-[9px] text-indigo-400 font-bold mt-0.5">Intercept: {torn.resData.name}</p>
                                </div>
                                <a href={`tel:${torn.drivers[0]?.phones?.[0]}`} className="w-8 h-8 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 hover:bg-indigo-500 hover:text-white transition-colors"><Phone size={14} /></a>
                              </div>))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : coverageQuery ? (<div className="py-20 text-center space-y-4 opacity-40 transition-colors"><div className="w-16 h-16 bg-gray-100 dark:bg-black/20 rounded-full flex items-center justify-center mx-auto text-gray-300 dark:text-gray-700"><Info size={28} /></div><p className="font-black text-fgc-grey dark:text-gray-400 uppercase tracking-[0.2em] text-[10px]">Cap dada per a {coverageQuery}</p></div>) : (<div className="py-20 text-center space-y-4 transition-colors"><div className="w-20 h-20 bg-gray-50 dark:bg-black/20 rounded-full flex items-center justify-center mx-auto text-gray-200 dark:text-gray-800"><Train size={40} /></div><p className="text-gray-400 dark:text-gray-500 font-bold max-w-sm mx-auto leading-relaxed italic text-sm">Cerca una circulació per veure l'assignació completa de personal.</p></div>)}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white dark:bg-gray-900 rounded-[40px] p-6 sm:p-10 border border-gray-100 dark:border-white/5 shadow-sm space-y-8 transition-colors">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                <input
                  type="text"
                  placeholder="Cerca per nom, cognoms o nòmina..."
                  value={maquinistaQuery}
                  onChange={(e) => setMaquinistaQuery(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black/20 border-none rounded-[24px] py-4 pl-14 pr-8 focus:ring-4 focus:ring-fgc-green/20 outline-none font-black text-lg transition-all dark:text-white dark:placeholder:text-gray-600 shadow-inner"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mr-2 flex items-center gap-1"><Filter size={14} /> Filtre:</span>
                {(Object.keys(filterLabels) as DisDesFilterType[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => setDisDesFilter(option)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${disDesFilter === option
                      ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-md'
                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                  >
                    {filterLabels[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-gray-100 dark:border-white/10 transition-colors">
              {loadingMaquinistes ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="animate-spin text-fgc-green" size={40} />
                  <p className="font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest text-[10px]">Recuperant llistat...</p>
                </div>
              ) : filteredMaquinistes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMaquinistes.map((maquinista) => {
                    const phones = phonebook[maquinista.empleat_id] || [];
                    const isDis = maquinista.torn.startsWith('DIS');
                    const isDes = maquinista.torn.startsWith('DES');

                    return (
                      <div
                        key={maquinista.id}
                        className={`bg-white dark:bg-gray-800 rounded-[20px] p-5 border transition-all flex flex-col gap-4 group hover:shadow-lg overflow-hidden relative ${isDis ? 'border-l-[6px] border-l-orange-500 border-gray-100 dark:border-gray-700' :
                          isDes ? 'border-l-[6px] border-l-green-500 border-gray-100 dark:border-gray-700' :
                            'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${isDis ? 'bg-orange-100 text-orange-600' :
                            isDes ? 'bg-green-100 text-green-600' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
                            }`}>
                            {maquinista.cognoms?.charAt(0) || maquinista.nom?.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-gray-800 dark:text-white leading-tight uppercase truncate">{maquinista.cognoms}, {maquinista.nom}</h3>
                              {maquinista.tipus_torn && (
                                <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase border shrink-0 ${maquinista.tipus_torn === 'Reducció'
                                  ? 'bg-purple-600 text-white border-purple-700'
                                  : 'bg-blue-600 text-white border-blue-700'
                                  }`}>
                                  {maquinista.tipus_torn === 'Reducció' ? 'RED' : 'TORN'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">#{maquinista.empleat_id}</span>
                              <div className={`px-2 py-0.5 rounded text-[10px] font-black ${isDis ? 'bg-orange-500 text-white' :
                                isDes ? 'bg-fgc-green text-fgc-grey' :
                                  'bg-gray-100 dark:bg-black text-gray-400 dark:text-gray-600'
                                }`}>
                                {maquinista.torn}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-3 border-t border-gray-100/50 dark:border-white/5 transition-colors">
                          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Clock size={12} className="text-fgc-green" />
                            <span className="text-[11px] font-bold">{maquinista.hora_inici} — {maquinista.hora_fi}</span>
                          </div>
                          {(maquinista.abs_parc_c === 'S' || maquinista.dta === 'S' || maquinista.dpa === 'S') && (
                            <div className="flex gap-2">
                              {maquinista.abs_parc_c === 'S' && <span className="bg-red-50 text-red-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-100">ABS</span>}
                              {maquinista.dta === 'S' && <span className="bg-blue-50 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-100">DTA</span>}
                              {maquinista.dpa === 'S' && <span className="bg-purple-50 text-purple-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-purple-100">DPA</span>}
                            </div>
                          )}
                          {maquinista.observacions && (
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                              <Info size={12} className="text-fgc-green" />
                              <span className="text-[11px] font-bold truncate">{maquinista.observacions}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-auto">
                          {phones.length > 0 ? (
                            phones.map((p, idx) => (
                              <a
                                key={idx}
                                href={`tel:${p}`}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all shadow-sm ${isDis ? 'bg-orange-500 text-white hover:bg-orange-600' :
                                  isDes ? 'bg-fgc-green text-fgc-grey hover:brightness-110' :
                                    'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200'
                                  }`}
                              >
                                <Phone size={12} />
                                {p}
                              </a>
                            ))
                          ) : (
                            <span className="text-[10px] font-bold text-gray-300 dark:text-gray-700 italic">Sense telèfons</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4 opacity-40 transition-colors">
                  <UserCircle size={60} className="mx-auto text-gray-200 dark:text-gray-800" />
                  <p className="font-black text-fgc-grey dark:text-gray-400 uppercase tracking-[0.2em] text-[10px]">No s'ha trobat personal per a la cerca actual</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CompactViatgerRow: React.FC<{ torn: any, viatgerCirc: any, colorClass: string, label?: React.ReactNode }> = ({ torn, viatgerCirc, colorClass, label }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-2xl p-3 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all flex items-center gap-4 border-l-4 ${colorClass}`}>
    <div className="h-10 min-w-[2.5rem] px-2 bg-fgc-grey/10 dark:bg-black text-fgc-grey dark:text-gray-300 rounded-xl flex items-center justify-center font-black text-xs shadow-sm shrink-0 whitespace-nowrap">{torn.id}</div>
    <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-6"><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-black text-fgc-grey dark:text-gray-200 truncate">{torn.drivers[0]?.cognoms}, {torn.drivers[0]?.nom}</p>{label}</div><p className="text-[8px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest whitespace-nowrap">Nom. {torn.drivers[0]?.nomina} {torn.drivers[0]?.tipus_torn ? `(${torn.drivers[0].tipus_torn})` : ''}</p></div><div className="flex items-center gap-3 text-blue-500 shrink-0"><div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/20 px-3 py-1 rounded-lg border border-blue-100/50 dark:border-blue-900/30 transition-colors"><span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 whitespace-nowrap">{viatgerCirc?.machinistInici || '--'}</span><ArrowRight size={10} className="text-blue-300" /><span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 whitespace-nowrap">{viatgerCirc?.machinistFinal || '--'}</span></div><div className="text-[10px] font-bold text-gray-400 dark:text-gray-600 min-w-[70px] whitespace-nowrap">{torn.inici_torn} - {torn.final_torn}</div></div></div>
    <div className="flex gap-1 shrink-0">{torn.drivers[0]?.phones?.map((p: string, i: number) => (<a key={i} href={`tel:${p}`} className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center hover:bg-blue-600 transition-all shadow-sm"><Phone size={12} /></a>))}</div>
  </div>
);

const CompareInputSlot = ({ label, value, onChange, data, onClear, nowMin, getSegments, activeService }: { label: string, value: string, onChange: (v: string) => void, data: any, onClear: () => void, nowMin: number, getSegments: (t: any) => any[], activeService: string }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSug, setShowSug] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setShowSug(false); };
    document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = async (val: string) => {
    onChange(val);
    if (val.length >= 1) {
      const cleanVal = val.toUpperCase().trim();
      const numericPart = cleanVal.replace(/^Q/, '');
      let smartQuery = '';

      // Smart Search Logic: Q + ServicePrefix + 3-digit Number
      if (/^\d+$/.test(numericPart)) {
        const prefix = activeService.charAt(0);
        const padded = numericPart.padStart(3, '0');
        smartQuery = `Q${prefix}${padded}`;
      }

      let query = supabase.from('shifts').select('id').limit(5);

      if (smartQuery) {
        // Search fuzzy OR exact smart match
        query = query.or(`id.ilike.%${cleanVal}%,id.eq.${smartQuery}`);
      } else {
        query = query.ilike('id', `%${cleanVal}%`);
      }

      const { data: s } = await query;

      if (s) {
        // Prioritize Smart Match
        const sorted = s.sort((a, b) => {
          if (a.id === smartQuery) return -1;
          if (b.id === smartQuery) return 1;
          return 0;
        });
        setSuggestions(sorted.map(x => x.id as string));
      }
      setShowSug(true);
    } else {
      setSuggestions([]);
      setShowSug(false);
    }
  };

  const currentActivity = data ? getSegments(data).find(s => nowMin >= s.start && nowMin < s.end) : null;
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-[32px] p-6 sm:p-8 border shadow-sm flex flex-col min-h-[400px] transition-all relative ${data ? 'border-gray-100 dark:border-white/5' : 'border-dashed border-gray-200 dark:border-white/10'}`} ref={containerRef}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em]">{label}</h3>
        {data && (<button onClick={onClear} className="p-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 rounded-full transition-colors bg-red-50/10"><X size={16} /></button>)}
      </div>

      {data ? (<div className="flex-1 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center gap-5 mb-6">
          <div className="h-14 min-w-[3.5rem] px-3 bg-gray-50 dark:bg-white/10 text-gray-800 dark:text-white rounded-2xl flex items-center justify-center font-black text-xl border border-gray-100 dark:border-white/5 whitespace-nowrap">{data.id}</div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-800 dark:text-white leading-tight truncate">{data.drivers[0]?.cognoms}, {data.drivers[0]?.nom}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Actiu {data.drivers[0]?.tipus_torn ? `(${data.drivers[0].tipus_torn})` : ''}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 bg-gray-50 dark:bg-black/20 p-5 rounded-[24px] border border-gray-100 dark:border-white/5 relative overflow-hidden group transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Clock size={64} /></div>
          {currentActivity ? (
            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Activitat Actual</span>
                <span className="text-[9px] font-bold text-red-500 animate-pulse uppercase flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />EN CURS</span>
              </div>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${currentActivity.type === 'circ' ? 'bg-white dark:bg-white/10 text-gray-700 dark:text-white border' : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                  {currentActivity.type === 'circ' ? <Train size={24} /> : <Coffee size={24} />}
                </div>
                <div>
                  <p className="text-xl font-black text-gray-800 dark:text-gray-100">{currentActivity.codi}</p>
                  {currentActivity.train && (<div className="flex items-center gap-1.5 text-xs font-bold text-green-600"><Hash size={12} /> UT: {currentActivity.train}</div>)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-2"><p className="text-sm font-medium text-gray-400 dark:text-gray-600 italic">Sense activitat actual</p></div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-black/20 p-3 rounded-2xl border border-gray-100 dark:border-white/5 transition-colors">
            <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2"><Clock size={10} /> Horari</p>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">{data.inici_torn} — {data.final_torn}</p>
          </div>
          <div className="bg-gray-50 dark:bg-black/20 p-3 rounded-2xl border border-gray-100 dark:border-white/5 transition-colors">
            <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2"><User size={10} /> Nom.</p>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">{data.drivers[0]?.nomina}</p>
          </div>
        </div>
      </div>) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 text-gray-300 dark:text-gray-600 transition-colors">
            <LayoutGrid size={24} />
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-8 max-w-[200px] font-medium leading-relaxed">Selecciona un torn per veure'n l'activitat i comparar.</p>
          <div className="w-full relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 group-focus-within:text-fgc-green transition-colors" size={20} />
            <input type="text" placeholder="Ex: Q002..." value={value} onChange={(e) => handleInputChange(e.target.value.toUpperCase())} onFocus={() => value.length > 0 && setShowSug(true)} className="w-full bg-gray-50 dark:bg-black/30 border border-transparent focus:border-fgc-green/30 rounded-[20px] py-4 pl-14 pr-8 outline-none font-bold text-lg transition-all placeholder:text-gray-300 dark:text-white dark:placeholder:text-gray-700" />
            {showSug && suggestions.length > 0 && (<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-[20px] shadow-2xl border border-gray-100 dark:border-white/10 z-[100] overflow-hidden overflow-y-auto max-h-56 animate-in slide-in-from-top-2 transition-colors">{suggestions.map((s, idx) => (<button key={idx} onClick={() => { onChange(s); setShowSug(false); }} className="w-full text-left px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-fgc-green transition-all border-b border-gray-50 dark:border-white/5 last:border-0 flex items-center justify-between group/item">{s}<ArrowRight className="opacity-0 group-hover/item:opacity-100 transition-all scale-90 -translate-x-2 group-hover/item:translate-x-0" size={14} /></button>))}</div>)}
          </div>
        </div>)}
    </div>
  );
};

const RefreshCcw = ({ size, className }: { size?: number, className?: string }) => (
  <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>
);

export default OrganitzaView;