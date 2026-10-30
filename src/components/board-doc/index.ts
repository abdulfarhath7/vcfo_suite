/* The shared board document part (docs/ui-port/BR-DOC-API.md). */
export * from './types';
export { docDay, docDate } from './format';
export { nocDocType, needsNotary, NOC_STAGE_KEYS, UPLOADED_KEY, DOC_TYPES } from './doc-types';
export { trackStates, todoStates, type TrackState, type TrackStep } from './track';
export { segmentText, isPlaceholder, type TextSegment } from './merge-segments';
export { diffValues, type ValueChange } from './version-diff';
export {
  nocMergeValues,
  nocDocModel,
  nocEvidence,
  plainDocDate,
  NOC_FIELD_SOURCES,
  NOC_FIELD_LABELS,
  type NocOutcome,
  type NocPathNode,
} from './noc-doc';
export { DocTrack } from './DocTrack';
export { DocTodo } from './DocTodo';
export { DocPaper } from './DocPaper';
export { SignedCopyView } from './SignedCopyView';
export { signedKind, type SignedKind } from './signed-kind';
export { DocPreviewCard, type DocPreviewTab } from './DocPreviewCard';
export { VersionCompare } from './VersionCompare';
export { ReceiveChecklist } from './ReceiveChecklist';
export { DocFiles } from './DocFiles';
export { EvidenceTable } from './EvidenceTable';
export { AuditLines } from './AuditLines';
export { VariantTree } from './VariantTree';
export { treePath, type NocNodeId } from './variant-tree';
