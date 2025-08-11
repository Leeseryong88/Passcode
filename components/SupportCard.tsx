import React from 'react';

interface SupportCardProps {
  walletAddress: string;
}

const SupportCard: React.FC<SupportCardProps> = ({ walletAddress }) => {
  return (
    <div className="bg-gray-800 border border-cyan-500/30 rounded-lg shadow-lg p-6 flex flex-col text-center transform hover:scale-105 transition-transform duration-300 h-full min-h-[300px]">
      
      <div className="flex-grow flex flex-col justify-center">
        <h3 className="text-2xl font-bold text-cyan-400 mb-4">More Puzzles Coming Soon</h3>
        <p className="text-gray-300 mb-6">
          New puzzles will be provided once all current puzzles are solved.
        </p>
      </div>
      
      <div className="w-full mt-auto pt-4 border-t border-gray-700">
        <p className="text-lg font-semibold text-gray-200">Free Sponsorship</p>
        <p className="text-sm text-cyan-300 break-all font-mono mt-2 px-2">{walletAddress}</p>
        <p className="text-xs text-gray-500 mt-2">Your support helps us create more amazing puzzles.</p>
      </div>
    </div>
  );
};

export default SupportCard; 