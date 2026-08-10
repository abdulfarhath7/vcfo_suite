"use client";

import { useReducer } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/noir";
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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <Eyebrow>Add project lead</Eyebrow>
        <p className="text-[11.5px] text-text-tertiary mt-1 leading-snug">
          Creates a project lead login with the intern role and emails sign-in credentials when Resend is configured.
          Ask them to change their password after first login.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="intern-name" className="text-[12px] flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-text-tertiary" /> Full name
          </Label>
          <Input
            id="intern-name"
            value={fullName}
            onChange={(e) => dispatch({ type: "set_field", field: "fullName", value: e.target.value })}
            placeholder="e.g. Priya Sharma"
            className="mt-1.5"
            autoComplete="name"
          />
          {fieldErrors.fullName ? (
            <p className="text-[11px] text-danger mt-1">{fieldErrors.fullName}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="intern-email" className="text-[12px] flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-text-tertiary" /> Work email
          </Label>
          <Input
            id="intern-email"
            type="email"
            value={email}
            onChange={(e) => dispatch({ type: "set_field", field: "email", value: e.target.value })}
            placeholder="name@vcfosuite.com"
            className="mt-1.5"
            autoComplete="off"
            required
          />
          {fieldErrors.email ? (
            <p className="text-[11px] text-danger mt-1">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="intern-phone" className="text-[12px] flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-text-tertiary" /> Phone (optional)
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
          <Label htmlFor="intern-password" className="text-[12px] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-text-tertiary" /> Temporary password
          </Label>
          <div className="relative mt-1.5">
            <Input
              id="intern-password"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-ink"
              onClick={() => dispatch({ type: "toggle_show_password" })}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-text-tertiary mt-1">
            Sent once by email — not stored in VCFO Suite.
          </p>
          {fieldErrors.password ? (
            <p className="text-[11px] text-danger mt-1">{fieldErrors.password}</p>
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
