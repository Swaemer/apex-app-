import { supabase } from '../utils/supabase/supabase';

export interface ReturnRequest {
  id: number;
  reference_number: string;
  patient_name: string;
  phone: string | null;
  file_number: string | null;
  invoice_number: string | null;
  reason: string;
  doctor_name: string | null;
  status: string;
  created_at: string;
  status_changed_at: string | null;
}

export type NewReturnRequest = Omit<ReturnRequest, 'id' | 'created_at' | 'status_changed_at'>;

export const getReturnRequests = async (): Promise<ReturnRequest[]> => {
  const { data, error } = await supabase
    .from('return_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ReturnRequest[];
};

export const addReturnRequest = async (req: NewReturnRequest): Promise<void> => {
  const { error } = await supabase.from('return_requests').insert(req);
  if (error) throw error;
};

export const updateReturnStatus = async (id: number, status: string): Promise<void> => {
  const { error } = await supabase.from('return_requests').update({ status }).eq('id', id);
  if (error) throw error;
};

export const updateReturnRequest = async (id: number, data: Partial<Omit<ReturnRequest, 'id' | 'created_at' | 'reference_number'>>, prevStatus?: string): Promise<void> => {
  const payload = { ...data, ...(data.status && data.status !== prevStatus ? { status_changed_at: new Date().toISOString() } : {}) };
  const { error } = await supabase.from('return_requests').update(payload).eq('id', id);
  if (error) throw error;
};

export const deleteReturnRequest = async (id: number): Promise<void> => {
  const { error } = await supabase.from('return_requests').delete().eq('id', id);
  if (error) throw error;
};

export const generateReferenceNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RTN-${year}${month}-${rand}`;
};
