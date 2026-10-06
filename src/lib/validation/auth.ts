import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name kam az kam 2 characters ka ho").max(80),
  email: z.string().trim().toLowerCase().email("Valid email likho"),
  password: z
    .string()
    .min(8, "Password kam az kam 8 characters ka ho")
    .max(72, "Password bohat lamba hai"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;