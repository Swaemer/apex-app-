import { AuthForm } from '../components/AuthForm';

export const AuthPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col items-center justify-center px-4 py-8" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-5.5">تسويق صفوة أمينة</h1>
          <p className="text-gray-500 text-base">الكل يعالج بس مو الكل يعرف يسوق</p>
        </div>
        <AuthForm />
        <div className="text-center mt-8 text-xs text-gray-400">
          <p>© 1996 Semry. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </div>
  );
};
