import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { oauthAccounts, users, type User } from "@/db/schema";
import { ApiError } from "@/lib/errors";

export function userHasPassword(user: Pick<User, "passwordHash">) {
  return Boolean(user.passwordHash && user.passwordHash.length >= 20);
}

const AVATAR_DATA = /^data:image\/(jpeg|png|webp);base64,/i;

export function parseAvatarInput(value: string | null) {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    if (trimmed.length > 2000) {
      throw new ApiError(400, "validation_error", "Ссылка на аватар слишком длинная");
    }
    return trimmed;
  }
  if (AVATAR_DATA.test(trimmed)) {
    if (trimmed.length > 140_000) {
      throw new ApiError(400, "validation_error", "Файл аватара слишком большой");
    }
    return trimmed;
  }
  throw new ApiError(400, "validation_error", "Некорректный аватар");
}

export async function updateProfile(
  userId: string,
  input: { name?: string; avatarUrl?: string | null },
) {
  const patch: { name?: string; avatarUrl?: string | null } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 1 || name.length > 80) {
      throw new ApiError(400, "validation_error", "Имя должно быть от 1 до 80 символов");
    }
    patch.name = name;
  }
  if (input.avatarUrl !== undefined) {
    patch.avatarUrl = parseAvatarInput(input.avatarUrl);
  }
  if (Object.keys(patch).length === 0) {
    throw new ApiError(400, "validation_error", "Нечего менять");
  }
  await db.update(users).set(patch).where(eq(users.id, userId));
}

export async function listLinkedProviders(userId: string) {
  const rows = await db
    .select({ provider: oauthAccounts.provider })
    .from(oauthAccounts)
    .where(eq(oauthAccounts.userId, userId));
  return rows.map((r) => r.provider);
}
