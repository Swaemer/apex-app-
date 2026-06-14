import { supabase } from '../utils/supabase/supabase';

export interface Lead {
  id: number;
  name: string;
  phone: string;
  service: string | null;
  city: string | null;
  status: string;
  assigned_to: string;
  notes: string | null;
  appointment_at: string | null;
  doctor: string | null;
  lead_date: string | null;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
}

export type NewLead = Omit<Lead, 'id' | 'created_at' | 'updated_at'>;

export const getLeads = async (): Promise<Lead[]> => {
  const all: Lead[] = [];
  const batch = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('is_deleted', false)
      .order('id', { ascending: false })
      .range(from, from + batch - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as Lead[]));
    if (data.length < batch) break;
    from += batch;
  }

  return all;
};

const APPOINTMENT_STATUSES = ['تم حجز الموعد', 'تم ارسال تذكير الواتساب', 'حضر', 'حضر ودفع', 'لم يحضر'];

export const getAppointmentLeads = async (assignedTo?: string): Promise<Lead[]> => {
  let query = supabase
    .from('leads')
    .select('*')
    .eq('is_deleted', false)
    .not('appointment_at', 'is', null)
    .in('status', APPOINTMENT_STATUSES)
    .order('appointment_at', { ascending: true });

  if (assignedTo) query = query.eq('assigned_to', assignedTo);

  const { data, error } = await query;
  if (error) throw error;
  return data as Lead[];
};

export const getLeadPhoneIdMap = async (): Promise<Map<string, number>> => {
  const { data, error } = await supabase
    .from('leads')
    .select('id, phone')
    .limit(1_000_000);
  if (error) throw error;
  return new Map((data as { id: number; phone: string }[]).map((r) => [r.phone, r.id]));
};

export const upsertLeads = async (leads: NewLead[]): Promise<void> => {
  const { error } = await supabase
    .from('leads')
    .upsert(leads, { onConflict: 'phone', ignoreDuplicates: true });
  if (error) throw error;
};

export const insertLeads = async (leads: NewLead[]): Promise<Lead[]> => {
  if (leads.length === 0) return [];
  const { data, error } = await supabase
    .from('leads')
    .upsert(leads, { onConflict: 'phone', ignoreDuplicates: true })
    .select();
  if (error) throw error;
  return (data as Lead[]) ?? [];
};

export const deleteLeadsByPhones = async (phones: string[]): Promise<void> => {
  const { error } = await supabase.from('leads').delete().in('phone', phones);
  if (error) throw error;
};

export const deleteLeadsByIds = async (ids: number[]): Promise<void> => {
  const { error } = await supabase.from('leads').update({ is_deleted: true }).in('id', ids);
  if (error) throw error;
};

export const upsertLeadsForce = async (leads: NewLead[]): Promise<void> => {
  const { error } = await supabase
    .from('leads')
    .upsert(leads, { onConflict: 'phone', ignoreDuplicates: false });
  if (error) throw error;
};

export const updateLeadStatus = async (id: number, status: string): Promise<void> => {
  const { error } = await supabase.from('leads').update({ status }).eq('id', id);
  if (error) throw error;
};

export const updateLeadNotes = async (id: number, notes: string): Promise<void> => {
  const { error } = await supabase.from('leads').update({ notes: notes || null }).eq('id', id);
  if (error) throw error;
};

export const updateLeadAppointment = async (id: number, appointment_at: string | null): Promise<void> => {
  const { error } = await supabase.from('leads').update({ appointment_at }).eq('id', id);
  if (error) throw error;
};

export const updateLeadDoctor = async (id: number, doctor: string | null): Promise<void> => {
  const { error } = await supabase.from('leads').update({ doctor }).eq('id', id);
  if (error) throw error;
};

export const updateLeadAssignment = async (id: number, assigned_to: string): Promise<void> => {
  const { error } = await supabase.from('leads').update({ assigned_to }).eq('id', id);
  if (error) throw error;
};

export const deleteLead = async (id: number): Promise<void> => {
  const { error } = await supabase.from('leads').update({ is_deleted: true }).eq('id', id);
  if (error) throw error;
};

export interface Profile {
  id: string;
  name: string;
  role: string;
  can_edit_lab: boolean;
  can_submit_leave: boolean;
  can_view_all_appointments: boolean;
  can_view_admin: boolean;
}

export const getEmployees = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, can_edit_lab, can_submit_leave, can_view_all_appointments, can_view_admin')
    .eq('role', 'employee')
    .order('name');
  if (error) throw error;
  return data as Profile[];
};

export const getDoctors = async (): Promise<{ name: string }[]> => {
  const { data, error } = await supabase
    .from('doctors')
    .select('name')
    .order('name');
  if (error) throw error;
  return (data ?? []) as { name: string }[];
};

export const updateLabPermission = async (id: string, can_edit_lab: boolean): Promise<void> => {
  const { error } = await supabase.from('profiles').update({ can_edit_lab }).eq('id', id);
  if (error) throw error;
};

export const getMyLabPermission = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('can_edit_lab')
    .eq('id', userId)
    .single();
  if (error) return false;
  return data?.can_edit_lab ?? false;
};
