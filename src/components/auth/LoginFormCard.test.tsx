import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoginFormCard, type LoginFormCardProps } from './LoginFormCard';
import { DEMO_ACCOUNTS, demoLoginsOn } from './demo-accounts';

function props(over: Partial<LoginFormCardProps> = {}): LoginFormCardProps {
  const noop = () => {};
  return {
    email: '',
    password: '',
    showPassword: false,
    error: null,
    loading: false,
    forgotOpen: false,
    forgotEmail: '',
    forgotLoading: false,
    profileError: null,
    resetNotice: null,
    onEmailChange: noop,
    onPasswordChange: noop,
    onToggleShowPassword: noop,
    onSubmit: noop,
    onForgotOpenChange: noop,
    onForgotEmailChange: noop,
    onForgotSubmit: noop,
    onOpenForgot: noop,
    ...over,
  };
}

describe('LoginFormCard demo accounts', () => {
  it('turns on only for the exact flag "on"', () => {
    expect(demoLoginsOn('on')).toBe(true);
    expect(demoLoginsOn(undefined)).toBe(false);
    expect(demoLoginsOn('true')).toBe(false);
    expect(demoLoginsOn('ON ')).toBe(false);
  });

  it('hides the buttons by default', () => {
    render(<LoginFormCard {...props()} />);
    expect(screen.queryByText('Demo accounts')).toBeNull();
  });

  it('fills the email only, never the password, and focuses the password field', () => {
    const onEmailChange = vi.fn();
    const onPasswordChange = vi.fn();
    render(<LoginFormCard {...props({ showDemoAccounts: true, onEmailChange, onPasswordChange })} />);
    expect(screen.getByText('Demo accounts')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^(Client|Lead|Manager|Admin|Super admin)$/ })).toHaveLength(DEMO_ACCOUNTS.length);
    fireEvent.click(screen.getByRole('button', { name: 'Manager' }));
    expect(onEmailChange).toHaveBeenCalledWith('manager@vcfo.local');
    expect(onPasswordChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('Password'));
  });

  it('opens the dialog through onBookDemo when given', () => {
    const onBookDemo = vi.fn();
    render(<LoginFormCard {...props({ onBookDemo })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Book a demo' }));
    expect(onBookDemo).toHaveBeenCalled();
  });
});
