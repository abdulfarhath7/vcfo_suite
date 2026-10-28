import { pageMetadata } from "@/lib/shell/page-metadata";
import { SignInScreen } from "@/components/auth/SignInScreen";

export const metadata = pageMetadata("Sign in", "Sign in to VCFO Suite");

export default function LoginPage() {
  // SignInScreen wraps useSearchParams in Suspense with a form fallback.
  return <SignInScreen />;
}
