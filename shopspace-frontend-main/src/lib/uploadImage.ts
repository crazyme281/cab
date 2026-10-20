import { supabase } from './supabase';

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// crypto.randomUUID only exists in secure contexts (https / localhost); fall
// back so testing over a plain-http LAN address doesn't crash the upload.
const uniqueName = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Uploads a listing photo to the public `product-images` bucket under the
 * signed-in user's own folder and returns its public URL.
 */
export const uploadProductImage = async (file: File, userId: string): Promise<string> => {
  // Derive the extension from the verified MIME type, not the file name
  // (a name with no dot used to become the extension itself).
  const ext = EXT_BY_TYPE[file.type] || 'jpg';
  const path = `${userId}/${uniqueName()}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
};
