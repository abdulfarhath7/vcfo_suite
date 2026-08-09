export type Role = 'admin' | 'client';

export interface Client {
  id: string;
  name: string;
  initials: string;
  stage: 'Pre-Incorporation' | 'Post-Incorporation' | 'Operational Readiness';
  unread: number;
  incorporationDate: string | null;
  nature: string;
  shareCapital: number;
}

/** Empty — real leads come from /api/admin/interns. Kept for type compatibility. */
export const teamMembers: Array<{ id: string; name: string; initials: string }> = [];

/** Empty — client roster is engagement-backed, not this seed list. */
export const clients: Client[] = [];
