import React from 'react';
import { AlertCircle, ArrowDownToLine, ArrowUpToLine, ArrowLeftToLine, ArrowRightToLine, Layers, Train, User, Zap, Coffee, X, Phone, Scissors, Users, Clock, CheckCircle2 } from 'lucide-react';
import IncidenciaMapControls from './IncidenciaMapControls';
import ListPersonnelRow from './ListPersonnelRow';
import { MAP_STATIONS, MAP_SEGMENTS } from '../../constants/incidenciaData';
import { GARAGE_PLAN } from '../../constants/garageData';
import { LivePersonnel } from '../../types';

interface IncidenciaMapProps {
    isRealTime: boolean;
    setIsRealTime: (val: boolean) => void;
    customTime: string;
    setCustomTime: (val: string) => void;
    isPaused: boolean;
    setIsPaused: (val: boolean) => void;
    isGeoTrenEnabled: boolean;
    setIsGeoTrenEnabled: (val: boolean) => void;
    fetchLiveMapData: () => void;
    selectedCutStations: Set<string>;
    selectedCutSegments: Set<string>;
    clearAllCuts: () => void;
    toggleTrackCut: (from: string, to: string, track: 1 | 2) => void;
    toggleStationCut: (id: string, isRightClick?: boolean) => void;
    groupedRestPersonnel: Record<string, LivePersonnel[]>;
    liveData: LivePersonnel[];

    // New props for Analysis
    dividedPersonnel: any; // Type is complex, define properly if needed or use any for now
    setAltServiceIsland: (val: string | null) => void;
    islands: any; // Complex type
    selectedRestLocation: string | null;
    setSelectedRestLocation: (val: string | null) => void;
    geoTrenData?: any[];
    garageOccupation?: Record<string, number>;
    impactAnalysis?: { affectedTrains: number, estPassengers: number };
    nearbyReserves?: any[];
    manualOverrides?: Record<string, string>;
    setManualOverrides?: (val: Record<string, string>) => void;
}

