/**
 * Receivables repositories (docs/specs/receivables/PLAN.md). Access rules are in shared.ts.
 */
export { ReceivablesError, type InvoiceRow, type SheetRow } from './shared';
export { emailSettingsOf, getEmailSettings, getManagerSheet, listMySheets, systemAddSheetEditor, systemCreateSheet, updateEmailSettings, updateSheetSettings, type ManagerSheet, type SheetSummary } from './sheets';
export { addInvoice, deleteInvoice, markReceived, reopenInvoice, setReminderPause, updateInvoice, type InvoiceInput, type InvoicePatch } from './invoices';
export { getVersion, listVersions, publishSheet, type VersionMeta } from './versions';
export { addPartner, deletePartner, updatePartner } from './partners';
export { addClient, deleteClient, listClients, setPartnerClients, systemCoPartnerLinks, updateClient, type ClientInput, type ClientPatch, type ClientRow } from './clients';
export { addDigestRecipient, listDigestRecipients, removeDigestRecipient, updateDigestRecipient } from './digest-recipients';
export { listDeposits, saveDeposits } from './deposits';
export { approveImportRows, discardBatch, getPendingImports, rejectImportRows, requestAmountChange, stageTallyImport, stageTallyReceipts, type ApprovalOutcome } from './imports';
export {
  TallyJobError,
  claimNextJob,
  connectorByToken,
  connectorHello,
  createPairingCode,
  getSyncJob,
  getTallyStatus,
  listRecentJobs,
  pairConnector,
  queueSyncJob,
  revokeConnector,
  saveJobResult,
  touchConnector,
  type ConnectorRow,
} from './tally-sync';
export {
  approveEmailLogs,
  getEmailLogEntry,
  listEmailLog,
  listEmailLogPage,
  retryEmailLog,
  skipEmailLogs,
  startEmailLog,
  systemFinishEmailLog,
  systemGetEmailLog,
  systemReplaceAwaiting,
  systemSetEmailWhatsApp,
  systemStartEmailLog,
  type EmailLogRow,
  type NewEmailLog,
} from './email-log';
export {
  clientStatementSource,
  lastAutoSends,
  receivedEmailSource,
  systemDigestRecipients,
  systemInvoicesById,
  systemLastRollupDate,
  systemOpenInvoices,
  systemSheetEmailSettings,
  systemSheetPartners,
  systemSheetsWithAutoEmails,
  systemStaffName,
  type EmailInvoiceRow,
  type PartnerContact,
  type SheetEmailSettings,
} from './email-sources';
export { finishSummarySend, getSummarySendStatus, getSummarySource, listSummarySends, recordSummarySend, type SummarySendStatus, type SummarySource } from './emails';
export { PARTNER_NOTE_MAX, addPartnerNote, partnerExportRows, partnerHome, partnerInvoiceDetail, partnerStatement, setNotifyOnPublish, setPromise } from './partner-portal';
export { sheetStatement } from './statement';
export {
  partnerLoginAction,
  
  systemPeekPartnerToken,
  systemSetPartnerPassword,
  
  type PartnerLoginAction,
  type PartnerLoginResult,
  type SetPartnerPasswordOutcome,
} from './partner-logins';
export { addSbcNote, listNotes, type SbcNoteResult } from './notes';
export { listRates, pickRateInForce, setManualRate, systemRateFor, systemUpsertFetchedRate } from './fx';
export { reportData } from './reports';
export {
  DISPUTE_PAUSE_UNTIL,
  addCreditNote,
  createAwaitedFira,
  listCreditNotes,
  listFiras,
  raiseDispute,
  resolveDispute,
  setTds,
  updateFira,
} from './adjustments';
export {
  SHARE_TOKEN,
  createShareLink,
  listShareLinks,
  revokeShareLink,
  systemOpenShareLink,
  updateShareLink,
  type OpenShareResult,
  type ShareLinkChanges,
  type ShareLinkFields,
  type ShareLinkRow,
  type ShareLinkWithViews,
} from './share-links';
export { invoiceHistory, listPendingChanges } from './history';
export {
  cancelForward,
  closeForward,
  createAlert,
  createForward,
  deleteAlert,
  fxDesk,
  listAlerts,
  listForwards,
  ratesInForceByDay,
  systemActiveAlerts,
  systemFxCurrenciesInUse,
  systemMarkAlertTriggered,
  updateAlert,
  updateForward,
  type DueAlertCheck,
} from './fx-desk';
export { getSignName, setSignName } from './sign-name';
export { sentReceiptsFor, systemRecordSentReceipts } from './sent-receipts';
export { listTemplates, templateFor, saveTemplate, resetTemplate, systemTemplatesFor } from './templates';
export { addTeamMember, listTeam, mayApprove, removeTeamMember, systemPeekTeamToken, systemSetTeamPassword, systemTeamWhatsApp, updateTeamMember, type TeamInput, type TeamMemberDto } from './team';
export { sheetIdOfInvoice } from './invoices';
