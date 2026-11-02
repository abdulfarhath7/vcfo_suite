import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BookDemoDialog } from './BookDemoDialog';

afterEach(() => {
  vi.unstubAllGlobals();
});

function fill() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Asha Rao' } });
  fireEvent.change(screen.getByLabelText('Firm'), { target: { value: 'Northwind' } });
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'asha@firm.in' } });
}

describe('BookDemoDialog', () => {
  it('posts name, firm and email to the public route, then shows the sent state with Close', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const onOpenChange = vi.fn();
    render(<BookDemoDialog open onOpenChange={onOpenChange} />);
    expect(screen.getByRole('dialog', { name: 'Book a demo' })).toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Request sent to SBC. The reply goes to asha@firm.in.');
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/public/demo-request');
    expect(body).toEqual({ name: 'Asha Rao', email: 'asha@firm.in', company: 'Northwind', website: '' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).find((b) => b.textContent === 'Close')!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the route error and keeps the fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Too many requests.' }), { status: 429 })));
    render(<BookDemoDialog open onOpenChange={() => {}} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests.');
    expect(screen.getByLabelText('Firm')).toHaveValue('Northwind');
  });
});
