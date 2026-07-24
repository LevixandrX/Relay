import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

const url = process.env.DATABASE_URL ?? "file:./data/relay.db";

function resolveFileUrl(fileUrl: string) {
  if (!fileUrl.startsWith("file:")) return fileUrl;
  const rel = fileUrl.replace(/^file:/, "");
  const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
  const abs = path.isAbsolute(rel)
    ? rel
    : path.join(/* turbopackIgnore: true */ process.cwd(), rel);
  fs.mkdirSync(path.dirname(abs) || dataDir, { recursive: true });
  return `file:${abs}`;
}

const client = createClient({ url: resolveFileUrl(url) });

export const db = drizzle(client, { schema });
export { client };
