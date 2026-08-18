import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * All admin writes go through the *user-scoped* Supabase client, so the database
 * RLS policies (`has_role(auth.uid(),'admin')`) remain the real gate. The role
 * check below is a defence-in-depth guard and drives audit logging.
 */

const text = z
  .string()
  .trim()
  .max(8000)
  .nullish()
  .transform((v) => v ?? null);
const shortText = z
  .string()
  .trim()
  .max(400)
  .nullish()
  .transform((v) => v ?? null);
const list = z
  .array(z.string().trim().min(1).max(1000))
  .max(80)
  .nullish()
  .transform((v) => v ?? null);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish()
  .transform((v) => v ?? null);
const optionalUrl = z
  .union([z.string().trim().url().max(500), z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null));
const uuid = z.string().uuid();

const medicineSchema = z.object({
  id: uuid.optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only"),
  generic_name: z.string().trim().min(2).max(200),
  display_name: z.string().trim().min(2).max(200),
  active_ingredient: shortText,
  salt: shortText,
  synonyms: list,
  description: text,
  category: shortText,
  strengths: list,
  dosage_forms: list,
  routes: list,
  mechanism_of_action: text,
  pharmacodynamics: text,
  absorption: text,
  distribution: text,
  metabolism: text,
  excretion: text,
  bioavailability: shortText,
  half_life: shortText,
  protein_binding: shortText,
  volume_of_distribution: shortText,
  clearance: shortText,
  onset: shortText,
  duration: shortText,
  indications: list,
  contraindications: list,
  warnings: list,
  precautions: list,
  common_adverse_effects: list,
  serious_adverse_effects: list,
  drug_interactions: list,
  food_interactions: list,
  monitoring: list,
  storage: text,
  patient_counselling: list,
  pregnancy: text,
  lactation: text,
  pediatric: text,
  geriatric: text,
  renal: text,
  hepatic: text,
  advantages: list,
  disadvantages: list,
  key_points: list,
  memory_trick: text,
  key_suffix: shortText,
  pronunciation_en: shortText,
  pronunciation_hi: shortText,
  pronunciation_ipa: shortText,
  status: z.enum(["published", "draft", "archived"]),
  verification_status: z.enum(["verified", "unverified", "needs_review"]),
  last_verified: isoDate,
  data_version: z.string().trim().min(1).max(20),
});

export type MedicineFormValues = z.infer<typeof medicineSchema>;

type Ctx = { supabase: any; userId: string };

async function assertAdmin(context: Ctx) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

async function audit(
  context: Ctx,
  action: string,
  table_name: string,
  record_id: string | null,
  details: Record<string, unknown>,
) {
  await context.supabase.from("admin_audit_logs").insert({
    user_id: context.userId,
    action,
    table_name,
    record_id,
    details,
  });
}

export const checkIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: !!data };
  });

export const saveMedicine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => medicineSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { id, ...values } = data;

    if (id) {
      const { data: row, error } = await context.supabase
        .from("medicines")
        .update(values)
        .eq("id", id)
        .select("id, slug")
        .maybeSingle();
      if (error) throw new Error("Could not save this medicine.");
      if (!row) throw new Error("Medicine not found.");
      await audit(context as Ctx, "medicine.update", "medicines", row.id, { slug: row.slug });
      return { id: row.id as string, slug: row.slug as string };
    }

    const { data: row, error } = await context.supabase
      .from("medicines")
      .insert(values)
      .select("id, slug")
      .maybeSingle();
    if (error) throw new Error("Could not create this medicine. The slug may already exist.");
    await audit(context as Ctx, "medicine.create", "medicines", row?.id ?? null, {
      slug: values.slug,
    });
    return { id: row!.id as string, slug: row!.slug as string };
  });

export const setMedicineStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: uuid, status: z.enum(["published", "draft", "archived"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase
      .from("medicines")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("Could not update the status.");
    await audit(context as Ctx, `medicine.${data.status}`, "medicines", data.id, {
      status: data.status,
    });
    return { ok: true };
  });

/* ---------------- brands & manufacturers ---------------- */

const brandSchema = z.object({
  id: uuid.optional(),
  medicine_id: uuid,
  brand_name: z.string().trim().min(1).max(200),
  manufacturer_id: uuid.nullish().transform((v) => v ?? null),
  composition: shortText,
  strength: shortText,
  dosage_form: shortText,
  route: shortText,
  source: shortText,
  verified: z.boolean(),
  last_verified: isoDate,
});

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => brandSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { id, ...values } = data;
    const q = id
      ? context.supabase.from("brands").update(values).eq("id", id)
      : context.supabase.from("brands").insert(values);
    const { error } = await q;
    if (error) throw new Error("Could not save this brand.");
    await audit(context as Ctx, id ? "brand.update" : "brand.create", "brands", id ?? null, {
      brand_name: values.brand_name,
    });
    return { ok: true };
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase.from("brands").delete().eq("id", data.id);
    if (error) throw new Error("Could not remove this brand.");
    await audit(context as Ctx, "brand.delete", "brands", data.id, {});
    return { ok: true };
  });

