/** The wire shape of one staff note (`/api/engagements/<id>/notes`, G-19). */
export interface EngagementNote {
  id: string;
  engagementId: string;
  body: string;
  pinned: boolean;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  /** The caller wrote this note (may edit it). */
  mine: boolean;
  /** The caller may delete this note (author, or a firm-wide admin). */
  canDelete: boolean;
}
