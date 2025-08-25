import React from 'react';
import Header from '../../components/Header';
import { useTranslation } from 'react-i18next';

const About: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-6">{t('about_title') || 'About Passcode'}</h1>
        <p className="text-gray-300 leading-7 mb-6">
          {t('about_intro') || 'Passcode is a cryptography-inspired puzzle playground. Solve image-based challenges to reveal one-time rewards. Learn and have fun while staying safe with clear security guidance.'}
        </p>
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-bold mb-2">{t('about_how_it_works_title') || 'How it works'}</h2>
            <ol className="list-decimal list-inside text-gray-300 space-y-1">
              <li>{t('about_how_it_works_1') || 'Browse the puzzle list with filters.'}</li>
              <li>{t('about_how_it_works_2') || 'Submit your answer; if correct, a reward is revealed once.'}</li>
              <li>{t('about_how_it_works_3') || 'Securely store any secret phrases; never share them.'}</li>
            </ol>
          </section>
          <section>
            <h2 className="text-xl font-bold mb-2">{t('about_safety_title') || 'Safety notes'}</h2>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>{t('about_safety_1') || 'Do not use real funds or sensitive keys.'}</li>
              <li>{t('about_safety_2') || 'Withdraw promptly if a reward reveals a wallet phrase.'}</li>
              <li>{t('about_safety_3') || 'Admins may remove inappropriate solver names.'}</li>
            </ul>
          </section>
        </div>
        <div className="mt-10">
          <a href="/play" className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-6 py-3 rounded-lg">{t('about_cta_play') || 'Go to puzzles'}</a>
        </div>
      </main>
      <footer className="text-center p-6 text-gray-500 text-sm">
        <p>{t('footer_conceptual')}</p>
      </footer>
    </div>
  );
};

export default About;


