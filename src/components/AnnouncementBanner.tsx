import { useState, useEffect } from 'react';
import { MdCampaign, MdCheck } from 'react-icons/md';
import { supabase } from '../utils/supabase/supabase';
import { getActiveAnnouncements, markAsRead } from '../services/announcementService';
import type { Announcement } from '../services/announcementService';
import { useAuth } from '../context/AuthContext';

export const AnnouncementBanner = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [acknowledged, setAcknowledged] = useState<number[]>([]);

  const loadAnnouncements = async () => {
    try {
      setAnnouncements(await getActiveAnnouncements());
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

  const visible = announcements.filter((a) => {
    if (acknowledged.includes(a.id)) return false;
    if (!a.target_employees || a.target_employees.length === 0) return true;
    return a.target_employees.includes(user.name);
  });

  if (visible.length === 0) return null;

  const handleAcknowledge = async (id: number) => {
    try {
      await markAsRead(id, user.name);
      setAcknowledged((prev) => [...prev, id]);
    } catch { /* ignore */ }
  };

  return (
    <div className="fixed top-[72px] right-0 left-0 z-40 flex flex-col gap-2 px-4 pt-2" dir="rtl">
      {visible.map((a) => (
        <div key={a.id}
          className="bg-red-600 text-white rounded-xl px-5 py-3 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3 flex-1">
            <MdCampaign className="w-6 h-6 flex-shrink-0" />
            <p className="text-sm font-medium leading-relaxed">{a.message}</p>
          </div>
          <button
            onClick={() => handleAcknowledge(a.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 bg-white text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors"
          >
            <MdCheck className="w-4 h-4" />
            تم الاطلاع
          </button>
        </div>
      ))}
    </div>
  );
};
