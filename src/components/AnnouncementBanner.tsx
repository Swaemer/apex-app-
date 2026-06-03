import { useState, useEffect } from 'react';
import { MdClose, MdCampaign } from 'react-icons/md';
import { supabase } from '../utils/supabase/supabase';
import { getActiveAnnouncements } from '../services/announcementService';
import type { Announcement } from '../services/announcementService';
import { useAuth } from '../context/AuthContext';

export const AnnouncementBanner = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const loadAnnouncements = async () => {
    try {
      const all = await getActiveAnnouncements();
      setAnnouncements(all);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!user) return;
    loadAnnouncements();

    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        loadAnnouncements();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!user || user.isAdmin) return null;

  // الإشعارات المستهدفة للمستخدم الحالي
  const visible = announcements.filter((a) => {
    if (dismissed.includes(a.id)) return false;
    // لو target_employees فاضية = للكل
    if (!a.target_employees || a.target_employees.length === 0) return true;
    return a.target_employees.includes(user.name);
  });

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-[72px] right-0 left-0 z-40 flex flex-col gap-2 px-4 pt-2" dir="rtl">
      {visible.map((a) => (
        <div key={a.id}
          className="bg-red-600 text-white rounded-xl px-5 py-3 flex items-center justify-between gap-4 shadow-lg animate-pulse-once">
          <div className="flex items-center gap-3">
            <MdCampaign className="w-6 h-6 flex-shrink-0" />
            <p className="text-sm font-medium leading-relaxed">{a.message}</p>
          </div>
          <button onClick={() => setDismissed((prev) => [...prev, a.id])}
            className="flex-shrink-0 p-1 hover:bg-red-700 rounded-lg transition-colors">
            <MdClose className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
};
