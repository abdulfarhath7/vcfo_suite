"use client";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[11px] text-danger mt-1">
      {message}
    </p>
  );
}
