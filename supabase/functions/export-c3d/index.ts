import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const c3dServiceUrl = Deno.env.get('C3D_SERVICE_URL') ?? '';
    if (!supabaseUrl || !serviceRoleKey || !c3dServiceUrl) {
      return new Response(JSON.stringify({ error: 'Missing required environment variables.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing bearer token.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth token.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = await req.json();
    const response = await fetch(`${c3dServiceUrl.replace(/\/$/, '')}/export/c3d`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      return new Response(JSON.stringify({ error: 'C3D service failed.', detail: body }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const buffer = await response.arrayBuffer();
    const fileName = response.headers.get('X-File-Name') ?? `${payload.sessionId ?? 'session'}.c3d`;
    const storagePath = `${user.id}/${payload.sessionId ?? 'session'}/${fileName}`;

    const upload = await admin.storage.from('clinical-exports').upload(storagePath, buffer, {
      contentType: 'application/octet-stream',
      upsert: true,
    });
    if (upload.error) {
      return new Response(JSON.stringify({ error: upload.error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('clinical_exports').insert({
      session_id: payload.sessionId,
      user_id: user.id,
      format: 'c3d',
      storage_path: storagePath,
      file_size_bytes: buffer.byteLength,
      target_system: payload.targetSystem ?? 'Visual3D',
    });

    const signed = await admin.storage.from('clinical-exports').createSignedUrl(storagePath, 60 * 60 * 24);
    return new Response(
      JSON.stringify({
        fileName,
        storagePath,
        signedUrl: signed.data?.signedUrl ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unhandled error in export-c3d function',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
