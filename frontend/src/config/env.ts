import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_API_URL must not be empty")
    .transform((value) => value.replace(/\/+$/, "")),
});

// next inlines NEXT_PUBLIC_* at build time, so it has to be read as a literal
// property. process.env[name] would come back undefined in the browser.
const parsed = schema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!parsed.success) {
  throw new Error(
    `invalid environment:\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`,
  );
}

export const env = {
  apiUrl: parsed.data.NEXT_PUBLIC_API_URL,
  isDev: process.env.NODE_ENV === "development",
} as const;
