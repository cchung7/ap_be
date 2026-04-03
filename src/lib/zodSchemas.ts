import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createEventSchema = z.object({
  title: z.string().min(1),
  category: z.enum([
    "VOLUNTEERING",
    "SOCIAL",
    "PROFESSIONAL_DEVELOPMENT",
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime must be HH:mm"),
  location: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().min(0).optional(),
  pointsValue: z.number().int().min(0).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const checkinSchema = z.object({
  code: z.string().min(1),
});

export const academicYearOptions = [
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Graduate",
  "Alumni",
] as const;

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .optional();

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(100, "Name is too long."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address."),
    academicYear: z
      .union([z.enum(academicYearOptions), z.literal("")])
      .optional(),
    major: optionalTrimmedString,

    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmNewPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasAnyPasswordField = Boolean(
      data.currentPassword || data.newPassword || data.confirmNewPassword
    );

    if (!hasAnyPasswordField) return;

    if (!data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentPassword"],
        message: "Current password is required to change your password.",
      });
    }

    if (!data.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password is required.",
      });
    }

    if (!data.confirmNewPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmNewPassword"],
        message: "Please confirm your new password.",
      });
    }

    if (data.newPassword && data.newPassword.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must be at least 8 characters.",
      });
    }

    if (
      data.newPassword &&
      data.currentPassword &&
      data.newPassword === data.currentPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must be different from your current password.",
      });
    }

    if (
      data.newPassword &&
      data.confirmNewPassword &&
      data.newPassword !== data.confirmNewPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmNewPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;