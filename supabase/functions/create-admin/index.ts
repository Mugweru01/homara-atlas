import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

// Helper function to get CORS headers based on request origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = Deno.env.get('ADMIN_ORIGIN') || 'https://admin.homara.com';
  
  // Allow only localhost for local development (not broad IP ranges)
  const isLocalDev = origin && (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:')
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
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get the authorization header - Supabase automatically includes this
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header. Please ensure you are logged in.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requesting user is a super admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a super admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('id, admin_role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (adminError || !adminData || adminData.admin_role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Only super admins can create other admins' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, adminRole, fullName } = await req.json() as {
      email: string;
      adminRole: 'super_admin' | 'senior_admin' | 'junior_admin' | 'support_admin';
      fullName?: string;
    };

    if (!email || !adminRole) {
      return new Response(
        JSON.stringify({ error: 'Email and admin role are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate admin role
    const validRoles = ['super_admin', 'senior_admin', 'junior_admin', 'support_admin'];
    if (!validRoles.includes(adminRole)) {
      return new Response(
        JSON.stringify({ error: 'Invalid admin role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if admin already exists
    const { data: existingAdmin } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('email', email)
      .single();

    if (existingAdmin) {
      return new Response(
        JSON.stringify({ error: 'An admin with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists in auth and get/create user
    let userId: string;
    let existingUser = false;
    
    // Try to create user - if it already exists, we'll get an error and look it up
    const randomPassword = crypto.randomUUID() + crypto.randomUUID() + '!@#';
    
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm email
      password: randomPassword,
      user_metadata: {
        full_name: fullName || email.split('@')[0],
        is_admin: true,
      },
    });

    if (createUserError) {
      // Check if user already exists
      if (createUserError.message?.includes('already registered') || createUserError.message?.includes('already exists')) {
        // User exists, find them
        try {
          const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
          const foundUser = userData?.users?.find(u => u.email === email);
          if (foundUser) {
            userId = foundUser.id;
            existingUser = true;
          } else {
            return new Response(
              JSON.stringify({ error: 'User exists but could not be found' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (lookupError) {
          return new Response(
            JSON.stringify({ error: 'Failed to find existing user account' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to create user account', details: createUserError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (newUser?.user) {
      userId = newUser.user.id;
      existingUser = false;
    } else {
      return new Response(
        JSON.stringify({ error: 'Failed to create user account - no user returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a secure admin code
    // Format: 8 characters, alphanumeric, uppercase
    // Excludes confusing characters: 0, O, I, 1
    const generateAdminCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 characters
      const array = new Uint8Array(8);
      crypto.getRandomValues(array); // Use crypto.getRandomValues for secure randomness
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(array[i] % chars.length);
      }
      return code;
    };

    const adminCode = generateAdminCode();
    
    // Hash the admin code using bcrypt
    let hashedCode: string;
    try {
      hashedCode = await bcrypt.hash(adminCode, 12);
    } catch (hashError) {
      // If admin record creation fails but user was created, we should clean up
      if (!existingUser) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (deleteError) {
          // Error cleaning up user
        }
      }
      return new Response(
        JSON.stringify({ error: 'Failed to generate admin code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin record with hashed code
    const { data: newAdmin, error: createAdminError } = await supabaseAdmin
      .from('admins')
      .insert({
        user_id: userId,
        email: email,
        full_name: fullName || email.split('@')[0],
        admin_role: adminRole,
        status: 'active',
        created_by: adminData.id,
        admin_code_hash: hashedCode,
        // Store plain code temporarily (will be removed after admin sees it)
        // This is only for the response, not for long-term storage
      })
      .select('id, email, admin_role, status')
      .single();

    if (createAdminError) {
      // If admin record creation fails but user was created, we should clean up
      if (!existingUser) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (deleteError) {
          // Error cleaning up user
        }
      }
      return new Response(
        JSON.stringify({ error: 'Failed to create admin record', details: createAdminError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return success with the admin code (only time it will be shown)
    return new Response(
      JSON.stringify({
        success: true,
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
          admin_role: newAdmin.admin_role,
          status: newAdmin.status,
        },
        admin_code: adminCode, // Return plain code so admin can manually share it
        message: 'Admin created successfully. Share the admin code with the new admin manually.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: errorMessage,
        message: 'An unexpected error occurred. Please try again or contact support.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

