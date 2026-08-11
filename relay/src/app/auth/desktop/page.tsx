import Link from "next/link";
import { BrandLockup } from "@/components/BrandMark";

type Props = { searchParams: Promise<{ provider?: string; status?: string }> };

const LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  yandex: "Яндекс",
  vk: "VK",
};

export default async function DesktopHandoffPage({ searchParams }: Props) {
  const { provider, status } = await searchParams;
  const label = LABELS[provider ?? ""] ?? "провайдер";
  const expired = status === "expired";
  const nopair = status === "nopair";

  const title = nopair ? "Открой вход из приложения" : expired ? "Приложение не дождалось" : "Готово";
  const lede = nopair
    ? `Вход через ${label} прошёл в браузере, но без рукопожатия с приложением. Вернись в Relay и нажми «Продолжить с ${label}» ещё раз.`
    : expired
      ? `Вход через ${label} прошёл, но приложение перестало ждать. Вернись в Relay и нажми кнопку входа ещё раз.`
      : `Вход через ${label} подтверждён. Вернись в приложение Relay — оно уже подхватило сессию.`;

  return (
    <div className="relay-auth">
      <div className="relay-auth-card" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <BrandLockup href="/" />
        </div>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          Эту вкладку можно закрыть. Или <Link href="/app">открыть Relay в браузере</Link>.
        </p>
      </div>
    </div>
  );
}
