import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { env } from "@/lib/env";
import * as schema from "./schema";

const client = createClient({
  url: env.tursoUrl,
  authToken: env.tursoToken,
});

export const db = drizzle(client, { schema });
