import { supabase } from '../utils/supabase/supabase';

export interface Announcement {
  id: number;
  message: string;
  target_employees: string[];
  is_active: boolean;
  created_at: string;
}

export const getActiveAnnouncements = async (): Promise<Announcement[]> => {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Announcement[];
};

export const getAllAnnouncements = async (): Promise<Announcement[]> => {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Announcement[];
};

export const createAnnouncement = async (message: string, target_employees: string[]): Promise<void> => {
  const { error } = await supabase
    .from('announcements')
    .insert({ message, target_employees });
  if (error) throw error;
};

export const deactivateAnnouncement = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('announcements')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
};

export const deleteAnnouncement = async (id: number): Promise<void> => {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
};

export interface AnnouncementRead {
  user_name: string;
  read_at: string;
}

export const markAsRead = async (announcement_id: number, user_name: string): Promise<void> => {
  const { error } = await supabase
    .from('announcement_reads')
    .upsert({ announcement_id, user_name }, { onConflict: 'announcement_id,user_name' });
  if (error) throw error;
};

export const getReads = async (announcement_id: number): Promise<AnnouncementRead[]> => {
  const { data, error } = await supabase
    .from('announcement_reads')
    .select('user_name, read_at')
    .eq('announcement_id', announcement_id)
    .order('read_at');
  if (error) throw error;
  return data as AnnouncementRead[];
};
