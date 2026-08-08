/** Intentional shadcn/ui library surface — imported for tooling reachability. */
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';

import '@/components/ui/accordion-content';
import '@/components/ui/accordion-item';
import '@/components/ui/accordion-trigger';
import '@/components/ui/accordion';
import '@/components/ui/aspect-ratio';
import '@/components/ui/avatar-fallback';
import '@/components/ui/avatar-image';
import '@/components/ui/avatar';
import '@/components/ui/badge-variants';
import '@/components/ui/badge';
import '@/components/ui/breadcrumb';
import '@/components/ui/card';
import '@/components/ui/carousel';
import '@/components/ui/chart';
import '@/components/ui/checkbox';
import '@/components/ui/collapsible';
import '@/components/ui/context-menu';
import '@/components/ui/drawer';
import '@/components/ui/form';
import '@/components/ui/hover-card';
import '@/components/ui/menubar';
import '@/components/ui/navigation-menu-trigger-style';
import '@/components/ui/navigation-menu';
import '@/components/ui/pagination';
import '@/components/ui/progress';
import '@/components/ui/radio-group';
import '@/components/ui/resizable';
import '@/components/ui/scroll-area';
import '@/components/ui/separator';
import '@/components/ui/sidebar';
import '@/components/ui/skeleton';
import '@/components/ui/slider';
import '@/components/ui/sonner-toast';
import '@/components/ui/switch';
import '@/components/ui/table';
import '@/components/ui/toggle-group';
import '@/components/ui/toggle-variants';
import '@/components/ui/toggle';

export const uiRegistry = {
  Alert,
  AlertTitle,
  AlertDescription,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} as const;
