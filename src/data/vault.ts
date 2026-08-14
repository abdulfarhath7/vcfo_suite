export interface VaultFolder {
  id: string;
  name: string;
  fileCount: number;
  required: number;
}

export interface VaultDoc {
  id: string;
  folderId: string;
  name: string;
  category: string;
  uploadedBy: string;
  date: string;
  version: string;
  linkedTo: string;
  sizeKb: number;
  confidential?: boolean;
}

export const seedFolders: VaultFolder[] = [
  { id: 'f1', name: 'Incorporation Documents',  fileCount: 12, required: 12 },
  { id: 'f2', name: 'Statutory Registrations',  fileCount: 6,  required: 8 },
  { id: 'f3', name: 'Compliance Filings',       fileCount: 22, required: 24 },
  { id: 'f4', name: 'Board Resolutions',        fileCount: 6,  required: 6 },
  { id: 'f5', name: 'Contracts & Agreements',   fileCount: 9,  required: 12 },
];
