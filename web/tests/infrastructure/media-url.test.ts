import { describe, expect, it } from "vitest";
import { mediaUrl } from "@/infrastructure/api/media-url";

describe("mediaUrl", () => {
  it("переводит относительный путь API в /cms-media (rewrite на бекенд)", () => {
    expect(mediaUrl("/media/uploads/plan.jpg")).toBe("/cms-media/uploads/plan.jpg");
    expect(mediaUrl("media/uploads/plan.jpg")).toBe("/cms-media/uploads/plan.jpg");
  });

  it("пропускает абсолютные URL как есть", () => {
    expect(mediaUrl("http://localhost:8000/media/x.jpg")).toBe(
      "http://localhost:8000/media/x.jpg",
    );
    expect(mediaUrl("https://cdn.example.com/x.jpg")).toBe("https://cdn.example.com/x.jpg");
  });

  it("пустое значение → null", () => {
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl(undefined)).toBeNull();
    expect(mediaUrl("")).toBeNull();
  });

  it("не трогает прочие относительные пути (локальные ассеты сайта)", () => {
    expect(mediaUrl("/og/default.jpg")).toBe("/og/default.jpg");
  });
});
