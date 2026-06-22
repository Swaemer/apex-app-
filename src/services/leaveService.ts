import { supabase } from '../utils/supabase/supabase';

export interface LeaveRequest {
  id: number;
  patient_name: string;
  phone: string | null;
  birth_date: string | null;
  id_number: string | null;
  days_count: number;
  doctor_name: string;
  same_day: boolean;
  leave_from: string | null;
  leave_to: string | null;
  status: string;
  created_at: string;
}

export type NewLeaveRequest = Omit<LeaveRequest, 'id' | 'status' | 'created_at'>;

export const getLeaveRequests = async (): Promise<LeaveRequest[]> => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as LeaveRequest[];
};

export const addLeaveRequest = async (req: NewLeaveRequest): Promise<void> => {
  const { error } = await supabase.from('leave_requests').insert(req);
  if (error) throw error;
};

export const updateLeaveStatus = async (id: number, status: string): Promise<void> => {
  const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
  if (error) throw error;
};

export const deleteLeaveRequest = async (id: number): Promise<void> => {
  const { error } = await supabase.from('leave_requests').delete().eq('id', id);
  if (error) throw error;
};
