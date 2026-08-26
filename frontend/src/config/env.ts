import { z } from "zod";

const isFullUrl = (value: string) => z.string().url().safeParse(value).success;

const schema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .refine(
      (value) => value.startsWith("/") || isFullUrl(value),
      "NEXT_PUBLIC_API_URL must be a full url or a same-origin path, e.g. http://localhost:4000/api or /api",
    )
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
