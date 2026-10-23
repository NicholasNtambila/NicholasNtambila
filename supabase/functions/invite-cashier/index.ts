import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });
  const authorization = request.headers.get('Authorization');
  if (!authorization)
    return Response.json(
      { error: 'Authentication required' },
      { status: 401, headers: corsHeaders },
    );
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user)
    return Response.json(
      { error: 'Authentication required' },
      { status: 401, headers: corsHeaders },
    );
  const { email, tenantId, branchId } = await request.json();
  const { data: membership } = await admin
    .from('business_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membership?.role !== 'owner')
    return Response.json(
      { error: 'Only the business owner can invite cashiers' },
      { status: 403, headers: corsHeaders },
    );
  const { data: token, error: tokenError } = await userClient.rpc(
    'create_cashier_invitation',
    {
      target_tenant_id: tenantId,
      invite_email: email,
      allowed_branch_ids: [branchId],
    },
  );
  if (tokenError)
    return Response.json(
      { error: tokenError.message },
      { status: 400, headers: corsHeaders },
    );
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { tenant_invitation_token: token },
      redirectTo: Deno.env.get('CASHIER_INVITE_REDIRECT_URL'),
    },
  );
  if (inviteError)
    return Response.json(
      { error: inviteError.message },
      { status: 400, headers: corsHeaders },
    );
  return Response.json({ ok: true }, { headers: corsHeaders });
});
