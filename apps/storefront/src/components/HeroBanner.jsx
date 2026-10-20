import React from 'react';
import { useStore } from '../context/StoreContext';

export const HeroBanner = () => {
  const { storeConfig } = useStore();
  const sections = storeConfig?.homepage?.sections || [];
  const heroSection = sections.find((s) => s.type === 'hero' || s.type === 'banner');

  const title = heroSection?.title || storeConfig?.tenant?.name || 'Welcome to Our Store';
  const subtitle = heroSection?.settings?.subtitle || 'Discover premium products curated with quality and authenticity.';
  const ctaText = heroSection?.settings?.ctaText || 'Shop Collection';

  return (
    <div className="relative bg-gradient-to-r from-slate-900 to-slate-800 text-white py-16 px-6 sm:py-24 sm:px-12 rounded-2xl mx-4 my-6 shadow-xl overflow-hidden max-w-7xl lg:mx-auto">
      <div className="relative z-10 max-w-2xl space-y-4">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary/20 text-sky-300 border border-sky-400/30">
          Official Merchant Store
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
          {title}
        </h1>
        <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
          {subtitle}
        </p>
        <div className="pt-2">
          <a
            href="#catalog"
            className="inline-flex items-center px-6 py-3 rounded-lg font-semibold text-sm shadow-md transition-all transform hover:-translate-y-0.5 btn-primary"
          >
            {ctaText}
            <svg
              className="ml-2 w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

