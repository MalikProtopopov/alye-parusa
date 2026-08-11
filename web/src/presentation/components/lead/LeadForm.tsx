"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import type { CalcRequestDto, CalcResultDto, LeadKindDto } from "@/infrastructure/api/dto";
import { submitLead } from "@/infrastructure/api/leads-client";
import { cn } from "@/presentation/lib/cn";
import {
  MESSAGE_MAX_LENGTH,
  normalizeLeadName,
  validateLeadMessage,
  validateLeadName,
  validateLeadPhone,
} from "@/presentation/lib/lead-validation";
import { METRIKA_GOALS, reachGoal } from "@/presentation/lib/metrika";
import {
  applyPhoneMask,
  deletePhoneDigitBefore,
  normalizeRuPhone,
  RU_PHONE_PLACEHOLDER,
} from "@/presentation/lib/phone";
import { captureUtm, getUtm } from "@/presentation/lib/utm";
import { Sail } from "../brand/Sail";
import styles from "./LeadForm.module.css";

export interface CalcSnapshot {
  input: CalcRequestDto;
  result: CalcResultDto;
}

export interface LeadFormProps {
  kind: LeadKindDto;
  floorplanId?: string;
  sourceBlock?: string;
  sourceButton?: string;
  calcSnapshot?: CalcSnapshot;
  policyHref?: string;
  submitLabel?: string;
  withMessage?: boolean;
  className?: string;
}

type Status = "idle" | "submitting" | "done" | "error";

interface FieldErrors {
  name?: string;
  phone?: string;
  message?: string;
  consent?: string;
}

const CONSENT_TEXT =
  "Соглашаюсь на обработку персональных данных в соответствии с политикой конфиденциальности";

const CONSENT_ERROR = "Для отправки заявки нужно согласие на обработку данных.";

/**
 * The one lead-capture form: CTA, catalog, floorplan detail, calculator.
 * Mirrors the backend contract POST /api/v1/leads (honeypot `website`,
 * mandatory consent, first-touch UTM, optional calculator snapshot).
 * The phone field is masked to +7 (999) 123-45-67 and only a complete
 * 11-digit number leaves the browser, in canonical +7XXXXXXXXXX form.
 *
 * Подача — бланк: строки на подчёркивании и подписи капителью, без «карточек
 * с рамкой». Обёртку (подложку купона) задаёт вызывающий компонент.
 */
