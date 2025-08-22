import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import type { PublicPuzzle } from './types';
import PuzzleCard from './components/PuzzleCard';
import Header from './components/Header';
import { getPublicPuzzles, getSolvedAnswer } from './api/puzzles';
import { LoaderCircle } from 'lucide-react';
import SupportCard from './components/SupportCard';
import { useTranslation } from 'react-i18next';
import FilterControls from './components/FilterControls';
import { lazy } from 'react';
const AnalyticsLazy = lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })));

type FilterType = 'all' | 'solved' | 'unsolved';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [puzzles, setPuzzles] = useState<PublicPuzzle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('unsolved');
  // Level filter removed

  const fetchPuzzles = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedPuzzles = await getPublicPuzzles();
      // 해결된 퍼즐인데 목록 응답에 answer가 비어있으면 서버에서 보충 조회
      const enriched = await Promise.all(
        fetchedPuzzles.map(async (p) => {
          if ((p as any).isSolved && !(p as any).answer) {
            try {
              const ans = await getSolvedAnswer(p.id);
              if (ans) {
                return { ...(p as any), answer: ans } as any;
              }
            } catch {
              // ignore per-item errors
            }
          }
          return p as any;
        })
      );
      setPuzzles(enriched as any);
      setError(null);
    } catch (err) {
      setError(t('failed_to_load_puzzles'));
      if ((import.meta as any).env?.DEV) console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPuzzles();
  }, [fetchPuzzles]);

  const handleSolve = () => {
    // Refetch puzzles to get the updated isSolved status
    fetchPuzzles();
  };

  // Level filter removed

  const hasActiveUnsolved = useMemo(() => {
    return puzzles.some((p: any) => Boolean(p?.isPublished) && !Boolean(p?.isSolved));
  }, [puzzles]);

  const filteredPuzzles = useMemo(() => {
    return puzzles.filter(puzzle => {
      const solveStatusFilter =
        activeFilter === 'all' ||
        (activeFilter === 'solved' && puzzle.isSolved) ||
        (activeFilter === 'unsolved' && !puzzle.isSolved);
      return solveStatusFilter;
    });
  }, [puzzles, activeFilter]);

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
  };

  // Level change handler removed

  const supportWalletAddress = "0x47Cb533DD27446c912C4cc41Bda9407e8F7BAF95";

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Suspense fallback={null}>
        <AnalyticsLazy />
      </Suspense>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <FilterControls 
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
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
            <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredPuzzles.map((puzzle) => (
                <PuzzleCard 
                  key={puzzle.id} 
                  puzzle={puzzle} 
                  isSolved={puzzle.isSolved || false}
                  onSolve={handleSolve}
                />
              ))}
              {!hasActiveUnsolved && (
                <SupportCard walletAddress={supportWalletAddress} />
              )}
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
