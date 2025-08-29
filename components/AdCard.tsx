import React from 'react';
import { ExternalLink } from 'lucide-react';

interface AdCardProps {
  shortUrl: string;
  imageUrl?: string;
}

const AdCard: React.FC<AdCardProps> = ({ shortUrl, imageUrl }) => {
  return (
    <a href={shortUrl} target="_blank" rel="noopener noreferrer sponsored nofollow" className="block group">
      <div className="relative bg-gray-850 border border-cyan-700/30 rounded-xl shadow-lg overflow-hidden transition-transform duration-200 group-hover:translate-y-[-1px]">
        {imageUrl ? (
          <div className="w-full h-44 bg-gray-800 flex items-center justify-center">
            <img src={imageUrl} alt="ad" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className="w-full h-44 bg-gradient-to-br from-gray-700/60 via-gray-700/40 to-gray-700/20 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold">AD</div>
              <span className="text-lg font-bold text-cyan-300">쿠팡 파트너스</span>
            </div>
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="text-xs text-gray-300 bg-gray-900/40 p-2 rounded-md leading-relaxed">
            이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
          </div>
          <div className="flex items-center gap-1 text-cyan-300 text-sm">
            <ExternalLink className="w-4 h-4" />
            <span>바로 이동</span>
          </div>
        </div>
      </div>
    </a>
  );
};

export default AdCard;



