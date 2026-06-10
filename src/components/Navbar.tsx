import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase/supabase.ts';
import { toast } from 'react-hot-toast';
import { IoHome, IoLogOut } from 'react-icons/io5';
import { MdLeaderboard, MdScience, MdAssignment, MdLocalOffer, MdAdminPanelSettings, MdDarkMode, MdLightMode, MdAssignmentReturn, MdCalendarMonth } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';

const navLinks = [
  { path: '/home',         label: 'الرئيسية',   icon: IoHome },
  { path: '/leads',        label: 'العملاء',     icon: MdLeaderboard },
  { path: '/appointments', label: 'الحجوزات',    icon: MdCalendarMonth },
  { path: '/lab',          label: 'المعمل',      icon: MdScience },
  { path: '/leave',        label: 'الإجازات',    icon: MdAssignment },
  { path: '/offers',       label: 'العروض',      icon: MdLocalOffer },
];

const adminLinks = [
  { path: '/return-requests', label: 'الاسترجاع',  icon: MdAssignmentReturn },
  { path: '/permissions',     label: 'الصلاحيات',  icon: MdAdminPanelSettings },
];

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { dark, toggle } = useDarkMode();
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      setCurrentTime(time);
      setCurrentDate(now.toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' }));
    };
    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('تم تسجيل الخروج');
      navigate('/auth');
    } catch {
      toast.error('خطأ في تسجيل الخروج');
    }
  };

  if (location.pathname === '/auth') return null;

  const linkClass = (path: string) =>
    `w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
      location.pathname === path
        ? 'bg-slate-700 text-white shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;

  return (
    <aside className="fixed top-0 right-0 bottom-0 w-56 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-sm z-50 flex flex-col font-serif" dir="rtl">

      {/* الشعار + الساعة */}
      <div className="flex flex-col items-center pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
        <img src="/logosa.svg" alt="logo" className="w-20 h-20 object-contain" />
        <div className="w-12 border-t border-gray-100 dark:border-gray-800 my-2" />
        <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono mt-2">
          {currentTime.replace(/\s*(AM|PM)$/, '')}
          <span className="text-sm align-middle"> {currentTime.match(/(AM|PM)$/)?.[0]}</span>
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{currentDate}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">أهلاً، <span className="font-bold text-gray-700 dark:text-gray-200">{user?.name}</span></p>
      </div>

      {/* روابط التنقل */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navLinks.map(({ path, label, icon: Icon }) => (
          <button key={path} onClick={() => navigate(path)} className={linkClass(path)}>
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </button>
        ))}

        {user?.isAdmin && (
          <>
            <div className="my-2 border-t border-gray-100 dark:border-gray-800" />
            {adminLinks.map(({ path, label, icon: Icon }) => (
              <button key={path} onClick={() => navigate(path)} className={linkClass(path)}>
                <Icon className="w-5 h-5 shrink-0" />
                {label}
              </button>
            ))}
          </>
        )}
      </nav>

      {/* الجزء السفلي: اليوزر + الساعة + الإجراءات */}
      <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800 space-y-3">

        {/* الإجراءات */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          >
            {dark ? <MdLightMode className="w-5 h-5" /> : <MdDarkMode className="w-5 h-5" />}
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          >
            <IoLogOut className="w-4 h-4" />
            خروج
          </button>
        </div>
      </div>

    </aside>
  );
};
