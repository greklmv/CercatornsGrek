import React, { useMemo, useState, useEffect } from 'react';
import { Clock, X, Train, MapPin, ArrowRight } from 'lucide-react';
import { getLiniaColorHex, resolveStationId, getFgcMinutes, formatFgcTime } from '../../utils/incidenciaUtils';
import { StationStop } from '../../types';

interface StationInfoBoardProps {
    stationId: string;
    onClose: () => void;
    enrichedGeoTrenData: any[]; // Or specific type
}

const StationInfoBoard: React.FC<StationInfoBoardProps> = ({ stationId, onClose, enrichedGeoTrenData }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 30); // Update every 30s
        return () => clearInterval(timer);
    }, []);

    const departures = useMemo(() => {
        const normalizedTarget = resolveStationId(stationId);
        const currentMin = currentTime.getHours() * 60 + currentTime.getMinutes();

        const list: any[] = [];

        enrichedGeoTrenData.forEach(train => {
            if (!train.properes_parades) return;

            // properes_parades comes as a JSON string from the API
            let stops: any[] = [];
            try {
                stops = typeof train.properes_parades === 'string'
                    ? JSON.parse(train.properes_parades)
                    : train.properes_parades;
            } catch (e) {
                // Fallback for weird formatting if necessary
                return;
            }

            if (!Array.isArray(stops)) return;

            // Find our station in the list
            // stops format: { "parada": "Nom Parada", "hora": "HH:MM" } or similar
            // We need to map "parada" name to our station IDs to be sure.

            // NOTE: The API return names often match our 'nom' in constants.
            // But we use resolveStationId to be safer if possible, or fuzzy match.
            // For now assuming direct name match or simple resolution.

            const stopEntry = stops.find((s: any) => {
                // Heuristic: Check if name includes our station name or ID?
                // Ideally we have a name-to-id map.
                // Let's assume resolveStationId can handle the name from API if we are lucky,
                // or we just check if it matches the current station's label locally.
                // Since resolveStationId maps codes-to-codes or names-to-codes, let's try.
                return resolveStationId(s.parada) === normalizedTarget || s.parada.toUpperCase().includes(stationId.toUpperCase()) || (s.parada === normalizedTarget); // Loose match
            });

            if (stopEntry && stopEntry.hora) {
                const arrivalMin = getFgcMinutes(stopEntry.hora);
                if (arrivalMin !== null && arrivalMin >= currentMin) {
                    list.push({
                        id: train.id,
                        linia: train.lin,
                        desti: train.desti,
                        hora: stopEntry.hora,
                        minFiles: arrivalMin - currentMin,
                        type: 'REAL'
                    });
                }
            }
        });

        return list.sort((a, b) => a.minFiles - b.minFiles);
    }, [enrichedGeoTrenData, stationId, currentTime]);

    // Station Name Formatting
    const stationName = stationId; // In a real app we would map ID -> Full Name

    return (
        <div className="fixed top-24 right-8 z-[150] w-96 animate-in slide-in-from-right duration-300 pointer-events-none">
            <div className="bg-gray-900 border-2 border-gray-800 rounded-3xl overflow-hidden shadow-2xl pointer-events-auto">
                {/* Header */}
                <div className="bg-black/40 p-5 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <MapPin size={14} className="text-blue-500" />
                            <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Estació Seleccionada</h3>
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight truncate max-w-[200px]">{stationName}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {departures.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center opacity-30 gap-4">
                            <Clock size={48} className="text-gray-400" />
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sense properes sortides<br />informades</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {departures.map((d, i) => (
                                <div key={i} className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                    {/* Line Badge */}
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shadow-lg shrink-0"
                                        style={{ backgroundColor: getLiniaColorHex(d.linia) }}>
                                        {d.linia}
                                    </div>

                                    {/* Dest & Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Destinació</span>
                                            <ArrowRight size={10} className="text-gray-600" />
                                        </div>
                                        <p className="text-lg font-black text-white uppercase truncate leading-none">{d.desti}</p>
                                    </div>

                                    {/* Time */}
                                    <div className="text-right shrink-0">
                                        {d.minFiles === 0 ? (
                                            <span className="animate-pulse text-lg font-black text-green-500 uppercase tracking-tight">ARA</span>
                                        ) : (
                                            <div className="flex flex-col items-end">
                                                <span className="text-2xl font-black text-white leading-none tracking-tight">{d.minFiles}<span className="text-xs align-top ml-0.5 text-gray-500">min</span></span>
                                                <span className="text-[9px] font-bold text-gray-600 font-mono">{d.hora}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-black/20 border-t border-white/5 flex items-center justify-between text-[9px] font-bold text-gray-600 uppercase tracking-wider px-6">
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Temps Real (GeoTren)</span>
                    <span>{formatFgcTime(currentTime.getHours() * 60 + currentTime.getMinutes())}</span>
                </div>
            </div>
        </div>
    );
};

export default StationInfoBoard;
