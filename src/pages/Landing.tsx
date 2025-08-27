import React, { useEffect, useState } from 'react';
import Header from '../../components/Header';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Award, Shield, TrendingUp } from 'lucide-react';

const Landing: React.FC = () => {
  const { t } = useTranslation();
  const [noiseSeed, setNoiseSeed] = useState<number>(() => Math.floor(Math.random() * 1000));
  useEffect(() => {
    const interval = setInterval(() => {
      setNoiseSeed(Math.floor(Math.random() * 1000));
    }, 7000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-10">
        <section className="relative text-center py-16 sm:py-20 overflow-hidden rounded-2xl bg-gray-900/40 border border-gray-800">
          {/* Animated geometric background layer (enhanced visibility) */}
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <div className="absolute inset-0 geo-mesh mix-blend-screen" />
            <div className="absolute inset-0 geo-dots mix-blend-overlay" />
            <div className="geo-radials" />
            {/* Unpredictable animated noise + displacement */}
            <div className="absolute inset-0 opacity-[0.55] mix-blend-soft-light">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <filter id="f-noise">
                    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.01" numOctaves="2" seed={noiseSeed as any} result="noise">
                      <animate attributeName="baseFrequency" values="0.006 0.01;0.02 0.006;0.008 0.02;0.006 0.01" dur="12s" repeatCount="indefinite"/>
                    </feTurbulence>
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="6">
                      <animate attributeName="scale" values="6;14;4;10;6" dur="16s" repeatCount="indefinite"/>
                    </feDisplacementMap>
                  </filter>
                  <linearGradient id="g-stripes" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(34,211,238,0.18)"/>
                    <stop offset="50%" stopColor="rgba(250,204,21,0.14)"/>
                    <stop offset="100%" stopColor="rgba(16,185,129,0.18)"/>
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="100" height="100" fill="url(#g-stripes)" filter="url(#f-noise)">
                  <animateTransform attributeName="transform" type="translate" values="0 0; 2 -1; -3 4; 0 0" dur="20s" repeatCount="indefinite"/>
                </rect>
              </svg>
            </div>
            {/* Conic swirls for flashy motion */}
            <div className="absolute -inset-32 conic-swirls" />
          </div>
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
          {/* Local styles for geometric animated background */}
          <style>{`
            @keyframes pan {
              0% { background-position: 0px 0px, 0px 0px, 0px 0px; }
              50% { background-position: 200px 120px, -180px -110px, 90px -140px; }
              100% { background-position: 0px 0px, 0px 0px, 0px 0px; }
            }
            @keyframes slowRotate {
              0% { transform: translate(-50%, -50%) rotate(0deg); }
              100% { transform: translate(-50%, -50%) rotate(360deg); }
            }
            @keyframes spinA { from { transform: rotate(0deg) scale(1.05); } to { transform: rotate(360deg) scale(1.05); } }
            @keyframes spinB { from { transform: rotate(360deg) scale(1); } to { transform: rotate(0deg) scale(1); } }
            .geo-mesh {
              background:
                repeating-linear-gradient(60deg, rgba(56,189,248,0.18) 0 2px, transparent 2px 40px),
                repeating-linear-gradient(-60deg, rgba(250,204,21,0.16) 0 2px, transparent 2px 40px),
                repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 32px);
              animation: pan 28s linear infinite;
              -webkit-mask-image: radial-gradient(100% 70% at 50% 50%, rgba(0,0,0,0.95) 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0) 100%);
              mask-image: radial-gradient(100% 70% at 50% 50%, rgba(0,0,0,0.95) 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0) 100%);
            }
            .geo-dots {
              background:
                radial-gradient(rgba(99,102,241,0.24) 1px, transparent 1px),
                radial-gradient(rgba(34,211,238,0.20) 1px, transparent 1px);
              background-size: 24px 24px, 32px 32px;
              background-position: 0 0, 12px 12px;
              animation: pan 40s linear infinite reverse;
              opacity: 0.6;
            }
            .geo-radials {
              position: absolute;
              inset: -10%;
              left: 50%;
              top: 50%;
              width: 140%;
              height: 140%;
              transform: translate(-50%, -50%);
              background:
                radial-gradient(550px 380px at 15% 20%, rgba(56,189,248,0.16), transparent 60%),
                radial-gradient(500px 340px at 85% 25%, rgba(250,204,21,0.14), transparent 60%),
                radial-gradient(600px 420px at 50% 75%, rgba(16,185,129,0.12), transparent 60%);
              animation: slowRotate 60s linear infinite;
              pointer-events: none;
            }
            .conic-swirls {
              position: absolute;
              inset: -25%;
              background:
                conic-gradient(from 0deg at 20% 30%, rgba(34,211,238,0.12), transparent 40%),
                conic-gradient(from 90deg at 80% 20%, rgba(250,204,21,0.10), transparent 55%),
                conic-gradient(from 180deg at 50% 80%, rgba(16,185,129,0.10), transparent 50%);
              filter: blur(24px) saturate(110%);
              transform-origin: 50% 50%;
              animation: spinA 33s linear infinite, spinB 47s linear infinite reverse;
            }
          `}</style>
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
            <TrendingUp className="w-8 h-8 text-emerald-400 mb-3" />
            <h3 className="text-xl font-bold mb-2">{t('landing_feat_pace_title') || 'Rising Reward Value'}</h3>
            <p className="text-gray-300 text-sm">{t('landing_feat_pace_desc') || 'Rewards become more valuable as challenges accumulate.'}</p>
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


