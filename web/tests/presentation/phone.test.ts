import { describe, expect, it } from "vitest";
import {
  applyPhoneMask,
  deletePhoneDigitBefore,
  formatRuPhone,
  normalizeRuPhone,
  ruPhoneNationalDigits,
} from "@/presentation/lib/phone";

describe("ruPhoneNationalDigits", () => {
  it("срезает код страны 7 и междугородную 8", () => {
    expect(ruPhoneNationalDigits("+7 (999) 123-45-67")).toBe("9991234567");
    expect(ruPhoneNationalDigits("89991234567")).toBe("9991234567");
    expect(ruPhoneNationalDigits("9991234567")).toBe("9991234567");
  });

  it("держит не больше 10 цифр", () => {
    expect(ruPhoneNationalDigits("+7 999 123 45 67 89")).toBe("9991234567");
  });

  it("игнорирует любые нецифры", () => {
    expect(ruPhoneNationalDigits("тел: 8-999-abc-12-34")).toBe("9991234");
  });
});

describe("formatRuPhone", () => {
  it("наращивает маску по мере ввода", () => {
    expect(formatRuPhone("")).toBe("");
    expect(formatRuPhone("9")).toBe("+7 (9");
    expect(formatRuPhone("999")).toBe("+7 (999");
    expect(formatRuPhone("9991")).toBe("+7 (999) 1");
    expect(formatRuPhone("9991234")).toBe("+7 (999) 123-4");
    expect(formatRuPhone("9991234567")).toBe("+7 (999) 123-45-67");
  });

  it("ввод с 8 превращается в +7", () => {
    expect(formatRuPhone("89991234567")).toBe("+7 (999) 123-45-67");
  });

  it("вставка из буфера в любом виде даёт одну и ту же маску", () => {
    expect(formatRuPhone("+7 999 123-45-67")).toBe("+7 (999) 123-45-67");
    expect(formatRuPhone("8 (999) 123 45 67")).toBe("+7 (999) 123-45-67");
  });
});

describe("applyPhoneMask", () => {
  it("ставит каретку после введённой цифры", () => {
    expect(applyPhoneMask("9", 1)).toEqual({ value: "+7 (9", caret: 5 });
    expect(applyPhoneMask("9991234567", 10)).toEqual({
      value: "+7 (999) 123-45-67",
      caret: 18,
    });
  });

  it("сохраняет позицию при правке в середине номера", () => {
    // "+7 (999) 123-45-67" → пользователь заменил 4-ю цифру на 5
    const result = applyPhoneMask("+7 (999) 523-45-67", 10);
    expect(result.value).toBe("+7 (999) 523-45-67");
    expect(result.caret).toBe(10);
  });

  it("пустое значение не оставляет хвоста маски", () => {
    expect(applyPhoneMask("", 0)).toEqual({ value: "", caret: 0 });
    expect(applyPhoneMask("+7 (", 4)).toEqual({ value: "", caret: 0 });
  });
});

describe("deletePhoneDigitBefore", () => {
  it("Backspace на разделителе съедает цифру, а не пунктуацию", () => {
    // каретка сразу после "() " — перед ней разделитель, удалить надо 9
    const result = deletePhoneDigitBefore("+7 (999) 123-45-67", 9);
    expect(result.value).toBe("+7 (991) 234-56-7");
    expect(result.caret).toBe(6);
  });

  it("удаление последней цифры очищает поле", () => {
    expect(deletePhoneDigitBefore("+7 (9", 5)).toEqual({ value: "", caret: 0 });
  });
});

describe("normalizeRuPhone", () => {
  it("канонический вид для бекенда", () => {
    expect(normalizeRuPhone("+7 (999) 123-45-67")).toBe("+79991234567");
    expect(normalizeRuPhone("8 999 123 45 67")).toBe("+79991234567");
  });

  it("неполный номер отвергается", () => {
    expect(normalizeRuPhone("+7 (999) 123-45-6")).toBeNull();
    expect(normalizeRuPhone("")).toBeNull();
  });
});
