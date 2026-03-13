import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchSiteConfig() {
  const { data, error } = await supabase.from("site_config").select("*").single();
  if (error) return null;
  return data;
}

export async function fetchHero() {
  const { data, error } = await supabase.from("hero").select("*").single();
  if (error) return null;
  return data;
}

export async function fetchAbout() {
  const { data, error } = await supabase.from("about").select("*").single();
  if (error) return null;
  return data;
}

export async function fetchSkills() {
  const { data, error } = await supabase.from("skills").select("*").order("sort_order", { ascending: true });
  if (error) return [];
  return data;
}

export async function fetchExperience() {
  const { data, error } = await supabase.from("experience").select("*").order("sort_order", { ascending: true });
  if (error) return [];
  return data;
}

export async function fetchProjects() {
  const { data, error } = await supabase.from("projects").select("*").order("sort_order", { ascending: true });
  if (error) return [];
  return data;
}

export async function fetchSocialLinks() {
  const { data, error } = await supabase.from("social_links").select("*").order("sort_order", { ascending: true });
  if (error) return [];
  return data;
}

export async function fetchContact() {
  const { data, error } = await supabase.from("contact").select("*").single();
  if (error) return null;
  return data;
}

export async function fetchEducation() {
  const { data, error } = await supabase.from("education").select("*").order("sort_order", { ascending: true });
  if (error) return [];
  return data;
}

export async function fetchTestimonials() {
  const { data, error } = await supabase.from("testimonials").select("*").order("sort_order", { ascending: true });
  if (error) return [];
  return data;
}

export async function fetchSectionOrder() {
  const { data, error } = await supabase.from("section_order").select("*").order("position", { ascending: true });
  if (error) return [];
  return data;
}

export async function updateRow(table, id, updates) {
  const { data, error } = await supabase.from(table).update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function insertRow(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

export async function upsertSingle(table, row) {
  const { data, error } = await supabase.from(table).upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return data;
}

export async function fetchResume() {
  const { data, error } = await supabase.from("resume").select("*").single();
  if (error) return null;
  return data;
}
