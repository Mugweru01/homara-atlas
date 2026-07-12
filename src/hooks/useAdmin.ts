import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { logger } from '@/lib/production-logger';
import { checkRateLimit, recordFailedLogin, clearFailedLogins } from '@/lib/admin-rate-limiter';
import { logAdminLogin, logAdminLogout } from '@/lib/security-logger';

export interface AdminInfo {
  id: string;
  user_id: string;
  admin_role: 'super_admin' | 'senior_admin' | 'junior_admin' | 'support_admin';
  status: 'active' | 'inactive' | 'suspended' | 'pending_approval' | 'deactivated';
}

export function useAdmin() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            checkAdminStatus(session.user.id);
          }, 0);
        } else {
          setAdminInfo(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('id, user_id, admin_role, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error) {
        logger.warn('Admin check error', { error, userId });
        setAdminInfo(null);
      } else {
        setAdminInfo(data);
      }
    } catch (error) {
      logger.error('Admin status check failed', { error, userId });
      setAdminInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, adminCode: string) => {
    try {
      // Check rate limit before attempting login
      const rateLimit = await checkRateLimit(email, 'admin_login');
      
      if (!rateLimit.allowed) {
        const errorMessage = `Too many login attempts. Please try again in ${Math.ceil(rateLimit.retryAfter! / 60)} minutes.`;
        await logAdminLogin(false, email, errorMessage);
        return { error: { message: errorMessage } };
      }

      // Call edge function to verify admin code and create session
      // Use direct fetch to get better error details
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      let responseData: any;
      let responseError: any;
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/admin-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ email, adminCode })
        });

        const text = await response.text();

        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = { raw: text };
        }

        if (!response.ok) {
          responseError = {
            status: response.status,
            message: responseData?.error || `HTTP ${response.status}`,
            details: responseData?.details
          };
        }
      } catch (err: any) {
        responseError = err;
      }

      if (responseError) {
        await recordFailedLogin(email);
        const errorMsg = responseError.message || responseData?.error || 'Failed to connect to authentication service';
        await logAdminLogin(false, email, errorMsg);
        return { error: { message: errorMsg } };
      }

      if (!responseData?.success) {
        await recordFailedLogin(email);
        const errorMsg = responseData?.error || 'Invalid email or admin code';
        await logAdminLogin(false, email, errorMsg);
        return { error: { message: errorMsg } };
      }

      // If we have a magic link, use it to sign in
      if (responseData.session?.properties?.hashed_token) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: responseData.session.properties.hashed_token,
          type: 'magiclink'
        });
        
        if (verifyError) {
          await recordFailedLogin(email);
          await logAdminLogin(false, email, 'Authentication failed');
          return { error: { message: 'Authentication failed' } };
        }
      }

      // Clear failed login attempts on success
      await clearFailedLogins(email);
      await logAdminLogin(true, email);

      // Wait a moment for auth state to update, then fetch admin info
      // Also try fetching by email in case user_id isn't linked yet
      setTimeout(async () => {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          // First try by user_id
          const { data: adminByUserId, error: userError } = await supabase
            .from('admins')
            .select('id, user_id, admin_role, status')
            .eq('user_id', currentSession.user.id)
            .eq('status', 'active')
            .single();
          
          if (adminByUserId && !userError) {
            setAdminInfo(adminByUserId);
            setLoading(false);
          } else {
            // If not found by user_id, try by email (user_id might not be linked yet)
            const { data: adminByEmail, error: emailError } = await supabase
              .from('admins')
              .select('id, user_id, admin_role, status')
              .eq('email', email)
              .eq('status', 'active')
              .single();
            
            if (adminByEmail && !emailError) {
              setAdminInfo(adminByEmail);
              setLoading(false);
            } else {
              logger.warn('Admin not found after login', { userId: currentSession.user.id, email, userError, emailError });
              setLoading(false);
            }
          }
        }
      }, 500);

      return { error: null };
    } catch (err) {
      await recordFailedLogin(email);
      await logAdminLogin(false, email, 'System error');
      return { error: { message: 'Authentication failed' } };
    }
  };

  const signOut = async () => {
    await logAdminLogout();
    await supabase.auth.signOut();
    setAdminInfo(null);
  };

  const isAdmin = adminInfo !== null && adminInfo.status === 'active';
  const isSuperAdmin = isAdmin && adminInfo?.admin_role === 'super_admin';
  const isSeniorAdmin = isAdmin && (adminInfo?.admin_role === 'super_admin' || adminInfo?.admin_role === 'senior_admin');

  return {
    user,
    session,
    adminInfo,
    loading,
    isAdmin,
    isSuperAdmin,
    isSeniorAdmin,
    signIn,
    signOut,
  };
}
