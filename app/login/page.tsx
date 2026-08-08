import { pageMetadata } from "@/lib/page-metadata";
import Login from "@/views/auth/Login";

export const metadata = pageMetadata("Sign in", "Sign in to VCFO Suite");

export default function LoginPage() {
  // Login already wraps useSearchParams in Suspense with a form fallback.
  return <Login />;
}
