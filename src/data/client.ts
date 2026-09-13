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

