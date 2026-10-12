import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("Zadejte platný e-mail."));
const password = z
  .string()
  .min(8, "Heslo musí mít alespoň 8 znaků.")
  .max(72, "Heslo může mít nejvýše 72 znaků.")
  .regex(/[A-Za-zÀ-ž]/, "Heslo musí obsahovat písmeno.")
  .regex(/\d/, "Heslo musí obsahovat číslici.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Zadejte heslo.").max(72),
});

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2, "Zadejte jméno (alespoň 2 znaky).").max(80, "Jméno je příliš dlouhé."),
    email,
    password,
    passwordConfirm: z.string(),
    inviteCode: z.string().trim().max(64).optional(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Hesla se neshodují.",
    path: ["passwordConfirm"],
  });

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, passwordConfirm: z.string() })
  .refine((d) => d.password === d.passwordConfirm, { message: "Hesla se neshodují.", path: ["passwordConfirm"] });
