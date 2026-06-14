import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MdCampaign, MdCelebration, MdCheck } from 'react-icons/md';
import { supabase } from '../utils/supabase/supabase';
import { getActiveAnnouncements, getReadAnnouncementIds, markAsRead } from '../services/announcementService';
import type { Announcement } from '../services/announcementService';
import { useAuth } from '../context/AuthContext';

export const AnnouncementBanner = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [acknowledged, setAcknowledged] = useState<number[]>([]);
  const [current, setCurrent] = useState(0);

  const loadAnnouncements = async () => {
    try {
      setAnnouncements(await getActiveAnnouncements());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!user) return;
    loadAnnouncements();
    getReadAnnouncementIds(user.name).then(setAcknowledged).catch(() => {});

    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
        loadAnnouncements();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!user || user.isAdmin) return null;
  if (['/auth', '/reset-password'].includes(location.pathname)) return null;

  const visible = announcements.filter((a) => {
    if (acknowledged.includes(a.id)) return false;
    if (!a.target_employees || a.target_employees.length === 0) return true;
    return a.target_employees.includes(user.name);
  });

  if (visible.length === 0) return null;

  const announcement = visible[Math.min(current, visible.length - 1)];
  const isCelebration = announcement.type === 'celebration';

  const handleAcknowledge = async (id: number) => {
    try {
      await markAsRead(id, user.name);
      setAcknowledged((prev) => [...prev, id]);
      setCurrent(0);
    } catch { /* ignore */ }
  };

  const headerColor = isCelebration ? 'bg-purple-600' : 'bg-red-600';
  const subTextColor = isCelebration ? 'text-purple-200' : 'text-red-200';
  const buttonColor = isCelebration
    ? 'bg-purple-600 hover:bg-purple-700'
    : 'bg-red-600 hover:bg-red-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* الهيدر */}
        <div className={`${headerColor} px-6 py-4 flex items-center gap-3`}>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            {isCelebration ? (
              <MdCelebration className="w-6 h-6 text-white" />
            ) : (
              <MdCampaign className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <p className="text-white font-bold text-base">{isCelebration ? '🎉 تهنئة' : 'إشعار مهم'}</p>
            {visible.length > 1 && (
              <p className={`${subTextColor} text-xs`}>{current + 1} من {visible.length}</p>
            )}
          </div>
        </div>

        {/* المحتوى */}
        <div className="px-6 py-6">
          <p className="text-gray-800 dark:text-gray-100 text-base leading-relaxed font-medium">
            {announcement.message}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            {new Date(announcement.created_at).toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* الزر */}
        <div className="px-6 pb-6">
          <button
            onClick={() => handleAcknowledge(announcement.id)}
            className={`w-full py-3 ${buttonColor} text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors`}
          >
            <MdCheck className="w-5 h-5" />
            تم الاطلاع
          </button>
        </div>

      </div>
    </div>
  );
};
