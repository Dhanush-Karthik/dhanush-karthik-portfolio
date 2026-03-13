import { supabase } from "./supabase";

const BUCKET = "portfolio-assets";

export async function uploadFile(file, path) {
  const ext = file.name.split(".").pop();
  const filePath = `${path}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function deleteFile(publicUrl) {
  if (!publicUrl) return;
  try {
    const url = new URL(publicUrl);
    const parts = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`);
    if (parts.length < 2) return;
    const path = parts[1];
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // ignore delete failures
  }
}
