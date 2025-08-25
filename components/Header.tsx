import React from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Globe, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isCurrentUserAdmin } from '../firebase';

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { auth } = await import('../firebase');
      unsub = auth.onAuthStateChanged(async () => {
        const admin = await isCurrentUserAdmin();
        setIsAdmin(admin);
      });
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ko' ? 'en' : 'ko');
  };

  return (
    <header className="py-6 bg-gray-900/50 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-20">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="flex items-center justify-center gap-4">
          <a href="/" className="flex items-center gap-4">
            <Award className="w-8 h-8 text-yellow-400" />
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">
                {t('app_title')}
              </h1>
            </div>
          </a>
          <span className="hidden sm:inline text-sm text-gray-300/90 border-l border-gray-700 pl-3">
            {t('app_description')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" className="hidden sm:inline px-3 py-2 text-gray-300 hover:text-white transition-colors">{t('nav_home') || 'Home'}</a>
          <a href="/about" className="hidden sm:inline px-3 py-2 text-gray-300 hover:text-white transition-colors">{t('nav_about') || 'About'}</a>
          <a href="/play" className="hidden sm:inline px-3 py-2 text-gray-300 hover:text-white transition-colors">{t('nav_play') || 'Play'}</a>
          {isAdmin && (
            <a href="/admin" className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors">
              <Shield className="w-5 h-5" /> Admin
            </a>
          )}
          <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Globe className="w-5 h-5" />
          <span>{i18n.language === 'ko' ? 'English' : '한국어'}</span>
        </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
