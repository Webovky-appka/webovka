import * as z from "zod";

/**
 * Pravidla pro změnu hesla. Žijí mimo Server Action, aby šla otestovat —
 * "use server" soubory smí exportovat jen asynchronní funkce.
 */
export const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Zadejte současné heslo."),
    newPassword: z
      .string()
      .min(10, "Nové heslo musí mít alespoň 10 znaků.")
      .max(200, "Heslo je příliš dlouhé."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Nové heslo a jeho potvrzení se neshodují.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: "Nové heslo se musí lišit od současného.",
    path: ["newPassword"],
  });

export const PinSchema = z.object({
  token: z.string().trim().min(1),
  pin: z.string().trim().regex(/^\d{6}$/, "PIN má šest číslic."),
});
