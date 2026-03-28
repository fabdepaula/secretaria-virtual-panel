import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET_NAME = "panel-assets";
const LOGO_PATH = "branding/logo";
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

async function ensureUsersUpdatePermission() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Não autorizado" }, { status: 401 }),
    };
  }

  const { data: allowed, error } = await supabase.rpc("has_panel_permission", {
    permission_key: "usuarios.update",
  });

  if (error || !allowed) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Sem permissão" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

async function ensureBucketExists() {
  const { data: bucket, error } = await supabaseAdmin.storage.getBucket(BUCKET_NAME);
  if (!error && bucket) return;

  await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
    public: false,
    fileSizeLimit: `${MAX_FILE_SIZE}`,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  });
}

export async function GET() {
  try {
    await ensureBucketExists();

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(LOGO_PATH, 60 * 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ ok: true, url: "/logo-placeholder.svg" });
    }

    return NextResponse.json({ ok: true, url: data.signedUrl });
  } catch {
    // Branding não deve impedir login.
    return NextResponse.json({ ok: true, url: "/logo-placeholder.svg" });
  }
}

export async function POST(req: Request) {
  const authz = await ensureUsersUpdatePermission();
  if (!authz.ok) return authz.response;

  await ensureBucketExists();

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Arquivo não enviado" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ message: "Arquivo vazio" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { message: "Arquivo muito grande (máximo 4MB)" },
      { status: 400 }
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { message: "Formato inválido. Envie uma imagem." },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(LOGO_PATH, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { message: "Erro ao enviar logo", details: uploadError.message },
      { status: 500 }
    );
  }

  const { data: signed, error: signedErr } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(LOGO_PATH, 60 * 60);

  if (signedErr || !signed?.signedUrl) {
    return NextResponse.json({ ok: true, url: "/logo-placeholder.svg" });
  }

  return NextResponse.json({ ok: true, url: signed.signedUrl });
}

