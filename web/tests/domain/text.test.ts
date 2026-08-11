import { describe, expect, it } from "vitest";
import { stripHtml, truncateAtWord } from "@/domain";

describe("truncateAtWord", () => {
  it("возвращает короткий текст как есть (без многоточия)", () => {
    expect(truncateAtWord("Короткий текст", 160)).toBe("Короткий текст");
    expect(truncateAtWord("ровно", 5)).toBe("ровно");
  });

  it("режет по границе слова и добавляет многоточие", () => {
    expect(truncateAtWord("aaa bbb ccc ddd", 10)).toBe("aaa bbb…");
  });

  it("жёсткий срез, когда пробела рядом нет (сверхдлинное слово)", () => {
    const long = "a".repeat(80);
    expect(truncateAtWord(long, 10)).toBe(`${"a".repeat(10)}…`);
  });

  it("жёсткий срез, когда последний пробел дальше 40 символов от точки среза", () => {
    const text = `ab ${"c".repeat(100)}`;
    const result = truncateAtWord(text, 50);
    // откат к пробелу на позиции 2 съел бы почти всё — режем по max
    expect(result).toBe(`${text.slice(0, 50)}…`);
  });

  it("срезает хвостовую пунктуацию перед многоточием", () => {
    expect(truncateAtWord("Слово раз, два три", 11)).toBe("Слово раз…");
    expect(truncateAtWord("Конец предложения. И ещё немного текста", 19)).toBe(
      "Конец предложения…",
    );
  });

  it("не плодит двойное многоточие и укладывается в лимит по умолчанию", () => {
    const text = `${"слово ".repeat(40)}конец`;
    const result = truncateAtWord(text);
    expect(result.endsWith("…")).toBe(true);
    expect(result.includes("……")).toBe(false);
    expect(result.length).toBeLessThanOrEqual(161); // 160 + «…»
  });
});

describe("stripHtml", () => {
  it("сохраняет прежнее поведение (регресс-щуп)", () => {
    expect(stripHtml("<p>Привет&nbsp;<b>мир</b></p>")).toBe("Привет мир");
  });
});
