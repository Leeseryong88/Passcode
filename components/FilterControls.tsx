import React from 'react';
import { useTranslation } from 'react-i18next';
import { List, Check, X } from 'lucide-react';

type FilterType = 'all' | 'solved' | 'unsolved';

interface FilterControlsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts?: { all: number; solved: number; unsolved: number };
}

const FilterControls: React.FC<FilterControlsProps> = ({ 
  activeFilter, 
  onFilterChange,
  counts
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
  const badgeClass = "ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold bg-black/30";

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
            {counts && (
              <span className={badgeClass}>
                {filter.id === 'all' && counts.all}
                {filter.id === 'solved' && counts.solved}
                {filter.id === 'unsolved' && counts.unsolved}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Level filter removed per requirements */}
    </div>
  );
};

export default FilterControls;
