"use client";

import { useReducer } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createInternBodySchema } from "@/lib/api/schemas";
import { requestCreateIntern } from "@/lib/email/request-create-intern";
import { toastError, toastSuccess, toastEmailDispatch, errorMessage } from "@/lib/toast-errors";

const ERROR_LABELS: Record<string, string> = {
  invalid_body: "Check the form fields and try again.",
  email_already_registered: "An account with this email already exists.",
  rate_limited: "Too many requests — wait a few minutes and try again.",
  email_not_configured: "Account created, but email is not configured on the server.",
};

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  showPassword: boolean;
  submitting: boolean;
  fieldErrors: Record<string, string>;
};

type FormAction =
  | { type: "set_field"; field: "fullName" | "email" | "phone" | "password"; value: string }
  | { type: "toggle_show_password" }
  | { type: "set_submitting"; value: boolean }
  | { type: "set_field_errors"; value: Record<string, string> }
  | { type: "reset_form" };

const initialFormState: FormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  showPassword: false,
  submitting: false,
  fieldErrors: {},
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "set_field":
      return { ...state, [action.field]: action.value };
    case "toggle_show_password":
      return { ...state, showPassword: !state.showPassword };
    case "set_submitting":
      return { ...state, submitting: action.value };
    case "set_field_errors":
      return { ...state, fieldErrors: action.value };
    case "reset_form":
      return {
        ...state,
        fullName: "",
        email: "",
        phone: "",
        password: "",
        fieldErrors: {},
      };
    default:
      return state;
  }
}

export function CreateInternForm({ onCreated }: { onCreated?: () => void }) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  const { fullName, email, phone, password, showPassword, submitting, fieldErrors } = state;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "set_field_errors", value: {} });

    const parsed = createInternBodySchema.safeParse({
      email,
      password,
      fullName: fullName.trim() || undefined,
      phone: phone.trim() || undefined,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      dispatch({ type: "set_field_errors", value: next });
      return;
    }

    dispatch({ type: "set_submitting", value: true });
    try {
      const result = await requestCreateIntern(parsed.data);
      if (!result.ok) {
        const code = result.error ?? "unknown";
        toastError(ERROR_LABELS[code] ?? errorMessage(new Error(code)));
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["interns"] });

      toastSuccess("Project lead account created", result.email);
      toastEmailDispatch(
        result.emailSent
          ? { attempted: 1, sent: [result.email ?? ""], skipped: [], failed: [] }
          : result.emailSkipped
            ? { attempted: 1, sent: [], skipped: [result.email ?? ""], failed: [] }
            : { attempted: 1, sent: [], skipped: [], failed: [result.email ?? ""] },
      );

      dispatch({ type: "reset_form" });
      onCreated?.();
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      dispatch({ type: "set_submitting", value: false });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-label="Add project lead">
      <div className="space-y-4">
        <div>
          <Label htmlFor="intern-name" className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
            <User className="h-4 w-4 text-ink-muted" strokeWidth={1.6} aria-hidden /> Full name
          </Label>
          <Input
            id="intern-name"
            aria-invalid={fieldErrors.fullName ? true : undefined}
            value={fullName}
            onChange={(e) => dispatch({ type: "set_field", field: "fullName", value: e.target.value })}
            placeholder="e.g. Priya Sharma"
            className="mt-1.5"
            autoComplete="name"
          />
          {fieldErrors.fullName ? (
            <p className="mt-1 text-[12.5px] text-danger">{fieldErrors.fullName}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="intern-email" className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
            <Mail className="h-4 w-4 text-ink-muted" strokeWidth={1.6} aria-hidden /> Work email
          </Label>
          <Input
            id="intern-email"
            aria-invalid={fieldErrors.email ? true : undefined}
            type="email"
            value={email}
            onChange={(e) => dispatch({ type: "set_field", field: "email", value: e.target.value })}
            placeholder="name@vcfosuite.com"
            className="mt-1.5"
            autoComplete="off"
            required
          />
          {fieldErrors.email ? (
            <p className="mt-1 text-[12.5px] text-danger">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="intern-phone" className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
            <Phone className="h-4 w-4 text-ink-muted" strokeWidth={1.6} aria-hidden /> Phone (optional)
          </Label>
          <Input
            id="intern-phone"
            type="tel"
            value={phone}
            onChange={(e) => dispatch({ type: "set_field", field: "phone", value: e.target.value })}
            placeholder="+91 …"
            className="mt-1.5"
            autoComplete="tel"
          />
        </div>

        <div>
          <Label htmlFor="intern-password" className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
            <Lock className="h-4 w-4 text-ink-muted" strokeWidth={1.6} aria-hidden /> Temporary password
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="intern-password"
              aria-invalid={fieldErrors.password ? true : undefined}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => dispatch({ type: "set_field", field: "password", value: e.target.value })}
              placeholder="8–128 characters"
              className="pr-10"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-faint hover:text-ink"
              onClick={() => dispatch({ type: "toggle_show_password" })}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {fieldErrors.password ? (
            <p className="mt-1 text-[12.5px] text-danger">{fieldErrors.password}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Create project lead
        </Button>
      </div>

    </form>
  );
}
