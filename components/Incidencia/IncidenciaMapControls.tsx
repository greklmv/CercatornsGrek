import React from 'react';
import { Clock, Activity, FastForward, RefreshCw } from 'lucide-react';

interface IncidenciaMapControlsProps {
    isRealTime: boolean;
    setIsRealTime: (val: boolean) => void;
    customTime: string;
    setCustomTime: (val: string) => void;
    isPaused: boolean;
    setIsPaused: (val: boolean) => void;
    isGeoTrenEnabled: boolean;
    setIsGeoTrenEnabled: (val: boolean) => void;
    fetchLiveMapData: () => void;
}

const IncidenciaMapControls: React.FC<IncidenciaMapControlsProps> = ({
    isRealTime,
    setIsRealTime,
    customTime,
    setCustomTime,
    isPaused,
    setIsPaused,
    isGeoTrenEnabled,
    setIsGeoTrenEnabled,
    fetchLiveMapData
}) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest leading-none">Esquema Interactiu BV</h3>
                    <div className={`flex items-center gap-2 px-2 py-0.5 rounded-lg border transition-all ${isRealTime ? 'bg-fgc-green/10 border-fgc-green/20 text-fgc-green' : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isRealTime ? 'bg-fgc-green' : 'bg-gray-400'}`}></div>
                        <span className="text-[8px] font-black uppercase tracking-widest">{isRealTime ? 'En Temps Real' : 'Tall Manual'}</span>
                    </div>
                </div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1"><Clock size={10} /> Estat malla: <span className="text-fgc-grey dark:text-white font-black">{customTime || '--:--'}</span></p>
            </div>
            <div className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-black/20 p-2 rounded-[24px] border border-gray-100 dark:border-white/5">
                <button onClick={() => setIsGeoTrenEnabled(!isGeoTrenEnabled)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isGeoTrenEnabled ? 'bg-blue-500 text-white shadow-md' : 'text-gray-400 hover:text-fgc-grey'}`} title="Activar posicionament real GPS (GeoTren)"><Activity size={14} className={isGeoTrenEnabled ? 'animate-pulse' : ''} /> GeoTren</button>
                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1 hidden sm:block"></div>
                <button onClick={() => setIsRealTime(true)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isRealTime ? 'bg-fgc-grey dark:bg-fgc-green text-white dark:text-fgc-grey shadow-md' : 'text-gray-400 hover:text-fgc-grey'}`}>Live</button>
                <button onClick={() => setIsPaused(!isPaused)} className={`p-2 rounded-xl text-xs font-black transition-all ${isPaused ? 'bg-orange-500 text-white shadow-md' : 'bg-white dark:bg-white/5 text-gray-400 hover:text-fgc-grey'}`}>{isPaused ? <FastForward size={14} fill="currentColor" /> : <span className="flex gap-1"><div className="w-1 h-3 bg-current rounded-full" /><div className="w-1 h-3 bg-current rounded-full" /></span>}</button>
                <input type="time" value={customTime} onChange={(e) => { setCustomTime(e.target.value); setIsRealTime(false); }} className="bg-white dark:bg-gray-800 border-none rounded-lg px-3 py-1.5 text-xs font-black text-fgc-grey dark:text-white focus:ring-2 focus:ring-fgc-green/30 outline-none" />
                <button onClick={fetchLiveMapData} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-gray-400"><RefreshCw size={14} /></button>
            </div>
        </div>
    );
};
export default IncidenciaMapControls;
