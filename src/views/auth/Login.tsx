"use client";

import { Suspense, useReducer } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { SEO } from '@/components/SEO';
import { LoginHero } from '@/components/auth/LoginHero';
import { LoginFormCard } from '@/components/auth/LoginFormCard';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { roleHomePath } from '@/lib/auth-routes';
import { toastError, toastSuccess } from '@/lib/toast-errors';

type LoginState = {
  email: string;
  password: string;
  showPassword: boolean;
  error: string | null;
  loading: boolean;
  forgotOpen: boolean;
  forgotEmail: string;
  forgotLoading: boolean;
};

type LoginAction =
  | { type: 'patch'; patch: Partial<LoginState> }
  | { type: 'toggle_show_password' };

const initialLoginState: LoginState = {
  email: '',
  password: '',
  showPassword: false,
  error: null,
  loading: false,
  forgotOpen: false,
  forgotEmail: '',
  forgotLoading: false,
};

function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case 'toggle_show_password':
      return { ...state, showPassword: !state.showPassword };
    case 'patch':
      return { ...state, ...action.patch };
    default:
      return state;
  }
}

/**
 * Suspense fallback must render the real form (not null).
 * On LAN / delayed JS, a null fallback leaves an empty login panel.
 */
export default function Login() {
  return (
    <Suspense fallback={<LoginForm resetNotice={null} profileError={null} />}>
      <LoginWithSearchParams />
    </Suspense>
  );
}

function LoginWithSearchParams() {
  const searchParams = useSearchParams();
  return (
    <LoginForm
      resetNotice={searchParams.get('reset')}
      profileError={searchParams.get('error')}
    />
  );
}

function LoginForm({
  resetNotice,
  profileError,
}: {
  resetNotice: string | null;
  profileError: string | null;
}) {
  const { signIn } = useApp();
  const router = useRouter();
  const [state, dispatch] = useReducer(loginReducer, initialLoginState);
  const { email, password, showPassword, error, loading, forgotOpen, forgotEmail, forgotLoading } = state;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    dispatch({ type: 'patch', patch: { error: null, loading: true } });
    const result = await signIn(email, password);
    dispatch({ type: 'patch', patch: { loading: false } });

    if (result.error) {
      dispatch({ type: 'patch', patch: { error: result.error } });
      toastError('Sign-in failed', result.error);
      return;
    }
    if (result.user) {
      router.push(roleHomePath(result.user.role));
    }
  };

  const submitForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'patch', patch: { forgotLoading: true } });
    await new Promise((r) => setTimeout(r, 200));
    dispatch({ type: 'patch', patch: { forgotLoading: false, forgotOpen: false } });
    toastSuccess(
      'Ask your firm manager',
      'Email password reset is not enabled yet. After they issue a temporary password, sign in and update it under Account settings.',
    );
  };

  return (
    <div
      className="flex min-h-[100dvh] flex-col overflow-x-hidden lg:grid lg:min-h-screen lg:grid-cols-[1.05fr_1fr]"
      data-role="admin"
    >
      <SEO
        title="Sign in — VCFO Suite"
        description="Sign in to VCFO Suite for engagements, filings, and client collaboration."
        path="/login"
      />

      <LoginHero variant="compact" />
      <LoginHero variant="full" />

      <div className="relative flex w-full flex-1 items-center justify-center bg-background px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10 lg:min-h-screen lg:flex-none lg:bg-raised lg:p-12 xl:p-14">
        <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
          <ThemeToggle />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-70 lg:opacity-55"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% 0%, oklch(var(--blue-600) / 0.07) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, oklch(var(--blue-100) / 0.35) 0%, transparent 50%)',
          }}
        />
        <div className="relative z-10 w-full max-w-[min(100%,420px)] sm:max-w-md md:max-w-lg lg:max-w-[420px] page-fade-up">
        <LoginFormCard
          email={email}
          password={password}
          showPassword={showPassword}
          error={error}
          loading={loading}
          forgotOpen={forgotOpen}
          forgotEmail={forgotEmail}
          forgotLoading={forgotLoading}
          profileError={profileError}
          resetNotice={resetNotice}
          onEmailChange={(value) => dispatch({ type: 'patch', patch: { email: value } })}
          onPasswordChange={(value) => dispatch({ type: 'patch', patch: { password: value } })}
          onToggleShowPassword={() => dispatch({ type: 'toggle_show_password' })}
          onSubmit={submit}
          onForgotOpenChange={(open) => dispatch({ type: 'patch', patch: { forgotOpen: open } })}
          onForgotEmailChange={(value) => dispatch({ type: 'patch', patch: { forgotEmail: value } })}
          onForgotSubmit={submitForgotPassword}
          onOpenForgot={() => dispatch({ type: 'patch', patch: { forgotEmail: email, forgotOpen: true } })}
        />
        </div>
      </div>
    </div>
  );
}
