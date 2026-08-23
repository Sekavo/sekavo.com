import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  businessName: z.string().max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const invoiceCreateSchema = z.object({
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().email().max(200),
  number: z.string().min(1).max(40),
  amountCents: z.number().int().positive().max(1_000_000_00_00),
  currency: z.string().length(3).default("USD"),
  issuedAt: z.string(), // ISO date
  dueAt: z.string(),
  paymentUrl: z.string().url().max(500).optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export const invoiceUpdateSchema = invoiceCreateSchema.partial().extend({
  status: z.enum(["active", "paid", "void", "disputed", "bad_debt"]).optional(),
  chasingEnabled: z.boolean().optional(),
});

export const settingsUpdateSchema = z.object({
  senderName: z.string().min(1).max(120),
  senderEmail: z.string().email().max(200),
  replyTo: z.string().email().max(200).optional().or(z.literal("")),
  ccOwner: z.boolean().optional(),
  signature: z.string().max(1000).optional(),
  businessName: z.string().max(120).optional(),
  lateFeePolicy: z.string().max(300).optional(),
  catchUpOnLate: z.boolean().optional(),
  pauseOnReplyDays: z.number().int().min(1).max(30).optional(),
  defaultPaymentUrl: z.string().url().max(500).optional().or(z.literal("")),
  onboardingDone: z.boolean().optional(),
  sequence: z
    .array(
      z.object({
        offsetDays: z.number().int().min(-60).max(365),
        label: z.string().min(1).max(60),
        subjectTemplate: z.string().min(1).max(300),
        bodyTemplate: z.string().min(1).max(8000),
      })
    )
    .min(1)
    .max(12)
    .optional(),
});
