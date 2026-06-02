import { supabase } from '../utils/supabase/supabase';

export interface Lead {
  id: number;
  name: string;
  phone: string;
  status: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

export type NewLead = Omit<Lead, 'id' | 'created_at' | 'updated_at'>;

export const getLeads = async (): Promise<Lead[]> => {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
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

export const deleteLead = async (id: number): Promise<void> => {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
};

export interface Profile {
  id: string;
  name: string;
  role: string;
  can_edit_lab: boolean;
}

export const getEmployees = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, can_edit_lab')
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
