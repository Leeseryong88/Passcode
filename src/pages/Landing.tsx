import React from 'react';
import Header from '../../components/Header';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Award, Shield, Zap } from 'lucide-react';

const Landing: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <section className="text-center py-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{t('landing_title') || 'Solve. Learn. Win.'}</span>
          </h1>
          <p className="text-gray-300 max-w-2xl mx-auto mb-8">
            {t('landing_subtitle') || 'Cryptography-inspired image puzzles with one-time rewards and a global leaderboard.'}
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/play" className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-6 py-3 rounded-lg">
              {t('landing_cta_start') || 'Start Playing'}
              <ArrowRight className="w-5 h-5" />
            </a>
            <a href="/about" className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg">
              {t('landing_cta_learn') || 'Learn More'}
            </a>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
            <Award className="w-8 h-8 text-yellow-400 mb-3" />
            <h3 className="text-xl font-bold mb-2">{t('landing_feat_rewards_title') || 'Real Rewards'}</h3>
            <p className="text-gray-300 text-sm">{t('landing_feat_rewards_desc') || 'One-time reveal rewards per puzzle. Claim quickly and securely.'}</p>
          </div>
          <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
            <Shield className="w-8 h-8 text-cyan-400 mb-3" />
            <h3 className="text-xl font-bold mb-2">{t('landing_feat_security_title') || 'Security First'}</h3>
            <p className="text-gray-300 text-sm">{t('landing_feat_security_desc') || 'Clear guidance and warnings to protect your secret phrases.'}</p>
          </div>
          <div className="p-6 bg-gray-800 rounded-xl border border-gray-700">
            <Zap className="w-8 h-8 text-emerald-400 mb-3" />
            <h3 className="text-xl font-bold mb-2">{t('landing_feat_pace_title') || 'Fast & Smooth'}</h3>
            <p className="text-gray-300 text-sm">{t('landing_feat_pace_desc') || 'Optimized UX with filters, skeletons, and accessible modals.'}</p>
          </div>
        </section>
      </main>
      <footer className="text-center p-6 text-gray-500 text-sm">
        <p>{t('footer_conceptual')}</p>
      </footer>
    </div>
  );
};

export default Landing;


