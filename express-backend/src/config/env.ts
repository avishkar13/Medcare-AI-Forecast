import { config as loadDotenv } from "dotenv";
import { envSchema } from "../zod/env.schemas.js";
import { toReadableLines } from "../zod/errors.js";

loadDotenv({ quiet: true });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  process.stderr.write(`Invalid environment configuration:\n${toReadableLines(parsed.error)}\n`);
  process.exit(1);
}

export const env = parsed.data;
