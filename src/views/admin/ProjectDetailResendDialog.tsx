'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

export function ProjectDetailResendDialog({
  open,
  onOpenChange,
  clientEmail,
  resending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientEmail?: string;
  resending: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resend welcome email?</AlertDialogTitle>
          <AlertDialogDescription>
            Send the project welcome email again to{' '}
            <span className="font-medium text-ink">{clientEmail}</span>. The client will see current phase
            milestones and your contact details in the footer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={resending}>Keep as is</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={resending}
            className="gold-sheen"
          >
            {resending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending email…
              </>
            ) : (
              'Send welcome email'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
