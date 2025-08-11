import React from 'react';
import useCopyToClipboard from '../hooks/useCopyToClipboard';
import { Check, Copy, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  recoveryPhrase: string;
}

const RewardModal: React.FC<RewardModalProps> = ({ isOpen, onClose, recoveryPhrase }) => {
  const { t } = useTranslation();
  const [copied, copyToClipboard] = useCopyToClipboard();
  const words = recoveryPhrase.split(' ');

  if (!isOpen) return null;

  const handleCopy = () => {
    copyToClipboard(recoveryPhrase);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-800 border border-yellow-500/50 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 transform transition-all"
      >
        <div className="text-center">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">{t('congratulations')}</h2>
            <p className="text-gray-300 mb-6">{t('reward_modal_description')}</p>
        </div>

        <div className="bg-gray-900/70 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 font-spacemono text-gray-200">
                {words.map((word, index) => (
                    <div key={index} className="flex items-center">
                        <span className="text-gray-500 w-6 text-right mr-2">{index + 1}.</span>
                        <span>{word}</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="flex items-center bg-blue-900/40 text-blue-300 p-3 rounded-lg text-sm mb-6">
          <p>{t('reward_modal_guidance')}</p>
        </div>

        <div className="flex items-center bg-red-900/40 text-red-300 p-3 rounded-lg text-sm mb-6">
            <ShieldAlert className="w-10 h-10 mr-3 flex-shrink-0" />
            <div>
                <h3 className="font-bold">{t('security_warning_title')}</h3>
                <p>{t('security_warning_description')}</p>
            </div>
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
            onClick={onClose}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RewardModal;
