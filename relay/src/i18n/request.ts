import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isAppLocale, localeCookieName } from "./config";
import { localeFromAcceptLanguage } from "./detectLocale";

export default getRequestConfig(async () => {
  const store = await cookies();
  const saved = store.get(localeCookieName)?.value;
  const locale = isAppLocale(saved)
    ? saved
    : localeFromAcceptLanguage((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
