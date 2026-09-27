"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button, Card } from "@/components/ui";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

type FieldKey = "full_name" | "organization" | "role" | "email" | "phone" | "beds" | "message";

export function ContactForm({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    full_name: "",
    organization: "",
    role: "",
    email: "",
    phone: "",
    beds: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  function setField(key: FieldKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<FieldKey, string>> = {};
    if (values.full_name.trim().length < 2) next.full_name = dict.contact.required;
    if (values.organization.trim().length < 2) next.organization = dict.contact.required;
    if (!values.email.trim()) next.email = dict.contact.required;
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email.trim())) next.email = dict.contact.invalidEmail;
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setState("sending");
    try {
      await apiFetch("/leads", {
        method: "POST",
        body: JSON.stringify({
          full_name: values.full_name.trim(),
          organization: values.organization.trim(),
          role: values.role.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          beds: Number(values.beds) || 0,
          message: values.message.trim(),
          locale,
        }),
      });
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 16 }}
          className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-status-good)]/14 text-[var(--color-status-good)]"
        >
          <CheckCircle2 size={26} />
        </motion.span>
        <h3 className="text-lg font-extrabold">{dict.contact.success}</h3>
        <p className="max-w-sm text-sm text-[var(--text-secondary)]">{dict.contact.successBody}</p>
      </Card>
    );
  }

  const fields: { key: FieldKey; label: string; type?: string; span?: boolean; inputMode?: "numeric" | "tel" | "email" }[] = [
    { key: "full_name", label: dict.contact.fields.name },
    { key: "organization", label: dict.contact.fields.organization },
    { key: "role", label: dict.contact.fields.role },
    { key: "email", label: dict.contact.fields.email, type: "email", inputMode: "email" },
    { key: "phone", label: dict.contact.fields.phone, type: "tel", inputMode: "tel" },
    { key: "beds", label: dict.contact.fields.beds, type: "number", inputMode: "numeric" },
  ];

  return (
    <Card className="p-5 sm:p-7">
      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className={field.span ? "sm:col-span-2" : undefined}>
            <label htmlFor={`contact-${field.key}`} className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
              {field.label}
            </label>
            <input
              id={`contact-${field.key}`}
              type={field.type ?? "text"}
              inputMode={field.inputMode}
              value={values[field.key]}
              onChange={(event) => setField(field.key, event.target.value)}
              aria-invalid={Boolean(errors[field.key])}
              className="h-11 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] px-3.5 text-sm outline-none transition focus:border-brand-500 focus:bg-[var(--surface)]"
            />
            {errors[field.key] ? (
              <p className="mt-1 text-[11px] font-semibold text-[var(--color-status-critical)]">{errors[field.key]}</p>
            ) : null}
          </div>
        ))}

        <div className="sm:col-span-2">
          <label htmlFor="contact-message" className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
            {dict.contact.fields.message}
          </label>
          <textarea
            id="contact-message"
            rows={4}
            value={values.message}
            onChange={(event) => setField("message", event.target.value)}
            className="w-full resize-y rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] p-3.5 text-sm leading-7 outline-none transition focus:border-brand-500 focus:bg-[var(--surface)]"
          />
        </div>

        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" disabled={state === "sending"} className="w-full sm:w-auto">
            {state === "sending" ? dict.contact.submitting : dict.contact.submit}
            <Send size={16} />
          </Button>
          {state === "error" ? (
            <p className="text-xs font-semibold text-[var(--color-status-critical)]">{dict.contact.failure}</p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
