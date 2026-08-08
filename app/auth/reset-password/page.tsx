import ResetPassword from '@/views/auth/ResetPassword';

import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Reset password", "Reset your VCFO Suite password");


export default function ResetPasswordPage() {
  return <ResetPassword />;
}
