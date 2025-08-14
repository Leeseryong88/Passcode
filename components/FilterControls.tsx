import React from 'react';
import { useTranslation } from 'react-i18next';
import { List, Check, X, Star } from 'lucide-react';

type FilterType = 'all' | 'solved' | 'unsolved' | 'level';

interface FilterControlsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  levels: number[];
  selectedLevel: number | 'all';
  onLevelChange: (level: number | 'all') => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({ 
  activeFilter, 
  onFilterChange, 
  levels,
  selectedLevel,
  onLevelChange
}) => {
  const { t } = useTranslation();

  const filters: { id: FilterType; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: t('all_puzzles'), icon: <List size={18} /> },
    { id: 'solved', label: t('solved_puzzles'), icon: <Check size={18} /> },
    { id: 'unsolved', label: t('unsolved_puzzles'), icon: <X size={18} /> },
  ];

  const baseButtonClass = "flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors text-sm font-medium whitespace-nowrap shrink-0";
  const activeButtonClass = "bg-cyan-600 text-white";
  const inactiveButtonClass = "bg-gray-700 hover:bg-gray-600 text-gray-300";

  return (
    <div className="mb-6 md:mb-8 p-3 md:p-4 bg-gray-800 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
      <div className='flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1'>
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`${baseButtonClass} ${activeFilter === filter.id ? activeButtonClass : inactiveButtonClass}`}
          >
            {filter.icon}
            <span className="text-sm">{filter.label}</span>
          </button>
        ))}
      </div>

      <div className="w-full md:w-auto">
        <div className="flex items-center gap-2 text-gray-300">
            <Star size={18} className="text-yellow-400"/>
            <select
                value={selectedLevel}
                onChange={(e) => onLevelChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm font-medium text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none appearance-none w-full md:w-auto"
                aria-label={t('filter_by_level')}
            >
                <option value="all">{t('all_levels')}</option>
                {levels.map(level => (
                <option key={level} value={level}>
                    {t('level')} {level}
                </option>
                ))}
            </select>
        </div>
      </div>
    </div>
  );
};

export default FilterControls;
