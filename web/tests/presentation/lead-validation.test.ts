import { describe, expect, it } from "vitest";
import {
  MESSAGE_MAX_LENGTH,
  normalizeLeadName,
  validateLeadMessage,
  validateLeadName,
  validateLeadPhone,
} from "@/presentation/lib/lead-validation";

describe("validateLeadName", () => {
  it("пропускает нормальное имя", () => {
    expect(validateLeadName("Иван")).toBeNull();
    expect(validateLeadName("  Иван Петров  ")).toBeNull();
  });

  it("требует минимум два символа", () => {
    expect(validateLeadName("И")).toMatch(/минимум 2/);
  });

  it("отвергает пустое и пробельное", () => {
    expect(validateLeadName("")).toMatch(/Укажите/);
    expect(validateLeadName("     ")).toMatch(/Укажите/);
  });

  it("отвергает строку из цифр и символов", () => {
    expect(validateLeadName("12345")).toMatch(/букв/);
    expect(validateLeadName("--- ---")).toMatch(/букв/);
  });
});

describe("normalizeLeadName", () => {
  it("обрезает и схлопывает пробелы", () => {
    expect(normalizeLeadName("  Иван   Петров ")).toBe("Иван Петров");
  });
});

describe("validateLeadPhone", () => {
  it("пропускает полный номер", () => {
    expect(validateLeadPhone("+7 (999) 123-45-67")).toBeNull();
    expect(validateLeadPhone("89991234567")).toBeNull();
  });

  it("сообщает про 11 цифр на неполном номере", () => {
    expect(validateLeadPhone("+7 (999) 123-45-6")).toMatch(/11 цифр/);
  });

  it("просит телефон, если поле пустое", () => {
    expect(validateLeadPhone("")).toMatch(/Укажите телефон/);
  });
});

describe("validateLeadMessage", () => {
  it("пропускает текст в пределах лимита", () => {
    expect(validateLeadMessage("а".repeat(MESSAGE_MAX_LENGTH))).toBeNull();
  });

  it("ругается на превышение лимита", () => {
    expect(validateLeadMessage("а".repeat(MESSAGE_MAX_LENGTH + 1))).toMatch(/1000/);
  });
});
