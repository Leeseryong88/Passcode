import React, { useState, useEffect, Suspense, useMemo } from 'react';
import type { PublicPuzzle } from './types';
import PuzzleCard from './components/PuzzleCard';
import Header from './components/Header';
import { getPublicPuzzles } from './api/puzzles';
import { LoaderCircle } from 'lucide-react';
import SupportCard from './components/SupportCard';
import { useTranslation } from 'react-i18next';
import FilterControls from './components/FilterControls';

type FilterType = 'all' | 'solved' | 'unsolved';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [puzzles, setPuzzles] = useState<PublicPuzzle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solvedPuzzles, setSolvedPuzzles] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('solvedPuzzles');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse solvedPuzzles from localStorage", error);
      return [];
    }
  });
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all');

  useEffect(() => {
    localStorage.setItem('solvedPuzzles', JSON.stringify(solvedPuzzles));
  }, [solvedPuzzles]);

  useEffect(() => {
    const fetchPuzzles = async () => {
      try {
        setIsLoading(true);
        const fetchedPuzzles = await getPublicPuzzles();
        const validPuzzles = fetchedPuzzles.filter(p => p.imageUrl);
        setPuzzles(validPuzzles);
        setError(null);
      } catch (err) {
        setError(t('failed_to_load_puzzles'));
        if (import.meta.env.DEV) console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPuzzles();
  }, [t]);

  const handleSolve = (puzzleId: number) => {
    if (!solvedPuzzles.includes(puzzleId)) {
      setSolvedPuzzles(prev => [...prev, puzzleId]);
    }
  };

  const levels = useMemo(() => {
    const allLevels = puzzles.map(p => p.level);
    return [...new Set(allLevels)].sort((a, b) => a - b);
  }, [puzzles]);

  const filteredPuzzles = useMemo(() => {
    return puzzles.filter(puzzle => {
      const solveStatusFilter = 
        activeFilter === 'all' ||
        (activeFilter === 'solved' && solvedPuzzles.includes(puzzle.id)) ||
        (activeFilter === 'unsolved' && !solvedPuzzles.includes(puzzle.id));

      const levelFilter = selectedLevel === 'all' || puzzle.level === selectedLevel;

      return solveStatusFilter && levelFilter;
    });
  }, [puzzles, activeFilter, selectedLevel, solvedPuzzles]);

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    if (filter !== 'all') {
      setSelectedLevel('all');
    }
  };

  const handleLevelChange = (level: number | 'all') => {
    setSelectedLevel(level);
    if (level !== 'all') {
      setActiveFilter('all');
    }
  };

  const supportWalletAddress = "0x47Cb533DD27446c912C4cc41Bda9407e8F7BAF95";

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <FilterControls 
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          levels={levels}
          selectedLevel={selectedLevel}
          onLevelChange={handleLevelChange}
        />
        
        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <LoaderCircle className="w-12 h-12 animate-spin text-cyan-400" />
          </div>
        )}

        {error && (
          <div className="text-center text-red-400 bg-red-900/30 p-4 rounded-lg">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredPuzzles.map((puzzle) => (
              <PuzzleCard 
                key={puzzle.id} 
                puzzle={puzzle} 
                isSolved={solvedPuzzles.includes(puzzle.id)}
                onSolve={() => handleSolve(puzzle.id)}
              />
            ))}
            <SupportCard 
              walletAddress={supportWalletAddress}
            />
          </div>
        )}
        
      </main>
      <footer className="text-center p-6 text-gray-500 text-sm">
        <p>{t('footer_conceptual')}</p>
        <p>{t('footer_copyright')}</p>
      </footer>
    </div>
  );
};

// Suspense for i18next
const AppWithSuspense: React.FC = () => (
  <Suspense fallback={<LoaderCircle className="w-12 h-12 animate-spin text-cyan-400" />}>
    <App />
  </Suspense>
);

export default AppWithSuspense;
