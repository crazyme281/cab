import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type UserStatus = 'active' | 'suspended' | 'restricted' | 'deactivated';

export interface User {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  matric_number: string | null;
  profile_image: string | null;
  role: 'user' | 'admin';
  status: UserStatus;
  must_change_password: boolean;
}

interface RegisterInput {
  full_name: string;
  email: string;
  password: string;
  phone_number?: string;
  matric_number?: string;
}

interface RegisterResult {
  /** True when Supabase requires the email to be confirmed before the user can sign in. */
  needsEmailConfirmation: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (input: Partial<Pick<User, 'full_name' | 'phone_number' | 'matric_number' | 'profile_image'>>) => Promise<void>;
  completePasswordChange: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Accounts in these states may not use the app at all.
const BLOCKED_MESSAGES: Partial<Record<UserStatus, string>> = {
  suspended: 'This account has been suspended',
  deactivated: 'This account has been deactivated',
};

// Loads (or waits for) the public.users profile row for a given auth user id.
// Right after sign-up the handle_new_user trigger may not have committed
// yet, so we retry briefly instead of failing outright.
const loadProfile = async (userId: string): Promise<User | null> => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return data as User;
    if (error && attempt === 4) throw error;
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Mirrors `user` so the auth listener can tell "same person, token refreshed"
  // from "someone new signed in" without re-creating the listener.
  const userIdRef = useRef<string | null>(null);

  const applyUser = useCallback((profile: User | null) => {
    userIdRef.current = profile?.user_id ?? null;
    setUser(profile);
  }, []);

  // Applies a freshly loaded profile, signing the person out if their account
  // has been suspended/deactivated since they last logged in.
  const acceptProfile = useCallback(
    async (profile: User | null): Promise<string | null> => {
      const blocked = profile ? BLOCKED_MESSAGES[profile.status] : undefined;
      if (blocked) {
        await supabase.auth.signOut();
        applyUser(null);
        return blocked;
      }
      applyUser(profile);
      return null;
    },
    [applyUser]
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id).catch(() => null);
        if (mounted) await acceptProfile(profile);
      }
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Never await Supabase calls directly inside this callback — supabase-js
      // holds an internal lock while it runs and a nested call can deadlock.
      // Deferring with setTimeout lets the lock release first.
      setTimeout(async () => {
        if (!mounted) return;
        if (!session?.user) {
          applyUser(null);
          return;
        }
        // supabase-js re-fires SIGNED_IN whenever the tab regains focus and
        // TOKEN_REFRESHED hourly. Reloading the profile each time produced a
        // brand-new `user` object, which re-ran page effects and wiped
        // half-typed forms (e.g. Edit listing). Same person → nothing to do.
        if (event === 'TOKEN_REFRESHED' || session.user.id === userIdRef.current) return;
        const profile = await loadProfile(session.user.id).catch(() => null);
        if (mounted) await acceptProfile(profile);
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [acceptProfile, applyUser]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Login failed');

    const profile = await loadProfile(data.user.id).catch(() => null);
    if (!profile) {
      await supabase.auth.signOut();
      throw new Error('We could not load your account. Please try again.');
    }
    const blocked = await acceptProfile(profile);
    if (blocked) throw new Error(blocked);
  };

  const register = async (input: RegisterInput): Promise<RegisterResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.full_name,
          phone_number: input.phone_number || null,
          matric_number: input.matric_number || null,
        },
      },
    });
    if (error) throw new Error(error.message);

    // With email confirmation switched on, signUp succeeds but returns no
    // session. Row-level security would hide the profile row from us, so don't
    // wait on it — tell the caller to ask the person to confirm their email.
    if (!data.session) return { needsEmailConfirmation: true };

    if (data.user) {
      const profile = await loadProfile(data.user.id).catch(() => null);
      applyUser(profile);
    }
    return { needsEmailConfirmation: false };
  };

  const logout = async () => {
    applyUser(null);
    await supabase.auth.signOut();
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const profile = await loadProfile(session.user.id).catch(() => null);
    if (profile) await acceptProfile(profile);
  };

  const updateProfile = async (
    input: Partial<Pick<User, 'full_name' | 'phone_number' | 'matric_number' | 'profile_image'>>
  ) => {
    if (!user) throw new Error('Not signed in');
    // Store empty optional fields as NULL rather than ''
    const clean = Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v])
    );
    const { data, error } = await supabase
      .from('users')
      .update(clean)
      .eq('user_id', user.user_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    applyUser(data as User);
  };

  const completePasswordChange = async (newPassword: string) => {
    if (!user) throw new Error('Not signed in');

    const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
    if (authError) throw new Error(authError.message);

    const { data, error } = await supabase
      .from('users')
      .update({ must_change_password: false })
      .eq('user_id', user.user_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    applyUser(data as User);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser, updateProfile, completePasswordChange }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
