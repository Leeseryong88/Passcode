import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { submitSolverName } from '../api/puzzles';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  notice?: string;
  puzzleId?: number;
  enableSolverName?: boolean;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl, notice, puzzleId, enableSolverName }) => {
  const { t } = useTranslation();
  const [solverName, setSolverName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCloseWithSave = async () => {
    // If solver name flow is disabled, just close
    if (!enableSolverName) {
      onClose();
      return;
    }
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
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="relative bg-gray-900 p-4 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-white bg-gray-800 rounded-full p-1 hover:bg-gray-700 transition-colors"
          aria-label="Close image view"
        >
          <X className="w-6 h-6" />
        </button>
        <img src={imageUrl} alt="Puzzle full view" className="max-w-full max-h-[50vh] sm:max-h-[60vh] object-contain mx-auto" />
        {notice && (
          <div className="mt-4 bg-yellow-900/40 text-yellow-200 text-sm p-3 rounded-md">
            {notice}
          </div>
        )}
        {enableSolverName && (
          <div className="mt-4">
            <label className="block text-sm mb-1">{t('enter_solver_name') || 'Your name or nickname (optional)'}</label>
            <input
              value={solverName}
              onChange={(e) => setSolverName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-colors text-sm"
              placeholder={t('enter_solver_name_placeholder') || 'Enter name to display on the board'}
            />
            <p className="mt-1 text-xs text-gray-400">{t('name_moderation_notice') || 'Inappropriate names may be removed by admins.'}</p>
            {validationError && <div className="mt-2 text-red-400 text-sm">{validationError}</div>}
            <div className="mt-3 flex justify-end">
              <button onClick={handleCloseWithSave} disabled={isSaving} className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 text-white font-semibold px-4 py-2 rounded">
                {isSaving ? (t('save') || 'Save') : (t('close') || 'Close')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageModal;