import { z } from "zod";

/**
 * The settings tree is four related tables and the shape is owned by
 * `settings.service.ts`, which merges a patch into the current values and maps the
 * result onto those tables. Validating every leaf here would duplicate that shape in
 * a second place and guarantee the two drift.
 *
 * What this does enforce is that the body is an object rather than an array, a
 * string or null - a patch that is not an object cannot be merged, and a silent
 * failure there would look like a save that worked.
 */
export const settingsPatchSchema = z
  .looseObject({})
  .refine((value) => !Array.isArray(value), { message: "settings patch must be an object" });
