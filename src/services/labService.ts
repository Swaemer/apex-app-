import { supabase } from '../utils/supabase/supabase';

export interface LabCase {
  id: number;
  patient_name: string;
  file_number: string | null;
  lab_name: string;
  sent_date: string;
  teeth_count: number | null;
  status: string;
  received_date: string | null;
  return_date: string | null;
  created_at: string;
}

export type NewLabCase = Pick<LabCase, 'patient_name' | 'teeth_count' | 'lab_name' | 'file_number'>;

export const getLabCases = async (): Promise<LabCase[]> => {
  const { data, error } = await supabase
    .from('lab_cases')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as LabCase[];
};

export const addLabCase = async (item: NewLabCase): Promise<void> => {
  const { error } = await supabase.from('lab_cases').insert(item);
  if (error) throw error;
};

export const updateLabCase = async (id: number, updates: Partial<LabCase>): Promise<void> => {
  const { error } = await supabase.from('lab_cases').update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteLabCase = async (id: number): Promise<void> => {
  const { error } = await supabase.from('lab_cases').delete().eq('id', id);
  if (error) throw error;
};
