import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

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
        console.error('Admin check error:', error);
        setAdminInfo(null);
      } else {
        setAdminInfo(data);
      }
    } catch (error) {
      console.error('Admin status check failed:', error);
      setAdminInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, adminCode: string) => {
    // First verify admin code exists in admins table
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('user_id, email, status')
      .eq('email', email)
      .eq('admin_code', adminCode)
      .eq('status', 'active')
      .single();

    if (adminError || !adminData) {
      return { error: { message: 'Invalid email or admin code' } };
    }

    // Use admin code as password for auth
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: adminCode,
    });
    
    return { error };
  };

  const signOut = async () => {
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
