import React from 'react';
import { useTranslation } from 'react-i18next';

interface SupportCardProps {}

const SupportCard: React.FC<SupportCardProps> = () => {
  const { t } = useTranslation();
  return (
    <div className="bg-gray-800 border border-cyan-500/30 rounded-lg shadow-lg p-6 flex flex-col text-center transform hover:scale-105 transition-transform duration-300 h-full min-h-[300px]">
      <div className="flex-grow flex flex-col justify-center">
        <h3 className="text-2xl font-bold text-cyan-400 mb-4">{t('more_puzzles_title')}</h3>
        <p className="text-gray-300 mb-6">
          {t('more_puzzles_description')}
        </p>
      </div>
      {/* Sponsorship section removed as requested */}
    </div>
  );
};

export default SupportCard; 