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
};

export type KnowledgeBankUiState = {
  q: string;
  title: string;
  description: string;
  selectedFile: File | null;
  uploading: boolean;
  deleteTarget: KnowledgeBankFile | null;
  deleting: boolean;
  downloadingId: string | null;
};

export type KnowledgeBankUiAction =
  | { type: 'patch'; patch: Partial<KnowledgeBankUiState> }
  | { type: 'clear_upload_form' }
  | { type: 'set_delete_target'; file: KnowledgeBankFile | null };

export function knowledgeBankUiReducer(
  state: KnowledgeBankUiState,
  action: KnowledgeBankUiAction,
): KnowledgeBankUiState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'clear_upload_form':
      return { ...state, title: '', description: '', selectedFile: null };
    case 'set_delete_target':
      return { ...state, deleteTarget: action.file };
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
  deleteTarget: null,
  deleting: false,
  downloadingId: null,
};
