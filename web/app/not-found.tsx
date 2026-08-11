import type { Metadata } from "next";
import { ErrorScreen } from "@/presentation/components/layout/ErrorScreen";
import { Button } from "@/presentation/components/primitives/Button";

export const metadata: Metadata = {
  title: "Страница не найдена",
};

export default function NotFound() {
  return (
    <main>
      <ErrorScreen
        code="404"
        title="Страница не найдена"
        text="Возможно, ссылка устарела или страница переехала. Начните с главной — там всё самое важное."
        actions={
          <>
            <Button href="/">На главную</Button>
            <Button href="/planirovki" variant="ghost">
              Смотреть планировки
            </Button>
          </>
        }
      />
    </main>
  );
}