export function LeadForm({
  kind,
  floorplanId,
  sourceBlock,
  sourceButton,
  calcSnapshot,
  policyHref = "/dokumenty",
  submitLabel = "Оставить заявку",
  withMessage = false,
  className,
}: LeadFormProps) {
  const uid = useId();
  const nameId = `${uid}-name`;
  const phoneId = `${uid}-phone`;
  const messageId = `${uid}-message`;
  const nameErrorId = `${uid}-name-error`;
  const phoneErrorId = `${uid}-phone-error`;
  const messageErrorId = `${uid}-message-error`;
  const messageCounterId = `${uid}-message-counter`;
  const consentErrorId = `${uid}-consent-error`;

  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot — humans never see it

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);

  useEffect(() => {
    captureUtm();
  }, []);

  // Re-place the caret after the mask rewrote the value (typing mid-number).
  useLayoutEffect(() => {
    const input = phoneRef.current;
    if (input && caretRef.current !== null && document.activeElement === input) {
      input.setSelectionRange(caretRef.current, caretRef.current);
    }
    caretRef.current = null;
  }, [phone]);

  const clearError = (field: keyof FieldErrors) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  /** Commits a masked value; syncs the DOM directly when React would not re-render. */
  const commitPhone = (input: HTMLInputElement, next: { value: string; caret: number }) => {
    if (next.value === phone) {
      input.value = next.value;
      input.setSelectionRange(next.caret, next.caret);
    } else {
      caretRef.current = next.caret;
      setPhone(next.value);
    }
    clearError("phone");
  };

  const onPhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const caret = input.selectionStart ?? input.value.length;
    commitPhone(input, applyPhoneMask(input.value, caret));
  };

  const onPhoneKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Backspace") return;
    const input = event.currentTarget;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    // Only the collapsed-caret-on-a-separator case needs help; the rest is
    // ordinary editing that onChange re-masks correctly.
    if (start === null || end === null || start !== end || start === 0) return;
    const previous = input.value[start - 1];
    if (previous >= "0" && previous <= "9") return;
    event.preventDefault();
    commitPhone(input, deletePhoneDigitBefore(input.value, start));
  };

  const onMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(event.currentTarget.value.slice(0, MESSAGE_MAX_LENGTH));
    clearError("message");
  };

  const validate = (): FieldErrors => ({
    name: validateLeadName(name) ?? undefined,
    phone: validateLeadPhone(phone) ?? undefined,
    message: withMessage ? (validateLeadMessage(message) ?? undefined) : undefined,
    consent: consent ? undefined : CONSENT_ERROR,
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;

    const found = validate();
    setErrors(found);
    const firstInvalid = found.name
      ? nameRef.current
      : found.phone
        ? phoneRef.current
        : found.message
          ? messageRef.current
          : found.consent
            ? consentRef.current
            : null;
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const canonicalPhone = normalizeRuPhone(phone);
    if (!canonicalPhone) {
      setErrors({ phone: validateLeadPhone("") ?? undefined });
      phoneRef.current?.focus();
      return;
    }

    setStatus("submitting");

    const result = await submitLead({
      name: normalizeLeadName(name),
      phone: canonicalPhone,
      kind,
      ...(floorplanId ? { floorplan_id: floorplanId } : {}),
      ...(message.trim() ? { message: message.trim() } : {}),
      consent_given: true,
      consent_text: CONSENT_TEXT,
      utm: getUtm(),
      ...(sourceButton ? { source_button: sourceButton } : {}),
      ...(sourceBlock ? { source_block: sourceBlock } : {}),
      page_url: window.location.href,
      ...(calcSnapshot ? { calc_snapshot: calcSnapshot } : {}),
      website,
    });

    if (result.ok) {
      reachGoal(METRIKA_GOALS.LEAD_SUBMIT, {
        kind,
        ...(sourceBlock ? { source_block: sourceBlock } : {}),
      });
    }
    setStatus(result.ok ? "done" : "error");
  };

  // Успех — не «зелёный алерт», а отметка на бланке: парус и типографика.
  if (status === "done") {
    return (
      <div className={cn(styles.done, className)} role="status">
        <Sail className={styles.doneSail} />
        <p className={styles.doneTitle}>Заявка принята</p>
        <p className={styles.doneText}>Менеджер свяжется с вами в ближайшее время.</p>
      </div>
    );
  }

  return (
    <form className={cn(styles.form, className)} onSubmit={submit} noValidate>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={nameId}>
            Имя
          </label>
          <input
            ref={nameRef}
            id={nameId}
            className={cn(styles.input, errors.name && styles.inputInvalid)}
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError("name");
            }}
            onBlur={() => setErrors((prev) => ({ ...prev, name: validateLeadName(name) ?? undefined }))}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? nameErrorId : undefined}
            required
          />
          <p className={styles.fieldError} id={nameErrorId} role="alert">
            {errors.name}
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={phoneId}>
            Телефон
          </label>
          <input
            ref={phoneRef}
            id={phoneId}
            className={cn(styles.input, errors.phone && styles.inputInvalid)}
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder={RU_PHONE_PLACEHOLDER}
            autoComplete="tel"
            maxLength={RU_PHONE_PLACEHOLDER.length}
            value={phone}
            onChange={onPhoneChange}
            onKeyDown={onPhoneKeyDown}
            onBlur={() =>
              setErrors((prev) => ({ ...prev, phone: validateLeadPhone(phone) ?? undefined }))
            }
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? phoneErrorId : undefined}
            required
          />
          <p className={styles.fieldError} id={phoneErrorId} role="alert">
            {errors.phone}
          </p>
        </div>
      </div>

      {withMessage ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor={messageId}>
            Комментарий
          </label>
          <textarea
            ref={messageRef}
            id={messageId}
            className={cn(styles.input, styles.message, errors.message && styles.inputInvalid)}
            name="message"
            placeholder="Необязательно"
            rows={3}
            maxLength={MESSAGE_MAX_LENGTH}
            value={message}
            onChange={onMessageChange}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={cn(messageCounterId, errors.message && messageErrorId)}
          />
          <div className={styles.fieldFoot}>
            <p className={styles.fieldError} id={messageErrorId} role="alert">
              {errors.message}
            </p>
            <span className={styles.counter} id={messageCounterId}>
              {message.length} / {MESSAGE_MAX_LENGTH}
            </span>
          </div>
        </div>
      ) : null}

      {/* Honeypot: visually hidden (NOT display:none), bots fill it in. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Не заполняйте это поле
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.consentField}>
        <label className={styles.consent}>
          {/* Кастомный чекбокс: нативный input с appearance:none + галочка-SVG. */}
          <span className={styles.checkboxWrap}>
            <input
              ref={consentRef}
              className={cn(styles.checkbox, errors.consent && styles.checkboxInvalid)}
              type="checkbox"
              name="consent"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                clearError("consent");
              }}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? consentErrorId : undefined}
              required
            />
            <svg className={styles.check} viewBox="0 0 14 12" aria-hidden="true">
              <path d="M1.5 6.2 5.2 9.9 12.5 1.8" />
            </svg>
          </span>
          <span className={styles.consentText}>
            Соглашаюсь на обработку персональных данных в соответствии с{" "}
            <a className={styles.policyLink} href={policyHref}>
              политикой конфиденциальности
            </a>
          </span>
        </label>
        <p className={styles.fieldError} id={consentErrorId} role="alert">
          {errors.consent}
        </p>
      </div>

      {status === "error" ? (
        <p className={styles.formError} role="alert">
          Не получилось отправить заявку. Попробуйте ещё раз чуть позже.
        </p>
      ) : null}

      <button type="submit" className={styles.submit} disabled={status === "submitting"}>
        {status === "submitting" ? "Отправляем…" : submitLabel}
        <span className={styles.submitArrow} aria-hidden="true">
          →
        </span>
      </button>
    </form>
  );
}
