import React from 'react';
import { useStore } from '../context/StoreContext';

export const Footer = () => {
  const { storeConfig } = useStore();
  const footer = storeConfig?.footer;
  const branding = storeConfig?.branding;
  const tenant = storeConfig?.tenant;

  const bgColor = footer?.backgroundColor || branding?.secondaryColor || '#0f172a';
  const textColor = footer?.textColor || '#94a3b8';
  const columns = footer?.columns || [];
  const copyright = footer?.copyrightText || `© ${new Date().getFullYear()} ${tenant?.name || 'Store'}. All rights reserved. Powered by Etimad Suit.`;

  return (
    <footer
      style={{ backgroundColor: bgColor, color: textColor }}
      className="mt-auto pt-12 pb-8 border-t border-slate-800 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info Column */}
          <div className="col-span-2 md:col-span-1 space-y-3">
            <h3 className="font-bold text-white text-base">{tenant?.name || 'Etimad Store'}</h3>
            <p className="text-xs leading-relaxed opacity-80">
              Operating with authoritative real-time inventory and official warranty support.
            </p>
            {tenant?.contactPhone && (
              <p className="text-xs">
                <span className="font-semibold text-slate-300">Helpline:</span> {tenant.contactPhone}
              </p>
            )}
            {tenant?.contactEmail && (
              <p className="text-xs">
                <span className="font-semibold text-slate-300">Support:</span> {tenant.contactEmail}
              </p>
            )}
          </div>

          {/* Dynamic Footer Columns */}
          {columns.map((col, idx) => (
            <div key={idx} className="space-y-3">
              <h4 className="font-semibold text-white text-xs uppercase tracking-wider">{col.title}</h4>
              <ul className="space-y-1.5 text-xs">
                {col.links?.map((link, lIdx) => (
                  <li key={lIdx}>
                    <a href={link.url || '#'} className="hover:text-white transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Fallback navigation if no columns customized */}
          {columns.length === 0 && (
            <>
              <div className="space-y-3">
                <h4 className="font-semibold text-white text-xs uppercase tracking-wider">Customer Care</h4>
                <ul className="space-y-1.5 text-xs">
                  <li><a href="#catalog" className="hover:text-white">Shop Online</a></li>
                  <li><a href="#" className="hover:text-white">Delivery Policy</a></li>
                  <li><a href="#" className="hover:text-white">Returns & Refunds</a></li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-white text-xs uppercase tracking-wider">Quick Links</h4>
                <ul className="space-y-1.5 text-xs">
                  <li><a href="#" className="hover:text-white">Track Order</a></li>
                  <li><a href="#" className="hover:text-white">Wholesale Inquiries</a></li>
                  <li><a href="#" className="hover:text-white">Contact Merchant</a></li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Bottom Bar & Copyright */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs opacity-75">
          <p>{copyright}</p>
          <div className="mt-3 sm:mt-0 flex items-center space-x-4">
            <span>Verified Secure Multi-Tenant Architecture</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

