import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContactForm } from './ContactForm';

afterEach(() => {
  vi.unstubAllGlobals();
});

function fill() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Asha Rao' } });
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'asha@firm.in' } });
  fireEvent.change(screen.getByLabelText('Firm'), { target: { value: 'Northwind' } });
  fireEvent.change(screen.getByLabelText('How can we help?'), { target: { value: 'A GCC in Bengaluru' } });
}

describe('ContactForm (Book a demo)', () => {
  it('posts the request to the public route and confirms', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Request sent to SBC.');
    expect(fetchMock).toHaveBeenCalledWith('/api/public/demo-request', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toEqual({ name: 'Asha Rao', email: 'asha@firm.in', company: 'Northwind', message: 'A GCC in Bengaluru', website: '' });
  });

  it('shows the route error and keeps the form', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Too many requests.' }), { status: 429 })));
    render(<ContactForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many requests.'));
    expect(screen.getByLabelText('Name')).toHaveValue('Asha Rao');
  });
});
