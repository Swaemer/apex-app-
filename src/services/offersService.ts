import { supabase } from '../utils/supabase/supabase';

export interface MonthlyOffer {
  id: number;
  month_year: string;
  is_active: boolean;
  created_at: string;
}

export interface OfferService {
  id: number;
  offer_id: number;
  service_name: string;
  price: number;
  sort_order: number;
}

export const getActiveOffer = async (): Promise<MonthlyOffer | null> => {
  const { data } = await supabase
    .from('monthly_offers')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data as MonthlyOffer | null;
};

export const getAllOffers = async (): Promise<MonthlyOffer[]> => {
  const { data, error } = await supabase
    .from('monthly_offers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as MonthlyOffer[];
};

export const createOffer = async (month_year: string): Promise<MonthlyOffer> => {
  const { data, error } = await supabase
    .from('monthly_offers')
    .insert({ month_year })
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyOffer;
};

export const setActiveOffer = async (id: number): Promise<void> => {
  await supabase.from('monthly_offers').update({ is_active: false }).neq('id', id);
  const { error } = await supabase.from('monthly_offers').update({ is_active: true }).eq('id', id);
  if (error) throw error;
};

export const deleteOffer = async (id: number): Promise<void> => {
  const { error } = await supabase.from('monthly_offers').delete().eq('id', id);
  if (error) throw error;
};

export const getOfferServices = async (offer_id: number): Promise<OfferService[]> => {
  const { data, error } = await supabase
    .from('offer_services')
    .select('*')
    .eq('offer_id', offer_id)
    .order('sort_order');
  if (error) throw error;
  return data as OfferService[];
};

export const addOfferService = async (offer_id: number, service_name: string, price: number): Promise<void> => {
  const { error } = await supabase
    .from('offer_services')
    .insert({ offer_id, service_name, price });
  if (error) throw error;
};

export const updateOfferService = async (id: number, updates: Partial<OfferService>): Promise<void> => {
  const { error } = await supabase.from('offer_services').update(updates).eq('id', id);
  if (error) throw error;
};

export const deleteOfferService = async (id: number): Promise<void> => {
  const { error } = await supabase.from('offer_services').delete().eq('id', id);
  if (error) throw error;
};
