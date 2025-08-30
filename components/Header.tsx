import React from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Globe, Shield, Menu, X, Instagram } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isCurrentUserAdmin } from '../firebase';

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      <div className="container mx-auto px-4 flex justify-between items-center relative">
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
          {/* Desktop nav */}
          <a href="/" className="hidden sm:inline px-3 py-2 text-gray-300 hover:text-white transition-colors">{t('nav_home') || 'Home'}</a>
          <a href="/about" className="hidden sm:inline px-3 py-2 text-gray-300 hover:text-white transition-colors">{t('nav_about') || 'About'}</a>
          {/* Board link temporarily hidden */}
          <a href="/play" className="hidden sm:inline px-3 py-2 text-gray-300 hover:text-white transition-colors">{t('nav_play') || 'Play'}</a>
          <a
            href="https://www.instagram.com/passcode_official?igsh=MWhyNjdiZXZtd3JjZw=="
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white transition-colors"
            aria-label="Instagram"
          >
            <Instagram className="w-5 h-5" />
          </a>
          {isAdmin && (
            <a href="/admin" className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors">
              <Shield className="w-5 h-5" /> Admin
            </a>
          )}
          <button
            onClick={toggleLanguage}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Globe className="w-5 h-5" />
            <span>{i18n.language === 'ko' ? 'English' : '한국어'}</span>
          </button>
          {/* Mobile menu toggle */}
          <button
            className="sm:hidden inline-flex items-center justify-center p-2 rounded-md border border-gray-700 text-gray-200 hover:bg-gray-800"
            aria-label="Toggle menu"
            onClick={() => setIsMenuOpen((v) => !v)}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {/* Mobile dropdown */}
        {isMenuOpen && (
          <div className="sm:hidden absolute left-0 right-0 top-full bg-gray-900/95 border-t border-gray-700">
            <nav className="container mx-auto px-4 py-3 flex flex-col">
              <a href="/" className="px-2 py-3 text-gray-200 hover:bg-gray-800 rounded" onClick={() => setIsMenuOpen(false)}>{t('nav_home') || 'Home'}</a>
              <a href="/about" className="px-2 py-3 text-gray-200 hover:bg-gray-800 rounded" onClick={() => setIsMenuOpen(false)}>{t('nav_about') || 'About'}</a>
              {/* Board link temporarily hidden in mobile menu */}
              <a href="/play" className="px-2 py-3 text-gray-200 hover:bg-gray-800 rounded" onClick={() => setIsMenuOpen(false)}>{t('nav_play') || 'Play'}</a>
              <a
                href="https://www.instagram.com/passcode_official?igsh=MWhyNjdiZXZtd3JjZw=="
                target="_blank"
                rel="noopener noreferrer"
                className="px-2 py-3 text-gray-200 hover:bg-gray-800 rounded inline-flex items-center gap-2"
                onClick={() => setIsMenuOpen(false)}
              >
                <Instagram className="w-5 h-5" /> Instagram
              </a>
              {isAdmin && (
                <a href="/admin" className="px-2 py-3 text-gray-200 hover:bg-gray-800 rounded" onClick={() => setIsMenuOpen(false)}>
                  Admin
                </a>
              )}
              <button
                onClick={() => { toggleLanguage(); setIsMenuOpen(false); }}
                className="mt-2 inline-flex items-center gap-2 px-3 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
              >
                <Globe className="w-5 h-5" />
                <span>{i18n.language === 'ko' ? 'English' : '한국어'}</span>
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
