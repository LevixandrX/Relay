/** Short dates use the locale's CLDR month names and date order. */
export function compactTime(value: string, locale: string, justNow: string, now = Date.now()) {
  const date = new Date(value), seconds = Math.max(0, (now - date.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return justNow;
  const ru = locale.startsWith('ru');
  if (seconds < 3600) return `${Math.floor(seconds / 60)}${ru ? 'м' : 'm'}`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}${ru ? 'ч' : 'h'}`;
  if (seconds <= 604800) return `${Math.floor(seconds / 86400)}${ru ? 'д' : 'd'}`;
  return new Intl.DateTimeFormat(locale, {month:'short',day:'numeric',...(date.getFullYear() !== new Date(now).getFullYear() ? {year:'numeric' as const} : {})}).format(date);
}

export function activityTime(value: string, locale: string, justNow: string, style: 'compact' | 'long', now = Date.now()) {
  const date = new Date(value), seconds = Math.max(0, (now - date.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return justNow;
  if (style === 'compact') {
    const text = compactTime(value,locale,justNow,now);
    return seconds <= 604800 ? `${text} ${locale.startsWith('ru') ? 'назад' : 'ago'}` : text;
  }
  if (seconds <= 604800) {
    const unit = seconds < 3600 ? 'minute' : seconds < 86400 ? 'hour' : 'day';
    const count = Math.floor(seconds / (unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 86400));
    return new Intl.RelativeTimeFormat(locale,{numeric:'always',style:'long'}).format(-count,unit);
  }
  return new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',...(date.getFullYear() !== new Date(now).getFullYear() ? {year:'numeric' as const} : {})}).format(date);
}

export function exactTime(value: string, locale: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale,{dateStyle:'long',timeStyle:'medium'}).format(date) : '';
}
