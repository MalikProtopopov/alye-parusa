"use client";

/* Фирменная 404 админки: вместо дефолтной Next.js. CTA зависит от авторизации. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "./lib/api";

export default function NotFound() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(Boolean(getToken()));
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--sand-50)",
        padding: 24,
      }}
    >
      <div className="card" style={{ maxWidth: 460, width: "100%", textAlign: "center", padding: "40px 32px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-mark.svg"
          alt=""
          aria-hidden="true"
          style={{ width: 40, height: 40, margin: "0 auto 14px" }}
        />
        <div
          className="mono"
          style={{ fontSize: "3.4rem", fontWeight: 700, lineHeight: 1, color: "var(--accent-600, #A02D1E)" }}
        >
          404
        </div>
        <h1 style={{ fontSize: "1.15rem", margin: "12px 0 8px", color: "var(--ink)" }}>
          Такого раздела нет
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-70)", marginBottom: 22 }}>
          Страница удалена, переименована или адрес набран с опечаткой.
          Разделы админки — в меню слева после входа.
        </p>
        {authed === null ? null : authed ? (
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/dashboard" className="btn btn-primary">
              На «Обзор»
            </Link>
            <Link href="/leads" className="btn">
              К заявкам
            </Link>
          </div>
        ) : (
          <Link href="/login" className="btn btn-primary">
            Войти в админку
          </Link>
        )}
      </div>
    </div>
  );
}
