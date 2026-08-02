"use client";

/**
 * 오퍼 작성 폼. 제출은 세션의 submitOffer로만 나간다 — 국면 전환과 채점이 거기 붙어 있다.
 *
 * 검증 규칙은 offerForm.fields 하나에서 나온다(lib/game/offer.ts). 여기에 조건을 더 쓰지 않는다.
 * 서버도 같은 함수로 다시 검증하므로 이 화면의 검증은 어디까지나 UX다.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useSession } from "@/lib/game/SessionProvider";
import { validateOffer, type FieldError, type OfferValues } from "@/lib/game/offer";
import type { OfferField, OfferForm as OfferFormData } from "@/types/scenario";

function initialValues(form: OfferFormData): OfferValues {
  return Object.fromEntries(
    form.fields.map((f) => [f.id, f.type === "boolean" ? false : ""])
  );
}

function Field({
  field,
  value,
  error,
  disabled,
  onChange,
}: {
  field: OfferField;
  value: string | number | boolean;
  error?: string;
  disabled: boolean;
  onChange: (next: string | boolean) => void;
}) {
  const label = (
    <span className="text-[13px] font-bold text-ink">
      {field.label}
      {field.required ? <span className="ml-1 text-urgent">*</span> : null}
    </span>
  );

  const box = [
    "rounded-xl border bg-surface p-[18px]",
    error ? "border-urgent" : "border-line",
  ].join(" ");

  if (field.type === "boolean") {
    return (
      <div className={`flex gap-3 ${box}`}>
        <input
          id={field.id}
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent disabled:cursor-not-allowed"
        />
        <label htmlFor={field.id} className="min-w-0">
          {label}
          {field.help ? <p className="mt-0.5 text-xs text-muted">{field.help}</p> : null}
        </label>
      </div>
    );
  }

  return (
    <div className={box}>
      <label htmlFor={field.id} className="block">
        {label}
      </label>

      {field.type === "number" ? (
        <div className="mt-2.5 flex items-center gap-2">
          <input
            id={field.id}
            type="number"
            inputMode="numeric"
            value={typeof value === "boolean" ? "" : value}
            disabled={disabled}
            min={field.min}
            max={field.max}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-40 rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-right font-mono text-base font-bold tabular-nums text-ink placeholder:text-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed"
          />
          {field.unit ? <span className="text-sm text-ink-soft">{field.unit}</span> : null}
        </div>
      ) : (
        <textarea
          id={field.id}
          rows={6}
          value={typeof value === "boolean" ? "" : value}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2.5 w-full resize-none rounded-[10px] border border-line-strong bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink placeholder:text-muted focus:border-accent focus:outline-none disabled:cursor-not-allowed"
        />
      )}

      {error ? (
        <p className="mt-1.5 text-xs font-semibold text-urgent">{error}</p>
      ) : field.help ? (
        <p className="mt-1.5 text-xs text-muted">{field.help}</p>
      ) : null}
      {field.type === "textarea" && field.minLength ? (
        <p className="mt-1 text-right font-mono text-[11px] text-muted tabular-nums">
          {String(value).trim().length} / {field.minLength}자
        </p>
      ) : null}
    </div>
  );
}

export function OfferForm({ form }: { form: OfferFormData }) {
  const router = useRouter();
  const { state, canSubmit, submitReason, submitOffer, hydrating } = useSession();

  const [values, setValues] = useState<OfferValues>(() => initialValues(form));
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [confirming, setConfirming] = useState(false);

  // 복원 전에는 이미 제출한 판인지 알 수 없다. 그 사이에 다시 제출하게 두지 않는다.
  const disabled = hydrating || !canSubmit;
  const errorOf = (fieldId: string) => errors.find((e) => e.fieldId === fieldId)?.message;

  function setValue(fieldId: string, next: string | boolean) {
    setValues((prev) => ({ ...prev, [fieldId]: next }));
    setErrors((prev) => prev.filter((e) => e.fieldId !== fieldId));
  }

  function requestSubmit() {
    const found = validateOffer(form, values);
    setErrors(found);
    if (found.length) {
      document.getElementById(found[0].fieldId)?.focus();
      return;
    }
    if (form.irreversible) setConfirming(true);
    else void send();
  }

  async function send() {
    setConfirming(false);
    router.push("/workspace/report");
    await submitOffer(values);
  }

  // 이미 발송한 판이면 빈 폼을 다시 보여줄 이유가 없다.
  if (!hydrating && state.offer) {
    return (
      <div className="mt-7 rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-semibold text-ink">오퍼는 이미 발송되었습니다.</p>
        <p className="mt-1 text-xs text-muted">되돌릴 수 없습니다.</p>
        <Link
          href="/workspace/report"
          className="mt-4 inline-block rounded-[10px] bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
        >
          결과 리포트 보기
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-7 space-y-3">
        {form.fields.map((field) => (
          <Field
            key={field.id}
            field={field}
            value={values[field.id] ?? ""}
            error={errorOf(field.id)}
            disabled={disabled}
            onChange={(next) => setValue(field.id, next)}
          />
        ))}
      </div>

      {/* confirmText는 확인을 묻는 문장이므로 확인 패널에서만 쓴다. 상시 경고는 사실만 적는다. */}
      {form.irreversible ? (
        <p className="mt-6 rounded-xl border border-urgent-border bg-urgent-soft px-4 py-3 text-sm leading-relaxed text-urgent">
          제출하면 되돌릴 수 없습니다. 남은 턴이 있어도 조건을 다시 고칠 수 없습니다.
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-5 rounded-xl border border-urgent bg-surface p-5">
          <p className="text-sm leading-relaxed text-ink">
            {form.confirmText ?? "제출하면 되돌릴 수 없습니다. 제출하시겠습니까?"}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void send()}
              className="flex-1 rounded-[10px] bg-urgent px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              발송합니다
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-sunken"
            >
              더 검토하겠습니다
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={requestSubmit}
          className="mt-5 w-full rounded-[10px] bg-primary px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted"
        >
          {state.grading ? "채점 중…" : "오퍼 제출"}
        </button>
      )}

      {!hydrating && submitReason ? (
        <p className="mt-2 text-center text-[11px] text-muted">{submitReason}</p>
      ) : null}
    </>
  );
}
