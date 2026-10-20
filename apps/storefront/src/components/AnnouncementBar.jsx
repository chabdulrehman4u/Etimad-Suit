import React from 'react';
import { useStore } from '../context/StoreContext';

export const AnnouncementBar = () => {
  const { storeConfig } = useStore();
  const topbar = storeConfig?.topbar;

  if (!topbar || topbar.isEnabled === false || !topbar.announcementText) {
    return null;
  }

  const bgColor = topbar.backgroundColor || 'var(--color-primary, #0284c7)';
  const textColor = topbar.textColor || '#ffffff';

  return (
    <div
      style={{ backgroundColor: bgColor, color: textColor }}
      className="text-center py-2 px-4 text-xs font-medium tracking-wide transition-colors"
    >
      {topbar.announcementLink ? (
        <a href={topbar.announcementLink} className="hover:underline">
          {topbar.announcementText}
        </a>
      ) : (
        <span>{topbar.announcementText}</span>
      )}
    </div>
  );
};

