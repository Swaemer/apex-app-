import { supabase } from '../utils/supabase/supabase';

export interface MonthlyTarget {
  id: number;
  month_year: string;
  target: number;
  target_amount: number;
  updated_at: string;
}

export const getMonthlyTarget = async (monthYear: string): Promise<MonthlyTarget | null> => {
  const { data, error } = await supabase
    .from('monthly_targets')
    .select('*')
    .eq('month_year', monthYear)
    .maybeSingle();
  if (error) throw error;
  return data as MonthlyTarget | null;
};

export const setMonthlyTarget = async (monthYear: string, target: number, targetAmount: number): Promise<MonthlyTarget> => {
  const { data, error } = await supabase
    .from('monthly_targets')
    .upsert({ month_year: monthYear, target, target_amount: targetAmount, updated_at: new Date().toISOString() }, { onConflict: 'month_year' })
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyTarget;
};
