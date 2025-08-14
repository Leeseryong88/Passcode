import React, { useState } from 'react';
import useCopyToClipboard from '../hooks/useCopyToClipboard';
import { Check, Copy, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { submitSolverName } from '../api/puzzles';

interface TextRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  puzzleId?: number;
}

const TextRewardModal: React.FC<TextRewardModalProps> = ({ isOpen, onClose, text, puzzleId }) => {
  const { t } = useTranslation();
  const [copied, copyToClipboard] = useCopyToClipboard();
  const [solverName, setSolverName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = () => {
    copyToClipboard(text);
  };

  const handleCloseWithSave = async () => {
    if (!puzzleId) {
      onClose();
      return;
    }
    const name = solverName.trim();
    if (!name) {
      setValidationError(t('please_enter_solver_name') || '정답자 이름을 입력하세요');
      return;
    }
    setIsSaving(true);
    setValidationError(null);
    try {
      await submitSolverName(puzzleId, name);
      onClose();
    } catch (e: any) {
      setValidationError(e.message || 'Failed to save name');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800 border border-cyan-500/40 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 transform transition-all"
      >
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-cyan-300 mb-2 flex items-center justify-center gap-2">
            <FileText className="w-6 h-6" />
            {t('congratulations')}
          </h2>
        </div>

        <div className="bg-gray-900/70 p-4 rounded-lg mb-6 text-gray-100 whitespace-pre-wrap break-words">
          {text}
        </div>

        <div className="mb-4">
          <label className="block text-sm mb-1">{t('enter_solver_name') || 'Your name or nickname (optional)'}</label>
          <input
            value={solverName}
            onChange={(e) => setSolverName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors text-sm"
            placeholder={t('enter_solver_name_placeholder') || 'Enter name to display on the board'}
          />
          <p className="mt-1 text-xs text-gray-400">{t('name_moderation_notice') || 'Inappropriate names may be removed by admins.'}</p>
          {validationError && <div className="mt-2 text-red-400 text-sm">{validationError}</div>}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-all"
          >
            {copied ? <Check size={20} /> : <Copy size={20} />}
            {copied ? t('copied') : t('copy_to_clipboard')}
          </button>
          <button
            onClick={handleCloseWithSave}
            disabled={isSaving}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600"
          >
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextRewardModal;

