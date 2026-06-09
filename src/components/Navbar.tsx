import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase/supabase.ts';
import { toast } from 'react-hot-toast';
import { IoHome, IoLogOut } from 'react-icons/io5';
import { MdLeaderboard, MdScience, MdAssignment, MdLocalOffer, MdAdminPanelSettings, MdDarkMode, MdLightMode, MdAssignmentReturn, MdCalendarMonth } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useDarkMode } from '../context/DarkModeContext';

const navLinks = [
  { path: '/home',            label: 'الرئيسية',         icon: IoHome },
  { path: '/leads',           label: 'العملاء',           icon: MdLeaderboard },
  { path: '/appointments',    label: 'الحجوزات',          icon: MdCalendarMonth },
  { path: '/lab',             label: 'المعمل',            icon: MdScience },
  { path: '/leave',           label: 'الإجازات',          icon: MdAssignment },
  { path: '/offers',          label: 'العروض',            icon: MdLocalOffer },
];

const adminLinks = [
  { path: '/return-requests', label: 'الاسترجاع',         icon: MdAssignmentReturn },
  { path: '/permissions',     label: 'الصلاحيات',         icon: MdAdminPanelSettings },
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
      setCurrentTime(now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true }));
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
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      location.pathname === path
        ? 'bg-slate-700 text-white shadow-sm'
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm" dir="rtl">
      <div className="max-w-[1400px] mx-auto px-6">

        {/* الصف الأول: الهوية + الوقت + الإجراءات */}
        <div className="flex items-center justify-between h-14 border-b border-gray-100 dark:border-gray-800">

          {/* الشعار + اسم المستخدم */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-slate-600 to-slate-800 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div className="leading-tight">
              <p className="text-xs text-gray-400 dark:text-gray-500">أهلاً،</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{user?.name}</p>
            </div>
          </div>

          {/* الوقت والتاريخ */}
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white font-mono leading-none">{currentTime}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{currentDate}</p>
          </div>

          {/* الإجراءات */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {dark ? <MdLightMode className="w-5 h-5" /> : <MdDarkMode className="w-5 h-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              <IoLogOut className="w-4 h-4" />
              خروج
            </button>
          </div>
        </div>

        {/* الصف الثاني: روابط التنقل */}
        <div className="flex items-center gap-1 h-11 overflow-x-auto">
          {navLinks.map(({ path, label, icon: Icon }) => (
            <button key={path} onClick={() => navigate(path)} className={linkClass(path)}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}

          {user?.isAdmin && (
            <>
              <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
              {adminLinks.map(({ path, label, icon: Icon }) => (
                <button key={path} onClick={() => navigate(path)} className={linkClass(path)}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </>
          )}
        </div>

      </div>
    </nav>
  );
};
