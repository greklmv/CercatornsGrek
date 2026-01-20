import React from 'react';
import { Phone, AlertTriangle } from 'lucide-react';
import { LivePersonnel } from '../../types';

interface ListPersonnelRowProps {
    item: LivePersonnel;
    variant: 'affected' | 'normal';
    isDisplaced?: boolean;
}

const ListPersonnelRow: React.FC<ListPersonnelRowProps> = ({ item, variant, isDisplaced }) => {
    const isTrain = item.type === 'TRAIN';
    return (
        <div className={`flex items-center justify-between p-3 ${variant === 'affected' ? 'bg-red-50/50 dark:bg-red-950/10' : 'bg-white dark:bg-white/5'} hover:bg-gray-50 dark:hover:bg-white/10 transition-colors group`}>
            <div className="flex items-center gap-3">
                {isTrain ? (
                    <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: item.color }} />
                ) : (
                    <div className="w-1.5 h-8 rounded-full bg-gray-400" />
                )}
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-fgc-grey dark:text-white uppercase">{item.id}</span>
                        {isDisplaced && (
                            <span title="Desplaçat de la seva zona habitual">
                                <AlertTriangle size={12} className="text-orange-500" />
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 uppercase">
                        <span>{isTrain ? `Unitat ${item.id}` : 'Descans'}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                        <span>{item.driver}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="bg-gray-100 dark:bg-black/40 text-gray-500 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">{item.torn}</span>
                {item.phones && item.phones.length > 0 && (
                    <a href={`tel:${item.phones[0]}`} className="text-gray-300 hover:text-blue-500 transition-colors"><Phone size={14} /></a>
                )}
            </div>
        </div>
    );
};

export default ListPersonnelRow;
