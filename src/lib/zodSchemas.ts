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