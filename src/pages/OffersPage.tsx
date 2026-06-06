import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { MdAdd, MdDelete, MdEdit, MdCheck, MdClose, MdStar } from 'react-icons/md';
import {
  getActiveOffer, getAllOffers, createOffer, setActiveOffer, deleteOffer,
  getOfferServices, addOfferService, updateOfferService, deleteOfferService,
} from '../services/offersService';
import type { MonthlyOffer, OfferService } from '../services/offersService';
import { useAuth } from '../context/AuthContext';

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const currentMonthYear = () => {
  const now = new Date();
  return `${ARABIC_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
};

export const OffersPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const [offers, setOffers] = useState<MonthlyOffer[]>([]);
  const [activeOffer, setActiveOfferState] = useState<MonthlyOffer | null>(null);
  const [services, setServices] = useState<OfferService[]>([]);
  const [loading, setLoading] = useState(true);

  const [newService, setNewService] = useState({ name: '', price: '' });
  const [addingService, setAddingService] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ name: '', price: '' });

  const [newOfferName, setNewOfferName] = useState(currentMonthYear());
  const [showNewOffer, setShowNewOffer] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allOffers, active] = await Promise.all([getAllOffers(), getActiveOffer()]);
      setOffers(allOffers);
      setActiveOfferState(active);
      if (active) {
        setServices(await getOfferServices(active.id));
      }
    } catch {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateOffer = async () => {
    if (!newOfferName.trim()) return;
    try {
      const offer = await createOffer(newOfferName.trim());
      await setActiveOffer(offer.id);
      toast.success('تم إنشاء العرض');
      setShowNewOffer(false);
      loadData();
    } catch { toast.error('خطأ في الإنشاء'); }
  };

  const handleSetActive = async (id: number) => {
    try {
      await setActiveOffer(id);
      const active = offers.find((o) => o.id === id) || null;
      setActiveOfferState(active);
      if (active) setServices(await getOfferServices(active.id));
      setOffers((prev) => prev.map((o) => ({ ...o, is_active: o.id === id })));
      toast.success('تم تفعيل العرض');
    } catch { toast.error('خطأ في التفعيل'); }
  };

  const handleDeleteOffer = async (id: number) => {
    try {
      await deleteOffer(id);
      setOffers((prev) => prev.filter((o) => o.id !== id));
      if (activeOffer?.id === id) { setActiveOfferState(null); setServices([]); }
      toast.success('تم الحذف');
    } catch { toast.error('خطأ في الحذف'); }
  };

  const handleAddService = async () => {
    if (!newService.name.trim() || !newService.price) { toast.error('أدخل اسم الخدمة والسعر'); return; }
    if (!activeOffer) { toast.error('لا يوجد عرض نشط'); return; }
    setAddingService(true);
    try {
      await addOfferService(activeOffer.id, newService.name.trim(), parseFloat(newService.price));
      setServices(await getOfferServices(activeOffer.id));
      setNewService({ name: '', price: '' });
      toast.success('تمت الإضافة');
    } catch { toast.error('خطأ في الإضافة'); }
    finally { setAddingService(false); }
  };

  const handleUpdateService = async (id: number) => {
    if (!editValues.name.trim() || !editValues.price) return;
    try {
      await updateOfferService(id, { service_name: editValues.name.trim(), price: parseFloat(editValues.price) });
      setServices((prev) => prev.map((s) => s.id === id ? { ...s, service_name: editValues.name.trim(), price: parseFloat(editValues.price) } : s));
      setEditingId(null);
      toast.success('تم التحديث');
    } catch { toast.error('خطأ في التحديث'); }
  };

  const handleDeleteService = async (id: number) => {
    try {
      await deleteOfferService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      toast.success('تم الحذف');
    } catch { toast.error('خطأ في الحذف'); }
  };

  if (loading) return null;

  const inputClass = 'flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-gray-300 dark:focus:border-gray-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-1">عروض الشهر</h1>
            <p className="text-gray-500 dark:text-gray-400">{activeOffer ? activeOffer.month_year : 'لا يوجد عرض نشط'}</p>
          </div>
          {isAdmin && (
            <button onClick={() => setShowNewOffer(true)}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium flex items-center gap-2 hover:shadow-lg transition-all">
              <MdAdd className="w-5 h-5" /> عرض جديد
            </button>
          )}
        </div>

        {/* نموذج عرض جديد */}
        {isAdmin && showNewOffer && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 mb-6">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">إنشاء عرض جديد</h2>
            <div className="flex gap-3">
              <input type="text" value={newOfferName} onChange={(e) => setNewOfferName(e.target.value)}
                placeholder="مثال: يونيو 2026"
                className={inputClass} />
              <button onClick={handleCreateOffer}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium hover:shadow-md transition-all">
                إنشاء
              </button>
              <button onClick={() => setShowNewOffer(false)}
                className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* قائمة العروض — للأدمن */}
        {isAdmin && offers.length > 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">العروض السابقة</h3>
            <div className="flex flex-wrap gap-2">
              {offers.map((offer) => (
                <div key={offer.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${offer.is_active ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
                  {offer.is_active && <MdStar className="w-3.5 h-3.5" />}
                  <span>{offer.month_year}</span>
                  {!offer.is_active && (
                    <button onClick={() => handleSetActive(offer.id)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">تفعيل</button>
                  )}
                  <button onClick={() => handleDeleteOffer(offer.id)} className="text-red-400 hover:text-red-600">
                    <MdClose className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* جدول الشهر الحالي */}
        {activeOffer ? (
          <div>
            {/* بانر الشهر */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 mb-6 text-white text-right shadow-lg">
              <p className="text-white/70 text-sm mb-1">عروض</p>
              <p className="text-3xl font-bold">{activeOffer.month_year}</p>
            </div>

            {/* إضافة خدمة — للأدمن */}
            {isAdmin && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 mb-6">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">إضافة خدمة جديدة</h3>
                <div className="flex gap-3">
                  <input type="text" value={newService.name} onChange={(e) => setNewService((p) => ({ ...p, name: e.target.value }))}
                    placeholder="اسم الخدمة"
                    className={inputClass} />
                  <input type="number" value={newService.price} onChange={(e) => setNewService((p) => ({ ...p, price: e.target.value }))}
                    placeholder="السعر (ريال)"
                    className="w-36 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-gray-300" />
                  <button onClick={handleAddService} disabled={addingService}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium hover:shadow-md transition-all disabled:opacity-50 flex items-center gap-1">
                    <MdAdd className="w-4 h-4" /> إضافة
                  </button>
                </div>
              </div>
            )}

            {/* جدول الخدمات والأسعار */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
                    <th className="px-6 py-4 text-right text-sm font-bold text-amber-800 dark:text-amber-300">#</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-amber-800 dark:text-amber-300">الخدمة</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-amber-800 dark:text-amber-300">السعر</th>
                    {isAdmin && <th className="px-6 py-4 text-center text-sm font-bold text-amber-800 dark:text-amber-300">إجراء</th>}
                  </tr>
                </thead>
                <tbody>
                  {services.length > 0 ? services.map((s, i) => (
                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-400 dark:text-gray-500">{i + 1}</td>
                      <td className="px-6 py-4 text-sm">
                        {editingId === s.id ? (
                          <input type="text" value={editValues.name} onChange={(e) => setEditValues((p) => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-1.5 border border-blue-300 dark:border-blue-600 rounded-lg text-sm focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
                        ) : (
                          <span className="font-medium text-gray-900 dark:text-white">{s.service_name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {editingId === s.id ? (
                          <input type="number" value={editValues.price} onChange={(e) => setEditValues((p) => ({ ...p, price: e.target.value }))}
                            className="w-28 px-3 py-1.5 border border-blue-300 dark:border-blue-600 rounded-lg text-sm focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
                        ) : (
                          <span className="font-bold text-amber-600 dark:text-amber-400">{s.price.toLocaleString('ar-SA')} ريال</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-center">
                          {editingId === s.id ? (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleUpdateService(s.id)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"><MdCheck className="w-4 h-4" /></button>
                              <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><MdClose className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => { setEditingId(s.id); setEditValues({ name: s.service_name, price: String(s.price) }); }}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><MdEdit className="w-4 h-4" /></button>
                              <button onClick={() => handleDeleteService(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><MdDelete className="w-4 h-4" /></button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={isAdmin ? 4 : 3} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                        {isAdmin ? 'لا توجد خدمات — أضف خدمة من الأعلى' : 'لا توجد عروض حالياً'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-16 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-lg">لا يوجد عرض نشط</p>
            {isAdmin && <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">اضغط "عرض جديد" لإنشاء عروض الشهر</p>}
          </div>
        )}

      </div>
    </div>
  );
};
