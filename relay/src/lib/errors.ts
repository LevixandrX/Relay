export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function apiError(status: number, code: string, message: string, details?: unknown) {
  return Response.json({ error: code, message, details }, { status });
}

export function json<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

function zodMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Проверь данные формы";
  const issues = (err as { issues?: { message?: string; path?: (string | number)[] }[] }).issues;
  if (!issues?.length) return "Проверь данные формы";
  const first = issues[0];
  const path = first.path?.join(".") ?? "";
  if (first.message && first.message !== "Invalid input" && !first.message.startsWith("Invalid")) {
    return first.message;
  }
  if (path.includes("email")) return "Укажи корректный email";
  if (path.includes("password")) return "Пароль слишком короткий (минимум 8 символов)";
  if (path.includes("name")) return "Укажи имя";
  return "Проверь данные формы";
}

export function handleRouteError(err: unknown) {
  if (err instanceof ApiError) {
    return apiError(err.status, err.code, err.message, err.details);
  }
  if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
    return apiError(400, "validation_error", zodMessage(err), err);
  }
  console.error(err);
  return apiError(500, "internal_error", "Что-то пошло не так");
}
