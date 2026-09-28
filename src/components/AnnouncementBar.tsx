import React from 'react';
import { brandInfo } from '@/data/site';

export default function AnnouncementBar() {
  if (!brandInfo.announcementsEnabled || !brandInfo.announcements || brandInfo.announcements.length === 0) {
    return null;
  }

  return (
    <div className="bg-rose text-parchment-50 py-2 overflow-hidden whitespace-nowrap relative z-[100]">
      <div className="flex animate-marquee">
        {/* Double the list to create seamless infinite loop */}
        {[...brandInfo.announcements, ...brandInfo.announcements].map((text, i) => (
          <span key={i} className="mx-8 text-xs font-medium tracking-wide flex items-center gap-2">
            <span className="w-1 h-1 bg-parchment-50 rounded-full opacity-50" />
            {text}
          </span>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 30s linear infinite;
          width: max-content;
        }
      `}} />
    </div>
  );
}