const IncidenciaMap: React.FC<IncidenciaMapProps> = ({
    isRealTime, setIsRealTime, customTime, setCustomTime, isPaused, setIsPaused,
    isGeoTrenEnabled, setIsGeoTrenEnabled, fetchLiveMapData,
    selectedCutStations, selectedCutSegments, clearAllCuts,
    toggleTrackCut, toggleStationCut, groupedRestPersonnel, liveData,
    dividedPersonnel, setAltServiceIsland, islands,
    selectedRestLocation, setSelectedRestLocation, geoTrenData = [], garageOccupation = {},
    impactAnalysis = { affectedTrains: 0, estPassengers: 0 }, nearbyReserves = [],
    manualOverrides = {}, setManualOverrides = () => { }
}) => {
    const [selectedTrainId, setSelectedTrainId] = React.useState<string | null>(null);

    // Determine which data to show: Live Simulated vs GeoTren Real
    const showedTrains = isGeoTrenEnabled && geoTrenData.length > 0 ? geoTrenData.map((t: any) => {
        // Resolve location
        let stationNom = t.estacionat_a;
        if (!stationNom && t.properes_parades) {
            // "{\"parada\": \"SQ\"};{\"parada\": \"CF\"}..."
            const match = t.properes_parades.match(/parada":\s*"([^"]+)"/);
            if (match && match[1]) stationNom = match[1];
        }

        // Resolve station ID
        // Use a helper or simple logic if not imported. MAP_STATIONS ids are typically 2 chars.
        // t.estacionat_a is usually "PC", "PR", etc.
        const stId = stationNom ? stationNom.trim().toUpperCase() : null;
        const station = MAP_STATIONS.find(s => s.id === stId || s.label.toUpperCase() === stationNom?.toUpperCase());

        if (!station) return null;

        const isOutbound = t.dir === 'A'; // 'A' = Ascendent (Leaving BCN/PC) -> V1 -> Above (y-4)
        const yOffset = isOutbound ? -4 : 4;

        const realId = t.ut || t.id.split('|').pop() || '?';
        const status = manualOverrides[realId] || 'OK';
        let color = t.lin === 'S1' ? '#f97316' : t.lin === 'S2' ? '#22c55e' : t.lin === 'L6' ? '#9333ea' : t.lin === 'L7' ? '#8B4513' : t.lin === 'L12' ? '#d8b4fe' : '#6b7280';
        let stroke = "white";
        let animateClass = isGeoTrenEnabled ? 'animate-pulse' : '';

        if (status === 'AVERIAT') {
            color = '#000000'; // Black core
            stroke = '#ef4444'; // Red stroke
            animateClass = 'animate-ping'; // Severe pulsing
        } else if (status === 'RETARD') {
            stroke = '#eab308'; // Yellow stroke
            animateClass = 'animate-bounce'; // Bouncing
        }

        return {
            type: 'TRAIN',
            realId: realId,
            id: realId,
            linia: t.lin,
            stationId: station.id,
            color,
            stroke,
            animateClass,
            driver: 'REAL GPS',
            torn: 'GPS',
            x: station.x,
            y: station.y + yOffset,
            label: t.deducedCirculationId || t.tipus_unitat || '?'
        };
    }).filter(Boolean).filter(t => !t!.id.startsWith('EST')) : liveData.filter(p => p.type === 'TRAIN' && !p.id.startsWith('EST')).map(p => {
        const status = manualOverrides[p.id] || 'OK';
        let color = p.color;
        let stroke = "white";

        if (status === 'AVERIAT') {
            color = '#000000';
            stroke = '#ef4444';
        } else if (status === 'RETARD') {
            stroke = '#eab308';
        }
        return { ...p, color, stroke, label: p.id };
    }); // Default label to ID for simulated


    return (
        <div className="bg-white dark:bg-black/40 rounded-none sm:rounded-[24px] p-2 sm:p-4 border-0 sm:border border-gray-100 dark:border-white/5 relative flex flex-col transition-colors shadow-none sm:shadow-sm w-full h-[85vh]">
            <IncidenciaMapControls
                isRealTime={isRealTime}
                setIsRealTime={setIsRealTime}
                customTime={customTime}
                setCustomTime={setCustomTime}
                isPaused={isPaused}
                setIsPaused={setIsPaused}
                isGeoTrenEnabled={isGeoTrenEnabled}
                setIsGeoTrenEnabled={setIsGeoTrenEnabled}
                fetchLiveMapData={fetchLiveMapData}
            />

            {(selectedCutStations.size > 0 || selectedCutSegments.size > 0) && (
                <div className="flex justify-end px-2 mb-2">
                    <button onClick={clearAllCuts} className="text-[10px] font-black text-red-500 uppercase flex items-center gap-2 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 rounded-xl hover:scale-105 transition-all shadow-sm border border-red-100 dark:border-red-900/40 animate-in fade-in zoom-in-95">
                        <Scissors size={14} /> Anul·lar Talls ({selectedCutStations.size + selectedCutSegments.size})
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-hidden flex items-center justify-center bg-gray-50/50 dark:bg-black/20 rounded-2xl mt-2 relative min-h-[500px]">
                <div className="w-full h-full overflow-auto custom-scrollbar p-2 flex items-center justify-center">
                    <svg viewBox="0 0 750 250" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMid meet">
                        {MAP_SEGMENTS.map((seg, i) => {
                            const s1 = MAP_STATIONS.find(s => s.id === (seg as any).from)!;
                            const s2 = MAP_STATIONS.find(s => s.id === (seg as any).to)!;
                            if (!s1 || !s2) return null;

                            const isV1Blocked = selectedCutSegments.has(`${s1.id}-${s2.id}-V1`) || selectedCutSegments.has(`${s2.id}-${s1.id}-V1`);
                            const isV2Blocked = selectedCutSegments.has(`${s1.id}-${s2.id}-V2`) || selectedCutSegments.has(`${s2.id}-${s1.id}-V2`);

                            // Custom Render for PC-PR Schema
                            if (s1.id === 'PC' && s2.id === 'PR') {
                                return (
                                    <g key={`seg-${i}-custom-pc`}>
                                        {/* --- SEGMENT LINES (Clickable for Cuts) --- */}
                                        {/* V2 (Inbound to PC) - Bottom Line in Segment */}
                                        <line
                                            x1={s1.x} y1={s1.y + 4}
                                            x2={s2.x} y2={s2.y + 4}
                                            stroke={isV2Blocked ? "#ef4444" : "#A4A7AB"} strokeWidth="4" strokeLinecap="round"
                                            className={`cursor-pointer transition-all duration-300 ${isV2Blocked ? 'opacity-100' : 'opacity-40 hover:opacity-100 hover:stroke-blue-400'}`}
                                            onClick={() => toggleTrackCut(s1.id, s2.id, 2)}
                                        />
                                        {/* V1 (Outbound from PC) - Top Line in Segment */}
                                        <line
                                            x1={s1.x} y1={s1.y - 4}
                                            x2={s2.x} y2={s2.y - 4}
                                            stroke={isV1Blocked ? "#ef4444" : "#A4A7AB"} strokeWidth="4" strokeLinecap="round"
                                            className={`cursor-pointer transition-all duration-300 ${isV1Blocked ? 'opacity-100' : 'opacity-40 hover:opacity-100 hover:stroke-blue-400'}`}
                                            onClick={() => toggleTrackCut(s1.id, s2.id, 1)}
                                        />

                                        {/* --- PC STATION TRACK STUBS (Visual Only) --- */}
                                        {/* Track 1: Continuation of V2 (Inbound) [y=104 -> y=104] */}
                                        <line x1={s1.x - 40} y1={s1.y + 4} x2={s1.x} y2={s1.y + 4} stroke="#A4A7AB" strokeWidth="4" strokeLinecap="round" className="opacity-40" />
                                        <text x={s1.x - 45} y={s1.y + 6} className="text-[8px] fill-gray-500 font-black font-mono">1</text>

                                        {/* Track 2: Continuation of V1 (Outbound) [y=96 -> y=96] */}
                                        <line x1={s1.x - 40} y1={s1.y - 4} x2={s1.x} y2={s1.y - 4} stroke="#A4A7AB" strokeWidth="4" strokeLinecap="round" className="opacity-40" />
                                        <text x={s1.x - 45} y={s1.y - 2} className="text-[8px] fill-gray-500 font-black font-mono">2</text>

                                        {/* Track 3: Parallel Down [y=112], connects to V2 Inbound point (20, 104) */}
                                        <path d={`M ${s1.x - 40} ${s1.y + 12} L ${s1.x - 10} ${s1.y + 12} L ${s1.x} ${s1.y + 4}`} fill="none" stroke="#A4A7AB" strokeWidth="4" strokeLinecap="round" className="opacity-40" />
                                        <text x={s1.x - 45} y={s1.y + 14} className="text-[8px] fill-gray-500 font-black font-mono">3</text>

                                        {/* Track 4: Parallel Down [y=120], connects to V2 Inbound point (20, 104) */}
                                        <path d={`M ${s1.x - 40} ${s1.y + 20} L ${s1.x - 10} ${s1.y + 20} L ${s1.x} ${s1.y + 4}`} fill="none" stroke="#A4A7AB" strokeWidth="4" strokeLinecap="round" className="opacity-40" />
                                        <text x={s1.x - 45} y={s1.y + 22} className="text-[8px] fill-gray-500 font-black font-mono">4</text>

                                        {/* Track 5: Parallel Down [y=128], connects to V2 Inbound point (20, 104) */}
                                        <path d={`M ${s1.x - 40} ${s1.y + 28} L ${s1.x - 10} ${s1.y + 28} L ${s1.x} ${s1.y + 4}`} fill="none" stroke="#A4A7AB" strokeWidth="4" strokeLinecap="round" className="opacity-40" />
                                        <text x={s1.x - 45} y={s1.y + 30} className="text-[8px] fill-gray-500 font-black font-mono">5</text>
                                    </g>
                                );
                            }

                            const dx = s2.x - s1.x;
                            const dy = s2.y - s1.y;
                            const len = Math.sqrt(dx * dx + dy * dy);
                            const nx = -dy / len;
                            const ny = dx / len;
                            const offset = 4;

                            return (
                                <g key={`seg-${i}`}>
                                    <line
                                        x1={s1.x + nx * offset} y1={s1.y + ny * offset}
                                        x2={s2.x + nx * offset} y2={s2.y + ny * offset}
                                        stroke={isV2Blocked ? "#ef4444" : "#A4A7AB"} strokeWidth="4" strokeLinecap="round"
                                        className={`cursor-pointer transition-all duration-300 ${isV2Blocked ? 'opacity-100' : 'opacity-40 hover:opacity-100 hover:stroke-blue-400'}`}
                                        onClick={() => toggleTrackCut(s1.id, s2.id, 2)}
                                    />
                                    <line
                                        x1={s1.x - nx * offset} y1={s1.y - ny * offset}
                                        x2={s2.x - nx * offset} y2={s2.y - ny * offset}
                                        stroke={isV1Blocked ? "#ef4444" : "#A4A7AB"} strokeWidth="4" strokeLinecap="round"
                                        className={`cursor-pointer transition-all duration-300 ${isV1Blocked ? 'opacity-100' : 'opacity-40 hover:opacity-100 hover:stroke-blue-400'}`}
                                        onClick={() => toggleTrackCut(s1.id, s2.id, 1)}
                                    />
                                </g>
                            );
                        })}

                        {MAP_STATIONS.map(st => {
                            const isCut = selectedCutStations.has(st.id);
                            const restHere = groupedRestPersonnel[st.id] || [];
                            const count = restHere.length;
                            const isUpper = st.y < 100;

                            return (
                                <g key={st.id} className="group">
                                    <rect
                                        x={st.x - 3} y={st.y - 11} width="6" height="22" rx="3"
                                        fill="white" stroke={isCut ? "#ef4444" : "#53565A"} strokeWidth="1.5"
                                        className="transition-all duration-300"
                                    />
                                    {count > 0 && !isCut && (
                                        <g onClick={() => setSelectedRestLocation(selectedRestLocation === st.id ? null : st.id)} className="cursor-pointer transition-colors">
                                            <circle cx={st.x} cy={st.y + (isUpper ? -32 : 44)} r={count > 1 ? 7 : 4} fill={count > 1 ? "#3b82f6" : "#8EDE00"} className="shadow-md" stroke="white" strokeWidth="1.5" />
                                            {count > 1 && (<text x={st.x} y={st.y + (isUpper ? -29.5 : 46.5)} textAnchor="middle" fill="white" className="text-[7px] font-black pointer-events-none">{count}</text>)}
                                        </g>
                                    )}
                                    <text
                                        x={st.x} y={st.y + (isUpper ? -16 : (st.id === 'PC' ? 45 : 28))}
                                        textAnchor="middle"
                                        onClick={() => toggleStationCut(st.id)}
                                        className={`text-[9px] font-black select-none cursor-pointer transition-colors duration-300 hover:underline ${isCut ? 'fill-red-500' : 'fill-gray-400 dark:fill-gray-500 hover:fill-fgc-grey'}`}
                                    >
                                        {st.id}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Garage Occupation Visualization */}
                        {GARAGE_PLAN.map(g => {
                            const station = MAP_STATIONS.find(s => s.id === g.stationId);
                            if (!station) return null;

                            const occupied = garageOccupation[g.stationId] || 0;
                            const capacity = g.capacityDuringService;
                            const percentage = Math.min(100, (occupied / capacity) * 100);
                            const isFull = occupied >= capacity;

                            // Render vertical bar next to station
                            const barHeight = 22; // Same as station rect
                            const barWidth = 4;
                            const xPos = station.x + 8; // Offset to right
                            const yPos = station.y - 11;

                            return (
                                <g key={`garage-${g.stationId}`} className="group/garage pointer-events-none">
                                    {/* Background container */}
                                    <rect x={xPos} y={yPos} width={barWidth} height={barHeight} rx={1} fill="#e5e7eb" stroke="#d1d5db" strokeWidth="0.5" />
                                    {/* Fill based on occupation (inverted - fill from bottom) */}
                                    <rect
                                        x={xPos}
                                        y={yPos + barHeight - (barHeight * (percentage / 100))}
                                        width={barWidth}
                                        height={barHeight * (percentage / 100)}
                                        rx={1}
                                        fill={isFull ? "#ef4444" : "#22c55e"}
                                        className="transition-all duration-500"
                                    />
                                    {/* Tooltip on hover (via group) */}
                                    <g className="opacity-0 group-hover/garage:opacity-100 transition-opacity">
                                        <rect x={xPos + 10} y={yPos} width="50" height="14" rx="4" fill="black" fillOpacity="0.8" />
                                        <text x={xPos + 35} y={yPos + 10} textAnchor="middle" fill="white" className="text-[9px] font-bold">
                                            {occupied} / {capacity}
                                        </text>
                                    </g>
                                </g>
                            );
                        })}

                        {showedTrains.map((t: any) => (
                            <g
                                key={`${t.id}-${t.torn}`}
                                transform={`translate(${t.x}, ${t.y})`}
                                className="transition-transform duration-1000 ease-in-out"
                                style={{ transitionProperty: 'transform' }} // Ensure only transform is transitioned for position
                            >
                                <g
                                    className="cursor-pointer transition-transform duration-200 hover:scale-125"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTrainId(t.realId || t.id);
                                    }}
                                >
                                    {/* Train Dot */}
                                    <circle r="4" fill={t.color} stroke={t.stroke || "white"} strokeWidth={1.5} className={`drop-shadow-md ${t.animateClass || (isGeoTrenEnabled ? 'animate-pulse' : '')}`} />

                                    {/* Label Pill */}
                                    <g transform="translate(0, -14)">
                                        <rect x="-14" y="-7" width="28" height="14" rx="4" fill={t.color} className="drop-shadow-sm opacity-90" />
                                        <text y="3" textAnchor="middle" className="text-[9px] font-black fill-white uppercase" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.3)' }}>{t.label || t.id}</text>
                                    </g>
                                </g>
                            </g>
                        ))}
                    </svg>

                    {/* Train Control Popup */}
                    {selectedTrainId && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 z-[150] animate-in zoom-in fade-in flex flex-col gap-3 min-w-[200px]">
                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-2">
                                <h4 className="font-black text-xs uppercase text-fgc-grey dark:text-white">Tren {selectedTrainId}</h4>
                                <button onClick={() => setSelectedTrainId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <button onClick={() => { setManualOverrides({ ...manualOverrides, [selectedTrainId]: 'AVERIAT' }); setSelectedTrainId(null); }} className="flex items-center gap-2 p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-colors"><AlertCircle size={14} /> AVERIAT</button>
                                <button onClick={() => { setManualOverrides({ ...manualOverrides, [selectedTrainId]: 'RETARD' }); setSelectedTrainId(null); }} className="flex items-center gap-2 p-2 rounded-xl bg-yellow-50 hover:bg-yellow-100 text-yellow-600 text-xs font-bold transition-colors"><Clock size={14} /> RETARD</button>
                                <button onClick={() => { const n = { ...manualOverrides }; delete n[selectedTrainId]; setManualOverrides(n); setSelectedTrainId(null); }} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-bold transition-colors"><CheckCircle2 size={14} /> NORMAL (OK)</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {selectedRestLocation && groupedRestPersonnel[selectedRestLocation] && (
                <div className="absolute top-0 right-0 h-full w-full sm:w-80 bg-white/95 dark:bg-black/90 backdrop-blur-md border-l border-gray-100 dark:border-white/10 z-[100] p-6 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
                    <div className="flex items-center justify-between mb-8 border-b border-gray-100 dark:border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500 rounded-lg text-white"><Coffee size={20} /></div>
                            <div><h4 className="text-sm font-black text-fgc-grey dark:text-white uppercase tracking-tight">Personal en Descans</h4><p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{MAP_STATIONS.find(s => s.id === selectedRestLocation)?.id || selectedRestLocation}</p></div>
                        </div>
                        <button onClick={() => setSelectedRestLocation(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><X size={20} /></button>
                    </div>
                    <div className="space-y-3">
                        {groupedRestPersonnel[selectedRestLocation].map((p, idx) => (
                            <div key={idx} className="bg-white dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2"><span className="bg-fgc-grey dark:bg-black text-white text-[10px] font-black px-2 py-0.5 rounded uppercase">{p.torn}</span>{p.phones && p.phones.length > 0 && (<a href={`tel:${p.phones[0]}`} className="text-blue-500 hover:scale-110 transition-transform"><Phone size={14} /></a>)}</div>
                                    <span className="text-[9px] font-black text-fgc-green uppercase tracking-widest">{p.horaPas}</span>
                                </div>
                                <p className="text-xs font-bold text-fgc-grey dark:text-gray-200 uppercase truncate">{p.driver}</p>
                                {p.phones && p.phones.length > 0 && (<p className="text-[9px] font-bold text-gray-400 mt-1">{p.phones[0]}</p>)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {(selectedCutStations.size > 0 || selectedCutSegments.size > 0) && dividedPersonnel && (
                <div className="mt-6 space-y-8 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-4 border-b-4 border-red-500/20 pb-4">
                        <div className="p-3 bg-red-500 rounded-2xl text-white shadow-lg shadow-red-500/20"><Scissors size={24} /></div>
                        <div>
                            <h4 className="text-[12px] font-black text-red-500 uppercase tracking-[0.2em] leading-none">ANÀLISI DE TALL OPERATIU</h4>
                            <p className="text-xl font-black text-fgc-grey dark:text-white uppercase mt-1">Multi-talls actius: {selectedCutStations.size} estacions, {selectedCutSegments.size} trams</p>
                            {/* Feature 2: Impact Analysis */}
                            <div className="flex items-center gap-4 mt-2 text-xs font-bold text-gray-500">
                                <span className="flex items-center gap-1 text-red-500"><AlertCircle size={12} /> {impactAnalysis.affectedTrains} Tren(s) Afectats</span>
                                <span className="flex items-center gap-1"><Users size={12} /> ~{impactAnalysis.estPassengers} Passatgers</span>
                                <span className="flex items-center gap-1 text-green-600"><User size={12} /> {nearbyReserves.length} Reserves Disp.</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6">
                        {[
                            { id: 'AFFECTED', label: 'Zona de Tall / Atrapats', Icon: AlertCircle, color: 'red', iconClass: "text-red-500" },
                            { id: 'BCN', label: 'Costat Barcelona', Icon: ArrowDownToLine, color: 'blue', iconClass: "text-blue-500" },
                            { id: 'VALLES', label: 'Costat Vallès', Icon: ArrowUpToLine, color: 'green', iconClass: "text-green-600", unifiedOnly: true },
                            { id: 'S1', label: 'Costat Terrassa', Icon: ArrowUpToLine, color: 'orange', iconClass: "text-orange-500", splitOnly: true },
                            { id: 'S2', label: 'Costat Sabadell', Icon: ArrowRightToLine, color: 'green', iconClass: "text-green-500", splitOnly: true },
                            { id: 'L6', label: 'Costat Elisenda', Icon: ArrowUpToLine, color: 'purple', iconClass: "text-purple-500" },
                            { id: 'L7', label: 'Costat Tibidabo', Icon: ArrowLeftToLine, color: 'amber', iconClass: "text-amber-700" },
                            { id: 'ISOLATED', label: 'Zones Aïllades', Icon: Layers, color: 'gray', iconClass: "text-gray-500" },
                        ].map((col) => {
                            const bucket = dividedPersonnel[col.id];
                            const items = bucket?.list || [];
                            const vallesUnified = dividedPersonnel.VALLES.isUnified;
                            if (col.unifiedOnly && !vallesUnified) return null;
                            if (col.splitOnly && vallesUnified) return null;
                            if (items.length === 0 && col.id !== 'AFFECTED') return null;
                            const trainsCount = items.filter((i: any) => i.type === 'TRAIN').length;
                            const isRed = col.color === 'red';
                            return (
                                <div key={col.id} className={`${isRed ? 'bg-red-50/50 dark:bg-red-950/20 border-2 border-red-500/30' : 'bg-gray-50/30 dark:bg-white/5 border border-gray-100 dark:border-white/10'} rounded-[32px] p-6 transition-all`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                                        <div className="flex items-center gap-2">
                                            <col.Icon size={18} className={col.iconClass} />
                                            <h5 className={`font-black uppercase text-xs sm:text-sm tracking-widest ${isRed ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{col.label}</h5>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:ml-auto">
                                            <div className="flex items-center gap-1.5 bg-fgc-grey dark:bg-black text-white px-3 py-1 rounded-xl text-[10px] sm:text-xs font-black" title="Trens Actius"><Train size={10} /> {trainsCount} <span className="hidden sm:inline opacity-60">TRENS</span></div>
                                            <div className="flex items-center gap-1.5 bg-fgc-green text-fgc-grey px-3 py-1 rounded-xl text-[10px] sm:text-xs font-black" title="Maquinistes a la zona"><User size={10} /> {items.length} <span className="hidden sm:inline opacity-60">MAQUINISTES</span></div>
                                            {items.length > 0 && (
                                                <button onClick={() => { setAltServiceIsland(col.id); setIsPaused(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded-xl text-[10px] sm:text-xs font-black shadow-md hover:scale-105 active:scale-95 transition-all">
                                                    <Zap size={10} /> SERVEI ALTERNATIU
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`bg-white dark:bg-black/20 rounded-2xl border ${isRed ? 'border-red-200 dark:border-red-900/50' : 'border-gray-100 dark:border-white/10'} divide-y ${isRed ? 'divide-red-100 dark:divide-red-900/30' : 'divide-gray-50 dark:divide-white/5'}`}>
                                        {items
                                            .sort((a: any, b: any) => (a.type === 'TRAIN' ? 0 : 1) - (b.type === 'TRAIN' ? 0 : 1))
                                            .map((t: any) => {
                                                const currentStation = t.stationId.toUpperCase();
                                                const startStation = t.shiftDep?.toUpperCase();
                                                let isDisplaced = false;
                                                if (startStation) {
                                                    const startIsland = Object.entries(islands).find(([key, stations]: any) => stations.has(startStation))?.[0];
                                                    const currentIsland = Object.entries(islands).find(([key, stations]: any) => stations.has(currentStation))?.[0];
                                                    if (startIsland && currentIsland && startIsland !== currentIsland) {
                                                        isDisplaced = true;
                                                    }
                                                }
                                                return (
                                                    <ListPersonnelRow
                                                        key={`${t.torn}-${t.id}`}
                                                        item={t}
                                                        variant={isRed ? 'affected' : 'normal'}
                                                        isDisplaced={isDisplaced}
                                                    />
                                                );
                                            })
                                        }
                                        {items.length === 0 && <p className="text-center py-10 text-[10px] font-bold text-gray-300 dark:text-gray-700 uppercase tracking-widest italic">Cap presència en aquesta banda</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncidenciaMap;
