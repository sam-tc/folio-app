import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  AuthError,
  Session,
  User,
} from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

type AuthResult = {
  error: AuthError | null;
};

type SignUpResult = AuthResult & {
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;

  signUp: (
    email: string,
    password: string
  ) => Promise<SignUpResult>;

  signIn: (
    email: string,
    password: string
  ) => Promise<AuthResult>;

  verifyEmailCode: (
    email: string,
    code: string
  ) => Promise<AuthResult>;

  resendSignUpCode: (
    email: string
  ) => Promise<AuthResult>;

  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [session, setSession] =
    useState<Session | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;

        setSession(nextSession);
        setLoading(false);
      }
    );

    async function restoreSession() {
      try {
        const { data, error } =
          await supabase.auth.getSession();

        if (!active) return;

        if (error) {
          console.warn(
            'Could not restore auth session:',
            error.message
          );
        }

        setSession(data.session);
      } catch (error) {
        if (!active) return;

        console.warn(
          'Auth session restoration failed:',
          error
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signUp(
    email: string,
    password: string
  ): Promise<SignUpResult> {
    const { data, error } =
      await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });

    return {
      error,
      needsEmailConfirmation:
        !error && data.session === null,
    };
  }

  async function signIn(
    email: string,
    password: string
  ): Promise<AuthResult> {
    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

    return { error };
  }

  async function verifyEmailCode(
    email: string,
    code: string
  ): Promise<AuthResult> {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });

    // Supabase creates an authenticated session
    // after successful verification.
    //
    // onAuthStateChange updates the session above.
    // Our protected navigation then opens Folio.

    return { error };
  }

  async function resendSignUpCode(
    email: string
  ): Promise<AuthResult> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });

    return { error };
  }

  async function signOut(): Promise<AuthResult> {
    const { error } = await supabase.auth.signOut();

    return { error };
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signUp,
      signIn,
      verifyEmailCode,
      resendSignUpCode,
      signOut,
    }),
    [session, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.'
    );
  }

  return context;
}
