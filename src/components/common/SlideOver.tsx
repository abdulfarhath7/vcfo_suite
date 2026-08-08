import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SlideOver({ open, onOpenChange, title, description, children, footer }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col border-l border-orange-100 p-0 sm:max-w-lg">
        <div className="accent-bar absolute left-0 top-0 h-full" aria-hidden />
        <SheetHeader className="border-b border-border bg-orange-50/40 px-6 py-4 pl-7">
          <SheetTitle className="text-base font-semibold text-foreground">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-xs text-muted-foreground">{description}</SheetDescription>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="border-t border-border bg-orange-50/30 px-6 py-3">{footer}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
