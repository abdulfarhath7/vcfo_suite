'use client';

import { useReducer } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { roleHomePath } from '@/lib/auth-routes';
import { toastError, toastSuccess } from '@/lib/toast-errors';

/**
 * State and actions for the sign-in page. It is the same flow as `src/views/auth/Login.tsx`:
 * Auth.js sign-in through `useApp().signIn`, the role home on success, and the error inline and as a toast.
 */
export type SignInState = {
  email: string;
  password: string;
  showPassword: boolean;
  error: string | null;
  loading: boolean;
  forgotOpen: boolean;
  forgotEmail: string;
  forgotLoading: boolean;
};

type SignInAction = { type: 'patch'; patch: Partial<SignInState> } | { type: 'toggle_show_password' };

export const initialSignInState: SignInState = {
  email: '',
  password: '',
  showPassword: false,
  error: null,
  loading: false,
  forgotOpen: false,
  forgotEmail: '',
  forgotLoading: false,
};

export function signInReducer(state: SignInState, action: SignInAction): SignInState {
  switch (action.type) {
    case 'toggle_show_password':
      return { ...state, showPassword: !state.showPassword };
    case 'patch':
      return { ...state, ...action.patch };
    default:
      return state;
  }
}

export function useSignIn() {
  const { signIn } = useApp();
  const router = useRouter();
  const [state, dispatch] = useReducer(signInReducer, initialSignInState);
  const patch = (p: Partial<SignInState>) => dispatch({ type: 'patch', patch: p });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.email || !state.password) return;
    patch({ error: null, loading: true });
    const result = await signIn(state.email, state.password);
    patch({ loading: false });

    if (result.error) {
      patch({ error: result.error });
      toastError('Sign-in failed', result.error);
      return;
    }
    if (result.user) {
      router.push(roleHomePath(result.user.role));
    }
  };

  const submitForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    patch({ forgotLoading: true });
    await new Promise((r) => setTimeout(r, 200));
    patch({ forgotLoading: false, forgotOpen: false });
    toastSuccess(
      'Ask your firm manager',
      'Email password reset is not enabled yet. After they issue a temporary password, sign in and update it under Account settings.',
    );
  };

  return {
    state,
    submit,
    submitForgotPassword,
    setEmail: (value: string) => patch({ email: value }),
    setPassword: (value: string) => patch({ password: value }),
    toggleShowPassword: () => dispatch({ type: 'toggle_show_password' }),
    setForgotOpen: (open: boolean) => patch({ forgotOpen: open }),
    setForgotEmail: (value: string) => patch({ forgotEmail: value }),
    openForgot: () => patch({ forgotEmail: state.email, forgotOpen: true }),
  };
}
