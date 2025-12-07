import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Helper function to get CORS headers based on request origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = Deno.env.get('ADMIN_ORIGIN') || 'https://admin.homara.com';
  
  // Allow local development origins (localhost, 127.0.0.1, or local IP addresses)
  const isLocalDev = origin && (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('http://192.168.') ||
    origin.startsWith('http://10.') ||
    origin.startsWith('http://172.')
  );
  
  const corsOrigin = isLocalDev ? origin : allowedOrigin;
  
  return {
    'Access-Control-Allow-Origin': corsOrigin || allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    );

    const { email, adminCode } = await req.json();

    if (!email || !adminCode) {
      return new Response(
        JSON.stringify({ error: 'Email and admin code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch admin data with hashed code
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('user_id, email, admin_role, status, admin_code_hash, admin_code')
      .eq('email', email)
      .eq('status', 'active')
      .single();

    if (adminError || !adminData) {
      console.error('Admin lookup failed:', adminError);
      return new Response(
        JSON.stringify({ error: 'Invalid email or admin code' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin code
    // For now, we'll use the plain code stored in admin_code column
    // The hash verification can be added later once basic flow works
    let isValidCode = false;
    
    try {
      // First try to verify using the database function if hash exists
      if (adminData.admin_code_hash) {
        try {
          const { data: verifyData, error: verifyError } = await supabaseAdmin.rpc('verify_admin_code', {
            p_email: email,
            p_code: adminCode
          });
          
          if (!verifyError && verifyData === true) {
            isValidCode = true;
          } else {
            console.error('Hash verification failed, falling back to plain code:', verifyError);
          }
        } catch (rpcError) {
          console.error('RPC call error:', rpcError);
        }
      }
      
      // Fallback to plain code comparison (always check this as backup)
      if (!isValidCode && adminData.admin_code) {
        isValidCode = adminData.admin_code === adminCode;
      }
    } catch (verifyError) {
      console.error('Code verification error:', verifyError);
      // Final fallback
      if (adminData.admin_code && adminData.admin_code === adminCode) {
        isValidCode = true;
      }
    }

    if (!isValidCode) {
      return new Response(
        JSON.stringify({ error: 'Invalid email or admin code' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to find existing user_id if not linked
    let userId = adminData.user_id;
    
    if (!userId) {
      try {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (!listError && users) {
          const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
          if (existingUser) {
            userId = existingUser.id;
            
            // Ensure profile exists before linking
            const { data: existingProfile } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('id', userId)
              .single();
            
            if (!existingProfile) {
              // Create profile if it doesn't exist
              const displayName = existingUser.user_metadata?.full_name || email.split('@')[0];
              await supabaseAdmin
                .from('profiles')
                .insert({
                  id: userId,
                  email: email,
                  display_name: displayName,
                  full_name: existingUser.user_metadata?.full_name || null,
                  role: existingUser.user_metadata?.role || 'admin',
                  created_at: new Date().toISOString()
                });
            }
            
            // Link user_id to admin record
            await supabaseAdmin
              .from('admins')
              .update({ user_id: userId })
              .eq('email', email);
          }
        }
      } catch (findError) {
        console.error('Error finding user:', findError);
      }
    } else {
      // User_id is already linked, but ensure profile exists
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (!existingProfile) {
        // Profile missing, create it
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const user = users?.find(u => u.id === userId);
        if (user) {
          const displayName = user.user_metadata?.full_name || email.split('@')[0];
          await supabaseAdmin
            .from('profiles')
            .insert({
              id: userId,
              email: email,
              display_name: displayName,
              full_name: user.user_metadata?.full_name || null,
              role: user.user_metadata?.role || 'admin',
              created_at: new Date().toISOString()
            });
        }
      }
    }

    // Create a session using generateLink
    // This will work if user exists, or we'll handle the error
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });
    
    // If generateLink fails because user doesn't exist, create the user
    if (sessionError && !userId) {
      const errorMsg = sessionError.message || String(sessionError);
      const userNotFound = errorMsg.toLowerCase().includes('not found') || 
                          errorMsg.toLowerCase().includes('does not exist') ||
                          errorMsg.toLowerCase().includes('user');
      
      if (userNotFound) {
        // User doesn't exist, create it with metadata for the handle_new_user trigger
        // The trigger will create a profile entry, so we need to provide metadata
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          email_confirm: true,
          user_metadata: {
            full_name: email.split('@')[0], // Use email prefix as fallback name
            role: 'admin' // Mark as admin role for the profile
          }
        });
        
        if (createError) {
          console.error('Failed to create user:', createError);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to set up authentication: ' + (createError.message || 'Could not create user account'),
              details: createError
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (newUser?.user) {
          userId = newUser.user.id;
          
          // Ensure profile exists (trigger might have failed)
          // Check if profile exists first
          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();
          
          if (!existingProfile) {
            // Profile doesn't exist, create it manually
            const displayName = newUser.user.user_metadata?.full_name || email.split('@')[0];
            const { error: profileError } = await supabaseAdmin
              .from('profiles')
              .insert({
                id: userId,
                email: email,
                display_name: displayName,
                full_name: newUser.user.user_metadata?.full_name || null,
                role: newUser.user.user_metadata?.role || 'admin',
                created_at: new Date().toISOString()
              });
            
            if (profileError) {
              console.error('Failed to create profile:', profileError);
              // Continue anyway - we'll try to link user_id
            } else {
              console.log('Profile created successfully');
            }
          }
          
          // Now link user_id to admin record (profile exists, so FK constraint will pass)
          const { error: linkError } = await supabaseAdmin
            .from('admins')
            .update({ user_id: userId })
            .eq('email', email);
          
          if (linkError) {
            console.error('Failed to link user_id to admin:', linkError);
            // Continue anyway - user can still log in
          } else {
            console.log('Successfully linked user_id to admin');
          }
          
          // Retry generateLink now that user exists
          const { data: retrySession, error: retryError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
          });
          
          if (retryError || !retrySession) {
            return new Response(
              JSON.stringify({ 
                error: 'Failed to create session: ' + (retryError?.message || 'Unknown error'),
                details: retryError
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Use the retry session
          return new Response(
            JSON.stringify({ 
              success: true,
              session: retrySession
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Some other error with generateLink
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create session: ' + errorMsg,
            details: sessionError
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (sessionError) {
      console.error('Session error:', sessionError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create session: ' + (sessionError.message || 'Unknown error'),
          details: sessionError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!sessionData) {
      console.error('No session data returned');
      return new Response(
        JSON.stringify({ error: 'Failed to create session: No session data returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        session: sessionData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin auth error:', error);
    let errorMessage = 'Authentication failed';
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error('Error stack:', error.stack);
    } else {
      console.error('Error (not Error instance):', String(error));
      errorMessage = String(error);
    }
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? {
          name: error.name,
          message: error.message
        } : null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