export const saveManufacturer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: uuid.optional(),
        name: z.string().trim().min(2).max(200),
        country: shortText,
        website: optionalUrl,
        status: z.enum(["active", "inactive"]).default("active"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { id, ...values } = data;
    const payload = { ...values };
    const q = id
      ? context.supabase.from("manufacturers").update(payload).eq("id", id)
      : context.supabase.from("manufacturers").insert(payload);
    const { error } = await q;
    if (error) throw new Error("Could not save this manufacturer.");
    await audit(
      context as Ctx,
      id ? "manufacturer.update" : "manufacturer.create",
      "manufacturers",
      id ?? null,
      { name: values.name },
    );
    return { ok: true };
  });

/* ---------------- classifications ---------------- */

export const setMedicineClasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        medicine_id: uuid,
        classes: z.array(z.object({ class_id: uuid, is_primary: z.boolean() })).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const del = await context.supabase
      .from("medicine_classifications")
      .delete()
      .eq("medicine_id", data.medicine_id);
    if (del.error) throw new Error("Could not update classifications.");
    if (data.classes.length) {
      const { error } = await context.supabase.from("medicine_classifications").insert(
        data.classes.map((c) => ({
          medicine_id: data.medicine_id,
          class_id: c.class_id,
          is_primary: c.is_primary,
        })),
      );
      if (error) throw new Error("Could not update classifications.");
    }
    await audit(
      context as Ctx,
      "medicine.classifications",
      "medicine_classifications",
      data.medicine_id,
      { count: data.classes.length },
    );
    return { ok: true };
  });

/* ---------------- references ---------------- */

export const saveReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        medicine_id: uuid,
        source_name: z.string().trim().min(2).max(300),
        source_type: shortText,
        source_url: optionalUrl,
        notes: text,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { data: ref, error } = await context.supabase
      .from("references")
      .insert({
        source_name: data.source_name,
        source_type: data.source_type,
        source_url: data.source_url,
        notes: data.notes,
        accessed_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .maybeSingle();
    if (error || !ref) throw new Error("Could not save this reference.");
    const link = await context.supabase
      .from("medicine_references")
      .insert({ medicine_id: data.medicine_id, reference_id: ref.id });
    if (link.error) throw new Error("Could not link this reference.");
    await audit(context as Ctx, "reference.create", "references", ref.id as string, {
      source_name: data.source_name,
    });
    return { ok: true };
  });

export const unlinkReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ medicine_id: uuid, reference_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const { error } = await context.supabase
      .from("medicine_references")
      .delete()
      .eq("medicine_id", data.medicine_id)
      .eq("reference_id", data.reference_id);
    if (error) throw new Error("Could not remove this reference.");
    await audit(context as Ctx, "reference.unlink", "medicine_references", data.reference_id, {});
    return { ok: true };
  });

/* ---------------- bulk import & bulk operations ---------------- */

/**
 * Imported records are validated field-by-field and always land as `draft` /
 * `unverified` — an import can never mark data as verified.
 */
const importRowSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only"),
  generic_name: z.string().trim().min(2).max(200),
  display_name: z.string().trim().min(2).max(200),
  active_ingredient: shortText,
  salt: shortText,
  category: shortText,
  description: text,
  mechanism_of_action: text,
  indications: list,
  contraindications: list,
  common_adverse_effects: list,
  dosage_forms: list,
  routes: list,
  strengths: list,
  pronunciation_en: shortText,
});

export type MedicineImportRow = z.infer<typeof importRowSchema>;

export const importMedicines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ rows: z.array(importRowSchema).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);

    const slugs = data.rows.map((r) => r.slug);
    const { data: existing } = await context.supabase
      .from("medicines")
      .select("slug")
      .in("slug", slugs);
    const taken = new Set((existing ?? []).map((r: { slug: string }) => r.slug));

    const inserted: string[] = [];
    const skipped: { slug: string; reason: string }[] = [];

    for (const row of data.rows) {
      if (taken.has(row.slug)) {
        skipped.push({ slug: row.slug, reason: "Already exists" });
        continue;
      }
      const { error } = await context.supabase.from("medicines").insert({
        ...row,
        status: "draft",
        verification_status: "unverified",
        data_version: "import",
      });
      if (error) skipped.push({ slug: row.slug, reason: "Could not be saved" });
      else {
        inserted.push(row.slug);
        taken.add(row.slug);
      }
    }

    await audit(context as Ctx, "medicine.import", "medicines", null, {
      inserted: inserted.length,
      skipped: skipped.length,
    });

    return { inserted, skipped };
  });

export const bulkUpdateMedicines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ids: z.array(uuid).min(1).max(500),
        status: z.enum(["published", "draft", "archived"]).optional(),
        verification_status: z.enum(["verified", "unverified", "needs_review"]).optional(),
      })
      .refine((v) => v.status || v.verification_status, "Nothing to update")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const patch: Record<string, string> = {};
    if (data.status) patch["status"] = data.status;
    if (data.verification_status) patch["verification_status"] = data.verification_status;
    if (data.verification_status === "verified")
      patch["last_verified"] = new Date().toISOString().slice(0, 10);

    const { error } = await context.supabase
      .from("medicines")
      .update(patch as never)
      .in("id", data.ids);
    if (error) throw new Error("Could not apply the bulk update.");
    await audit(context as Ctx, "medicine.bulk_update", "medicines", null, {
      count: data.ids.length,
      ...patch,
    });
    return { ok: true, count: data.ids.length };
  });
