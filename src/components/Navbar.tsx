import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase/supabase.ts';
import { toast } from 'react-hot-toast';
import { IoHome, IoLogOut } from 'react-icons/io5';
import { MdLeaderboard, MdScience, MdAssignment } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true })
      );
      setCurrentDate(
        now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      );
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

  return (
    <nav className="fixed top-0 right-0 left-0 bg-white border-b border-gray-200 shadow-sm z-50" dir="rtl">
      <div className="max-w-7xl mx-auto px-8 py-3">
        <div className="flex items-center justify-between">

          {/* الترحيب */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">أهلاً بك</p>
              <p className="font-bold text-gray-900 text-base">{user?.name}</p>
            </div>
          </div>

          {/* الوقت والتاريخ */}
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900 font-mono leading-tight">{currentTime}</p>
            <p className="text-xs text-gray-500 mt-0.5">{currentDate}</p>
          </div>

          {/* الروابط */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/home')}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                location.pathname === '/home'
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <IoHome className="w-5 h-5" />
              الرئيسية
            </button>

            <button
              onClick={() => navigate('/leads')}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                location.pathname === '/leads'
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <MdLeaderboard className="w-5 h-5" />
              عملاء محتملين
            </button>

            <button
              onClick={() => navigate('/lab')}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                location.pathname === '/lab'
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <MdScience className="w-5 h-5" />
              استقبال المعمل
            </button>

            <button
              onClick={() => navigate('/leave')}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${
                location.pathname === '/leave'
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <MdAssignment className="w-5 h-5" />
              طلبات الإجازة
            </button>

            <div className="h-8 w-px bg-gray-200 mx-1" />

            <button
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-all flex items-center gap-2"
            >
              <IoLogOut className="w-5 h-5" />
              خروج
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
};
