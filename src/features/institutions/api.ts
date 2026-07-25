import { supabase } from '@/lib/supabase'

export interface InstitutionCategory {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export interface Institution {
  id: number
  category_id: number
  name: string
  sort_order: number
  is_active: boolean
}

export async function fetchCategories(): Promise<InstitutionCategory[]> {
  const { data, error } = await supabase
    .from('institution_category')
    .select('id, name, sort_order, is_active')
    .order('sort_order')
    .order('id')
  if (error) throw error
  return data
}

export async function fetchInstitutions(): Promise<Institution[]> {
  const { data, error } = await supabase
    .from('institution')
    .select('id, category_id, name, sort_order, is_active')
    .order('sort_order')
    .order('id')
  if (error) throw error
  return data
}

export async function createCategory(name: string): Promise<void> {
  const { error } = await supabase.from('institution_category').insert({ name })
  if (error) throw error
}

export async function createInstitution(categoryId: number, name: string): Promise<void> {
  const { error } = await supabase
    .from('institution')
    .insert({ category_id: categoryId, name })
  if (error) throw error
}

export async function renameInstitution(id: number, name: string): Promise<void> {
  const { error } = await supabase.from('institution').update({ name }).eq('id', id)
  if (error) throw error
}

export async function setInstitutionActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('institution')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw error
}
