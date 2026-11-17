import { ArrowLeftRight, Ban, CheckCircle2, FileMinus, History, IndianRupee, MessageSquare, Trash2, Undo2 } from 'lucide-react';
import type { ActionItem } from '@/components/ui/action-menu';
import type { ManagerInvoiceDto } from '@/lib/receivables/wire';

/** What a row menu item opens; the sheet's state hook decides how. */
export type RowAction = 'mark' | 'pause' | 'resume' | 'fx' | 'notes' | 'history' | 'dispute' | 'resolve' | 'credit' | 'reopen' | 'delete' | 'change-amount';

/**
 * The row menu of one invoice (Phase 10), the same on the table and the phone cards: Mark
 * received, Change amount (v2), Currency, Notes, History, Dispute, Credit note and Delete for an
 * open invoice; Set back to open, Change amount, Notes, History and Delete for a received one. Each has a
 * letter key.
 */
export function createRowMenu(inv: ManagerInvoiceDto, today: string, run: (action: RowAction, inv: ManagerInvoiceDto) => void): ActionItem[] {
  const go = (a: RowAction) => () => run(a, inv);
  const notes: ActionItem = { label: 'Notes', key: 'n', Icon: MessageSquare, hint: inv.noteCount ? String(inv.noteCount) : undefined, onSelect: go('notes') };
  const history: ActionItem = { label: 'History', key: 'h', Icon: History, onSelect: go('history') };
  const del: ActionItem = { label: 'Delete', key: 'x', Icon: Trash2, danger: true, onSelect: go('delete') };
  // v2: an amount change goes through the approval panel; a received invoice's dialog says to reopen first.
  const change: ActionItem = { label: 'Change amount', key: 'a', Icon: IndianRupee, onSelect: go('change-amount') };
  if (inv.status !== 'open') {
    return [{ label: 'Set back to open', key: 'u', Icon: Undo2, onSelect: go('reopen') }, change, notes, history, 'separator', del];
  }
  return [
    { label: 'Mark received', key: 'r', Icon: CheckCircle2, onSelect: go('mark') },
    change,
    { label: 'Currency and rate', key: 'f', Icon: ArrowLeftRight, onSelect: go('fx') },
    notes,
    history,
    'separator',
    inv.disputed ? { label: 'Resolve dispute', key: 'd', Icon: Ban, onSelect: go('resolve') } : { label: 'Dispute', key: 'd', Icon: Ban, onSelect: go('dispute') },
    { label: 'Credit note', key: 'c', Icon: FileMinus, onSelect: go('credit') },
    'separator',
    del,
  ];
}
