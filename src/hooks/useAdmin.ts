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
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: { email, adminCode }
      });

      if (error || !data?.success) {
        await recordFailedLogin(email);
        await logAdminLogin(false, email, data?.error || 'Invalid credentials');
        return { error: { message: data?.error || 'Invalid email or admin code' } };
      }

      // If we have a magic link, use it to sign in
      if (data.session?.properties?.hashed_token) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.session.properties.hashed_token,
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
