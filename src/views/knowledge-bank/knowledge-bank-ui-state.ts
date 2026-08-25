import type { KnowledgeBankFolderRecord } from '@/lib/knowledge-bank-folders';

export type KnowledgeBankFolder = KnowledgeBankFolderRecord;

export type KnowledgeBankFile = {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploaderName: string | null;
  uploaderEmail: string | null;
  createdAt: string;
  folderId: string | null;
  folderPath: string;
};

export type KnowledgeBankDeleteTarget =
  | { kind: 'file'; file: KnowledgeBankFile }
  | { kind: 'folder'; folder: KnowledgeBankFolder };

export type KnowledgeBankUiState = {
  q: string;
  title: string;
  description: string;
  selectedFile: File | null;
  uploading: boolean;
  folderName: string;
  creatingFolder: boolean;
  deleteTarget: KnowledgeBankDeleteTarget | null;
  deleting: boolean;
  downloadingId: string | null;
};

export type KnowledgeBankUiAction =
  | { type: 'patch'; patch: Partial<KnowledgeBankUiState> }
  | { type: 'clear_upload_form' }
  | { type: 'clear_folder_form' }
  | { type: 'set_delete_target'; target: KnowledgeBankDeleteTarget | null };

export function knowledgeBankUiReducer(
  state: KnowledgeBankUiState,
  action: KnowledgeBankUiAction,
): KnowledgeBankUiState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'clear_upload_form':
      return { ...state, title: '', description: '', selectedFile: null };
    case 'clear_folder_form':
      return { ...state, folderName: '' };
    case 'set_delete_target':
      return { ...state, deleteTarget: action.target };
    default:
      return state;
  }
}

export const initialKnowledgeBankUiState: KnowledgeBankUiState = {
  q: '',
  title: '',
  description: '',
  selectedFile: null,
  uploading: false,
  folderName: '',
  creatingFolder: false,
  deleteTarget: null,
  deleting: false,
  downloadingId: null,
};
