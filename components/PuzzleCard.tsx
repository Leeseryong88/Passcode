import React, { useState } from 'react';
import type { PublicPuzzle } from '../types';
import RewardModal from './RewardModal';
import ImageModal from './ImageModal';
import { ExternalLink, CheckCircle, XCircle, Wallet, Puzzle as PuzzleIcon, LoaderCircle } from 'lucide-react';
import { checkPuzzleAnswer } from '../api/puzzles';
import { useTranslation } from 'react-i18next';

interface PuzzleCardProps {
  puzzle: PublicPuzzle;
  isSolved: boolean;
  onSolve: () => void;
}

const PuzzleCard: React.FC<PuzzleCardProps> = ({ puzzle, isSolved, onSolve }) => {
  const { t } = useTranslation();
  const [guess, setGuess] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [rewardRevealImageUrl, setRewardRevealImageUrl] = useState('');
  const [isRewardImageModalOpen, setIsRewardImageModalOpen] = useState(false);
  const [isReentering, setIsReentering] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((isSolved && !isReentering) || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await checkPuzzleAnswer(puzzle.id, guess) as any;
      if (result.type === 'metamask') {
        setRecoveryPhrase(result.recoveryPhrase);
        setIsModalOpen(true);
      } else if (result.type === 'image') {
        setRewardRevealImageUrl(result.revealImageUrl);
        setIsRewardImageModalOpen(true);
      }
      setIsReentering(false);
    } catch (err: any) {
      setError(err.message || t('incorrect_answer'));
      setGuess('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={`bg-gray-800 border ${isSolved ? 'border-green-500/50' : 'border-gray-700'} rounded-xl shadow-lg overflow-hidden transition-all duration-300 transform hover:scale-105 hover:shadow-cyan-500/10`}>
        <img 
          src={puzzle.imageUrl} 
          alt={`${t('level')} ${puzzle.level}`} 
          className="w-full h-56 object-cover cursor-pointer"
          onClick={() => setIsImageModalOpen(true)}
        />
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
              <PuzzleIcon className="w-6 h-6" /> {t('level')} {puzzle.level}
            </h2>
            <div className="text-lg font-semibold text-yellow-400">
              {puzzle.rewardAmount}
            </div>
          </div>
          {(!puzzle.rewardType || puzzle.rewardType === 'metamask') && (
            <div className="bg-gray-900/50 p-3 rounded-lg mb-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span className="font-spacemono break-all">{puzzle.walletaddress}</span>
              </div>
              {puzzle.explorerLink && (
                <a href={puzzle.explorerLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  <span>{t('view_on_block_explorer')}</span>
                </a>
              )}
            </div>
          )}
          
          {isSolved && !isReentering ? (
            <div className="mt-4 p-4 bg-green-900/50 border border-green-500 rounded-lg text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-green-400">
                <CheckCircle />
                <p className="font-semibold">{t('puzzle_solved')}</p>
              </div>
              <p className="text-sm text-gray-300">{t('reenter_guidance')}</p>
              <button
                onClick={() => { setIsReentering(true); setGuess(''); setError(null); }}
                className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                {t('reenter_answer')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder={t('enter_your_answer')}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors"
                aria-label="Answer input"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={!guess || isSubmitting}
              >
                {isSubmitting ? <LoaderCircle className="w-5 h-5 animate-spin" /> : t('submit_answer')}
              </button>
            </form>
          )}

          {error && (
             <div className="mt-3 flex items-center gap-2 text-red-400 text-sm p-2 bg-red-900/30 rounded-md">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
             </div>
          )}
        </div>
      </div>
      <RewardModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); onSolve(); }}
        recoveryPhrase={recoveryPhrase}
      />
      <ImageModal 
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        imageUrl={puzzle.imageUrl}
      />
      <ImageModal
        isOpen={isRewardImageModalOpen}
        onClose={() => { setIsRewardImageModalOpen(false); onSolve(); }}
        imageUrl={rewardRevealImageUrl}
      />
    </>
  );
};

export default PuzzleCard;
