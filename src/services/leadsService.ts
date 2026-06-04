import { supabase } from '../utils/supabase/supabase';

export interface Lead {
  id: number;
  name: string;
  phone: string;
  service: string | null;
  status: string;
  assigned_to: string;
  notes: string | null;
  appointment_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NewLead = Omit<Lead, 'id' | 'created_at' | 'updated_at'>;

export const getLeads = async (): Promise<Lead[]> => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('id', { ascending: false });
  if (error) throw error;
  return data as Lead[];
};

export const upsertLeads = async (leads: NewLead[]): Promise<void> => {
  const { error } = await supabase
    .from('leads')
    .upsert(leads, { onConflict: 'phone', ignoreDuplicates: true });
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

export const updateLeadAssignment = async (id: number, assigned_to: string): Promise<void> => {
  const { error } = await supabase.from('leads').update({ assigned_to }).eq('id', id);
  if (error) throw error;
};

export const deleteLead = async (id: number): Promise<void> => {
  const { error } = await supabase.from('leads').delete().eq('id', id);
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
