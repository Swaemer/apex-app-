import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../utils/supabase/supabase.ts';

interface AuthFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

type AuthMode = 'signup' | 'login' | 'forgot';

export const AuthForm = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [formData, setFormData] = useState<AuthFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      toast.error('يرجى ملء جميع الحقول');
      return false;
    }
    if (!validateEmail(formData.email)) {
      toast.error('البريد الإلكتروني غير صحيح');
      return false;
    }
    if (mode === 'signup') {
      if (!formData.name.trim()) {
        toast.error('يرجى إدخال الاسم');
        return false;
      }
      if (formData.password.length < 6) {
        toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('كلمات المرور غير متطابقة');
        return false;
      }
    }
    return true;
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.email) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }
    if (!validateEmail(formData.email)) {
      toast.error('البريد الإلكتروني غير صحيح');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(`خطأ: ${error.message}`);
      } else {
        toast.success('تم إرسال رابط الاستعادة — تحقق من بريدك الإلكتروني');
        setFormData((prev) => ({ ...prev, email: '' }));
        setMode('login');
      }
    } catch {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: { name: formData.name.trim() },
          },
        });

        if (error) {
          toast.error(error.message.includes('already registered') ? 'هذا الحساب مسجل بالفعل' : `خطأ: ${error.message}`);
        } else {
          // أخرج المستخدم فوراً بعد التسجيل — لازم يسجّل دخول يدوياً
          await supabase.auth.signOut();
          toast.success('تم التسجيل! سجّل دخولك الآن');
          setFormData({ name: '', email: '', password: '', confirmPassword: '' });
          setMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          toast.error(error.message.includes('Invalid login credentials') ? 'البيانات غلط، حاول مرة ثانية' : `خطأ: ${error.message}`);
        } else {
          // تحقق من موافقة المدير
          const { data: { user: loggedUser } } = await supabase.auth.getUser();
          if (loggedUser) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('is_approved')
              .eq('id', loggedUser.id)
              .single();

            if (!profile?.is_approved) {
              await supabase.auth.signOut();
              toast.error('حسابك قيد المراجعة — تواصل مع المدير لتفعيل حسابك');
              return;
            }
          }
          toast.success('أهلاً وسهلاً!');
          setFormData({ name: '', email: '', password: '', confirmPassword: '' });
          setTimeout(() => navigate('/home'), 500);
        }
      }
    } catch {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-gray-300 dark:focus:border-gray-500 focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-700 transition-colors';

  if (mode === 'forgot') {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">استعادة كلمة المرور</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">أدخل بريدك الإلكتروني وسنرسل لك رابط الاستعادة</p>
        </div>

        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">البريد الإلكتروني</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="أدخل بريدك الإلكتروني"
              className={inputClass}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 disabled:from-gray-400 disabled:to-gray-400 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}
          </button>

          <button
            type="button"
            onClick={() => { setMode('login'); setFormData((prev) => ({ ...prev, email: '' })); }}
            className="w-full py-2.5 px-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            العودة لتسجيل الدخول
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex gap-2 mb-8">
        {(['login', 'signup'] as AuthMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all ${
              mode === m
                ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-sm'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {m === 'login' ? 'دخول' : 'تسجيل جديد'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">الاسم</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="أدخل اسمك كما هو في النظام"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">البريد الإلكتروني</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="أدخل بريدك الإلكتروني"
            className={inputClass}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">كلمة المرور</label>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                نسيت كلمة المرور؟
              </button>
            )}
          </div>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="أدخل كلمة المرور"
            className={inputClass}
          />
        </div>

        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2.5">تأكيد كلمة المرور</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword || ''}
              onChange={handleInputChange}
              placeholder="أعد كتابة كلمة المرور"
              className={inputClass}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 disabled:from-gray-400 disabled:to-gray-400 text-white font-medium rounded-lg transition-all shadow-sm hover:shadow-md"
        >
          {loading ? 'جاري المعالجة...' : mode === 'signup' ? 'تسجيل' : 'دخول'}
        </button>
      </form>
    </div>
  );
};
