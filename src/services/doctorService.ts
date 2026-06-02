import { supabase } from '../utils/supabase/supabase';

export interface Doctor {
  id: number;
  name: string;
}

export const getDoctors = async (): Promise<Doctor[]> => {
  const { data, error } = await supabase
    .from('doctors')
    .select('id, name')
    .order('created_at');
  if (error) throw error;
  return data as Doctor[];
};

export const addDoctor = async (name: string): Promise<void> => {
  const { error } = await supabase.from('doctors').insert({ name });
  if (error) throw error;
};

export const deleteDoctor = async (id: number): Promise<void> => {
  const { error } = await supabase.from('doctors').delete().eq('id', id);
  if (error) throw error;
};

export const updateDoctor = async (id: number, name: string): Promise<void> => {
  const { error } = await supabase.from('doctors').update({ name }).eq('id', id);
  if (error) throw error;
};
