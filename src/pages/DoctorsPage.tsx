import { useState, useEffect } from 'react';
import { MdAdd, MdDelete, MdEdit, MdCheck, MdClose } from 'react-icons/md';
import { getDoctors, addDoctor, deleteDoctor, updateDoctor } from '../services/doctorService';
import type { Doctor } from '../services/doctorService';

export const DoctorsPage = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newDoctorName, setNewDoctorName] = useState('');
  const [editingDoctorId, setEditingDoctorId] = useState<number | null>(null);
  const [editingDoctorName, setEditingDoctorName] = useState('');

  useEffect(() => {
    getDoctors().then(setDoctors);
  }, []);

  const handleAddDoctor = async () => {
    if (!newDoctorName.trim()) return;
    await addDoctor(newDoctorName.trim());
    setDoctors(await getDoctors());
    setNewDoctorName('');
  };

  const handleDeleteDoctor = async (id: number) => {
    await deleteDoctor(id);
    setDoctors((prev) => prev.filter((d) => d.id !== id));
  };

  const handleUpdateDoctor = async (id: number) => {
    if (!editingDoctorName.trim()) return;
    await updateDoctor(id, editingDoctorName.trim());
    setDoctors((prev) => prev.map((d) => d.id === id ? { ...d, name: editingDoctorName.trim() } : d));
    setEditingDoctorId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">فريق الأطباء</h1>
          <p className="text-gray-500 dark:text-gray-400">إدارة فريق الأطباء</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="flex gap-2 mb-4">
            <button onClick={handleAddDoctor} className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-1">
              <MdAdd className="w-4 h-4" /> إضافة
            </button>
            <input type="text" value={newDoctorName} onChange={(e) => setNewDoctorName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddDoctor()}
              placeholder="اسم الطبيب الجديد" className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-600 focus:border-gray-300" />
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {doctors.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-2.5 gap-2">
                <div className="flex gap-1">
                  {editingDoctorId === doc.id ? (
                    <>
                      <button onClick={() => handleUpdateDoctor(doc.id)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"><MdCheck className="w-4 h-4" /></button>
                      <button onClick={() => setEditingDoctorId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><MdClose className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingDoctorId(doc.id); setEditingDoctorName(doc.name); }} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><MdEdit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteDoctor(doc.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><MdDelete className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
                {editingDoctorId === doc.id
                  ? <input type="text" value={editingDoctorName} onChange={(e) => setEditingDoctorName(e.target.value)} className="flex-1 px-2 py-1 border border-blue-300 dark:border-blue-600 rounded-lg text-sm focus:outline-none bg-white dark:bg-gray-700 dark:text-gray-200" />
                  : <p className="text-sm font-medium text-gray-900 dark:text-white">{doc.name}</p>
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
