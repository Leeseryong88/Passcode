import React, { useState, lazy, Suspense } from 'react';
import type { PublicPuzzle } from '../types';
const RewardModal = lazy(() => import('./RewardModal'));
const TextRewardModal = lazy(() => import('./TextRewardModal'));
const InfoModal = lazy(() => import('./InfoModal'));
const ImageModal = lazy(() => import('./ImageModal'));
import { ExternalLink, CheckCircle, XCircle, Wallet, LoaderCircle, Star } from 'lucide-react';
import { checkPuzzleAnswer, getSolvedAnswer } from '../api/puzzles';
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
  const [isTextRewardModalOpen, setIsTextRewardModalOpen] = useState(false);
  const [isReentering, setIsReentering] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [revealText, setRevealText] = useState('');
  const [showWalletAddress, setShowWalletAddress] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ((isSolved && !isReentering) || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await checkPuzzleAnswer(puzzle.id, guess) as any;
      // 재입력 모드에서는 보상 재노출 방지: 정답 확인만 수행
      if (isReentering) {
        // 서버에서 정답 조회 시도(해결된 퍼즐만 허용)
        const ans = await getSolvedAnswer(puzzle.id);
        if (ans) {
          setInfoMessage(`${t('already_solved_message')}\n${ans}`);
        } else {
          setInfoMessage(t('already_solved_message'));
        }
        setInfoOpen(true);
        setIsReentering(false);
        setGuess('');
        return;
      }
      if (result.type === 'metamask') {
        setRecoveryPhrase(result.recoveryPhrase);
        setIsModalOpen(true);
      } else if (result.type === 'image') {
        setRewardRevealImageUrl(result.revealImageUrl);
        setIsRewardImageModalOpen(true);
      } else if (result.type === 'text') {
        setRevealText(result.revealText || '');
        setIsTextRewardModalOpen(true);
      } else if (result.type === 'already_solved') {
        setInfoMessage(t('already_solved_message'));
        setInfoOpen(true);
      }
      setIsReentering(false);
    } catch (err: any) {
      setError(err.message || t('incorrect_answer'));
      setGuess('');
      // Refresh puzzle list to reflect global wrongAttempts increment
      if (!isReentering) {
        onSolve();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAnswer = async () => {
    if (!showAnswer) {
      // 우선 카드 내에 포함된 answer를 사용하고, 없으면 서버에서 조회
      if (!puzzle.answer) {
        const ans = await getSolvedAnswer(puzzle.id);
        if (ans) setAnswerText(ans);
      }
    }
    setShowAnswer((prev) => !prev);
  };

  return (
    <>
      <div className={`relative bg-gray-800 border ${isSolved ? 'border-green-500/50' : 'border-gray-700'} rounded-xl shadow-lg overflow-hidden transition-colors duration-200 hover:shadow-cyan-500/10`}>
        {isSolved && (
          <span className="absolute top-2 left-2 text-xs font-semibold bg-green-700/70 text-green-100 px-2 py-0.5 rounded">{t('solved')}</span>
        )}
        {(puzzle as any).solverName && (
          <span className="absolute top-2 right-2 max-w-[75%]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-cyan-500/20 text-amber-300 ring-1 ring-amber-400/50 px-2.5 py-0.5 shadow-sm backdrop-blur">
              <Star className="w-4 h-4 text-amber-400 fill-current" />
              <span className="truncate max-w-[12rem]" title={(puzzle as any).solverName}>
                {(puzzle as any).solverName}
              </span>
            </span>
          </span>
        )}
        <img 
          src={puzzle.imageUrl} 
          alt={`puzzle image`} 
          loading="lazy"
          decoding="async"
          className="w-full h-36 sm:h-40 object-cover cursor-pointer"
          onClick={() => setIsImageModalOpen(true)}
        />
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col gap-1">
              {(puzzle as any).puzzleName && (
                <span className="inline-block max-w-[16rem] text-[10px] sm:text-xs font-semibold bg-cyan-600/20 text-cyan-200 px-2 py-0.5 rounded truncate" title={(puzzle as any).puzzleName}>
                  {(puzzle as any).puzzleName}
                </span>
              )}
              {(puzzle as any).puzzleType && (
                <span className="inline-block text-[10px] sm:text-xs font-semibold bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded">
                  {(puzzle as any).puzzleType}
                </span>
              )}
            </div>
            {isSolved && (
              <span className="text-[10px] sm:text-xs font-semibold bg-yellow-600/20 text-yellow-300 px-2 py-0.5 rounded">{puzzle.rewardAmount}</span>
            )}
          </div>
          <div className="flex justify-end mb-2">
            <span className="text-[10px] sm:text-xs font-semibold bg-red-600/20 text-red-300 px-2 py-0.5 rounded">{t('wrong_attempts_count', { count: (puzzle as any).wrongAttempts || 0 })}</span>
          </div>
          {isSolved && (!puzzle.rewardType || puzzle.rewardType === 'metamask') && (
            <div className="bg-gray-900/40 p-2 rounded-lg mb-3 space-y-1 text-xs">
              <div className="flex items-center gap-2 text-gray-300">
                <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                {showWalletAddress ? (
                  <span className="font-spacemono break-all">{puzzle.walletaddress}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowWalletAddress(true)}
                    className="text-cyan-300 hover:text-cyan-200 underline decoration-dotted"
                  >
                    {t('view_wallet_address') || '지갑 주소 보기'}
                  </button>
                )}
              </div>
              {puzzle.explorerLink && (
                <a href={puzzle.explorerLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('view_on_block_explorer')}</span>
                </a>
              )}
            </div>
          )}
          
          {isSolved && !isReentering ? (
            <div
              className="mt-3 p-3 bg-green-900/40 border border-green-600/60 rounded-lg text-center space-y-2 cursor-pointer select-none"
              onClick={handleToggleAnswer}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleToggleAnswer(); }}
            >
              <div className="flex items-center justify-center gap-2 text-green-300">
                <CheckCircle className="w-4 h-4" />
                <p className="text-xs sm:text-sm font-semibold">{t('puzzle_solved')}</p>
              </div>
              {showAnswer && (
                <div className="text-xs sm:text-sm space-y-1">
                  <div>
                    <span className="text-gray-300">정답: </span>
                    <span className="font-semibold text-green-300 break-words">{puzzle.answer || answerText}</span>
                  </div>
                  {(puzzle as any).solverName && (
                    <div>
                      <span className="text-gray-300">정답자: </span>
                      <span className="font-semibold text-cyan-300 break-words">{(puzzle as any).solverName}</span>
                    </div>
                  )}
                </div>
              )}
              {!showAnswer && (
                <p className="text-xs text-gray-300">클릭하면 정답이 표시됩니다.</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder={t('enter_your_answer')}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors text-xs sm:text-sm"
                aria-label="Answer input"
                disabled={isSubmitting}
              />
              <button
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs sm:text-sm"
                disabled={!guess || isSubmitting}
              >
                {isSubmitting ? <LoaderCircle className="w-5 h-5 animate-spin" /> : t('submit_answer')}
              </button>
            </form>
          )}

          {error && (
             <div className="mt-3 flex items-center gap-2 text-red-400 text-xs sm:text-sm p-2 bg-red-900/30 rounded-md">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
             </div>
          )}
        </div>
      </div>
      <Suspense fallback={null}>
        <RewardModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setRevealText(''); onSolve(); }}
          recoveryPhrase={recoveryPhrase}
          revealText={revealText}
          puzzleId={puzzle.id}
        />
      </Suspense>
      <Suspense fallback={null}>
        <TextRewardModal
          isOpen={isTextRewardModalOpen}
          onClose={() => { setIsTextRewardModalOpen(false); setRevealText(''); onSolve(); }}
          text={revealText}
          puzzleId={puzzle.id}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ImageModal 
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          imageUrl={puzzle.imageUrl}
          puzzleId={puzzle.id}
          enableSolverName={false}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ImageModal
          isOpen={isRewardImageModalOpen}
          onClose={() => { setIsRewardImageModalOpen(false); onSolve(); }}
          imageUrl={rewardRevealImageUrl}
          notice={t('one_time_reveal_warning')}
          puzzleId={puzzle.id}
          enableSolverName={true}
        />
      </Suspense>
      <Suspense fallback={null}>
        <InfoModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} message={infoMessage} />
      </Suspense>
    </>
  );
};

export default PuzzleCard;
