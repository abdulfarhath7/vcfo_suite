import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
const signIn = vi.fn();
let params = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => params,
}));
vi.mock('@/context/AppContext', () => ({ useApp: () => ({ signIn }) }));
vi.mock('@/components/common/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/lib/toast-errors', () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));

import { SignInScreen } from './SignInScreen';

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
}

describe('SignInScreen', () => {
  beforeEach(() => {
    push.mockReset();
    signIn.mockReset();
    params = new URLSearchParams();
  });

  it('signs in through the app context and opens the role home', async () => {
    signIn.mockResolvedValue({ user: { role: 'intern' } });
    render(<SignInScreen />);
    expect(screen.getByRole('heading', { name: 'Sign in to your workspace' })).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Sign in' });
    expect(submit).toBeDisabled();
    fill('lead@firm.in', 'secret');
    fireEvent.click(submit);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/app/intern/today'));
    expect(signIn).toHaveBeenCalledWith('lead@firm.in', 'secret');
  });

  it('shows the sign-in error inline and stays on the page', async () => {
    signIn.mockResolvedValue({ error: 'Invalid email or password.' });
    render(<SignInScreen />);
    fill('lead@firm.in', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps the existing notices, the back link and the demo link', () => {
    params = new URLSearchParams('error=no_profile');
    render(<SignInScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent('No profile is linked to this account.');
    expect(screen.getByRole('link', { name: 'Back to site' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Book a demo' })).toHaveAttribute('href', '/contact');
    expect(screen.queryByText(/Demo accounts/)).toBeNull();
  });

  it('toggles the password and opens the forgot-password dialog', () => {
    render(<SignInScreen />);
    const pass = screen.getByLabelText('Password');
    expect(pass).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pass).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Forgot your password?' }));
    expect(screen.getByRole('dialog', { name: 'Need a new password?' })).toBeInTheDocument();
  });
});
