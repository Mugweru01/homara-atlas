import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Secure CORS configuration - only allow specific origins
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ADMIN_ORIGIN') || 'https://admin.homara.com',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400', // 24 hours
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { email, adminCode } = await req.json()

    if (!email || !adminCode) {
      return new Response(
        JSON.stringify({ error: 'Email and admin code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify admin code
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('user_id, email, admin_role, status')
      .eq('email', email)
      .eq('admin_code', adminCode)
      .eq('status', 'active')
      .single()

    if (adminError || !adminData) {
      return new Response(
        JSON.stringify({ error: 'Invalid email or admin code' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a session for this user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    })

    if (sessionError) {
      console.error('Session error:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        session: sessionData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Admin auth error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
