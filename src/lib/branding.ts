import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET_NAME = "panel-assets";
const LOGO_PATH = "branding/logo";

export async function getPanelLogoUrl(): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(LOGO_PATH, 60 * 60);

    if (error || !data?.signedUrl) {
      return "/logo-placeholder.svg";
    }

    return data.signedUrl;
  } catch {
    return "/logo-placeholder.svg";
  }
}

