import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnnouncementDetailDialog } from '@/views/announcements/AnnouncementDetailDialog';
import type { Announcement } from '@/lib/notifications/announcements';

const base: Announcement = {
  id: 'a1',
  title: 'GSTR-3B due',
  body: 'File GSTR-3B for September by 20 Oct.',
  kind: 'deadline',
  origin: 'manual',
  sourceId: null,
  sourceName: null,
  sourceUrl: null,
  authorId: 'u1',
  authorName: 'Pranay Rao',
  authorRole: 'manager',
  publishedAt: '2026-10-14T09:00:00.000Z',
  createdAt: '2026-10-14T09:00:00.000Z',
};
const second: Announcement = { ...base, id: 'a2', title: 'MCA portal down', kind: 'mca' };

describe('AnnouncementDetailDialog', () => {
  it('heads the dialog with the title, shows the sender and steps through the list', () => {
    const onGo = vi.fn();
    const onClose = vi.fn();
    render(<AnnouncementDetailDialog items={[base, second]} currentId="a1" onGo={onGo} onClose={onClose} />);
    expect(screen.getByRole('heading', { name: 'GSTR-3B due' })).toBeTruthy();
    expect(screen.getByText('File GSTR-3B for September by 20 Oct.')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous announcement' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next announcement' }));
    expect(onGo).toHaveBeenCalledWith(second);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when no announcement is open', () => {
    render(<AnnouncementDetailDialog items={[base]} currentId={null} onGo={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
