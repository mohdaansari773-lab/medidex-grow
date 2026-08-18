import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Medicine = Tables<"medicines">;
export type DrugClass = Tables<"drug_classes">;
export type Brand = Tables<"brands">;
export type MedicalTerm = Tables<"medical_terms">;
export type Flashcard = Tables<"flashcards">;
export type QuizQuestion = Tables<"quiz_questions">;
export type SuffixPattern = Tables<"suffix_patterns">;

const LIST_COLUMNS =
  "id, slug, generic_name, display_name, salt, active_ingredient, category, description, pronunciation_en, key_suffix, verification_status";

export type MedicineListItem = Pick<
  Medicine,
  | "id"
  | "slug"
  | "generic_name"
  | "display_name"
  | "salt"
  | "active_ingredient"
  | "category"
  | "description"
  | "pronunciation_en"
  | "key_suffix"
  | "verification_status"
>;

export const medicinesQuery = (category?: string) =>
  queryOptions({
    queryKey: ["medicines", category ?? "all"],
    queryFn: async (): Promise<MedicineListItem[]> => {
      let q = supabase.from("medicines").select(LIST_COLUMNS).order("generic_name");
      if (category) q = q.eq("category", category);
      const { data, error } = await q.returns<MedicineListItem[]>();
      if (error) throw error;
      return data ?? [];
    },
  });

export const medicineQuery = (slug: string) =>
  queryOptions({
    queryKey: ["medicine", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicines")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const medicineBrandsQuery = (medicineId: string | undefined) =>
  queryOptions({
    queryKey: ["brands", medicineId],
    enabled: !!medicineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*, manufacturers(name)")
        .eq("medicine_id", medicineId!)
        .order("brand_name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const medicineClassesQuery = (medicineId: string | undefined) =>
  queryOptions({
    queryKey: ["medicine-classes", medicineId],
    enabled: !!medicineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicine_classifications")
        .select("is_primary, drug_classes(*)")
        .eq("medicine_id", medicineId!);
      if (error) throw error;
      return (data ?? []).flatMap((r) => (r.drug_classes ? [r.drug_classes] : []));
    },
  });

export const medicineReferencesQuery = (medicineId: string | undefined) =>
  queryOptions({
    queryKey: ["medicine-references", medicineId],
    enabled: !!medicineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicine_references")
        .select("references(*)")
        .eq("medicine_id", medicineId!);
      if (error) throw error;
      return (data ?? []).flatMap((r) => (r.references ? [r.references] : []));
    },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const medicineInteractionsQuery = (medicineId: string | undefined) =>
  queryOptions({
    queryKey: ["medicine-interactions", medicineId],
    enabled: !!medicineId && UUID_RE.test(medicineId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drug_interactions")
        .select(
          "*, a:medicines!drug_interactions_medicine_a_id_fkey(display_name, slug), b:medicines!drug_interactions_medicine_b_id_fkey(display_name, slug)",
        )
        .or(`medicine_a_id.eq.${medicineId},medicine_b_id.eq.${medicineId}`);

      if (error) throw error;
      return data ?? [];
    },
  });

export const drugClassesQuery = () =>
  queryOptions({
    queryKey: ["drug-classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drug_classes").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const drugClassQuery = (slug: string) =>
  queryOptions({
    queryKey: ["drug-class", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drug_classes")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const classMedicinesQuery = (classId: string | undefined) =>
  queryOptions({
    queryKey: ["class-medicines", classId],
    enabled: !!classId,
    queryFn: async (): Promise<MedicineListItem[]> => {
      const { data, error } = await supabase
        .from("medicine_classifications")
        .select(`medicines(${LIST_COLUMNS})`)
        .eq("class_id", classId!);
      if (error) throw error;
      return (data ?? []).flatMap((r) =>
        r.medicines ? [r.medicines as unknown as MedicineListItem] : [],
      );
    },
  });

export const termsQuery = () =>
  queryOptions({
    queryKey: ["medical-terms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("medical_terms").select("*").order("term");
      if (error) throw error;
      return data ?? [];
    },
  });

export const suffixesQuery = () =>
  queryOptions({
    queryKey: ["suffixes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suffix_patterns").select("*").order("suffix");
      if (error) throw error;
      return data ?? [];
    },
  });

export const mnemonicsQuery = () =>
  queryOptions({
    queryKey: ["mnemonics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mnemonics").select("*").order("title");
      if (error) throw error;
      return data ?? [];
    },
  });

export const flashcardsQuery = (topic?: string) =>
  queryOptions({
    queryKey: ["flashcards", topic ?? "all"],
    queryFn: async () => {
      let q = supabase.from("flashcards").select("*");
      if (topic && topic !== "all") q = q.eq("topic", topic);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

export const quizQuery = (topic?: string) =>
  queryOptions({
    queryKey: ["quiz", topic ?? "all"],
    queryFn: async () => {
      let q = supabase.from("quiz_questions").select("*");
      if (topic && topic !== "all") q = q.eq("topic", topic);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

export type SearchResult = {
  kind: "medicine" | "brand" | "class" | "term" | "manufacturer";
  title: string;
  subtitle: string;
  href: string;
  pronunciation?: string | null;
  /** Lower is better — drives result ordering. */
  rank?: number;
};

/**
 * Ranking tiers used by global search:
 * 1 exact generic • 2 exact brand • 3 exact salt • 4 exact active ingredient
 * 5 exact classification • 6 prefix match • 7 partial match • 8 related term
 */
function rankFor(value: string | null | undefined, needle: string, exactTier: number) {
  const v = (value ?? "").toLowerCase();
  if (!v) return 8;
  if (v === needle) return exactTier;
  if (v.startsWith(needle)) return 6;
  if (v.includes(needle)) return 7;
  return 8;
}

/** Global search across medicines, brands, classes, manufacturers and medical terms. */
export const searchQuery = (term: string) =>
  queryOptions({
    queryKey: ["search", term],
    enabled: term.trim().length >= 2,
    queryFn: async (): Promise<SearchResult[]> => {
      // Strip characters that are meaningful inside PostgREST filter expressions
      // (comma, parentheses, quotes, wildcards) so user input can never alter the query.
      const t = term.trim().slice(0, 80).replace(/[,()"'*%\\]/g, " ").trim();
      if (t.length < 2) return [];
      const needle = t.toLowerCase();
      const like = `%${t}%`;
      const [meds, synMeds, brands, classes, terms, makers] = await Promise.all([
        supabase
          .from("medicines")
          .select(
            "slug, display_name, generic_name, salt, active_ingredient, category, pronunciation_en",
          )
          .or(
            `generic_name.ilike.${like},display_name.ilike.${like},salt.ilike.${like},active_ingredient.ilike.${like}`,
          )
          .limit(15),
        supabase
          .from("medicines")
          .select(
            "slug, display_name, generic_name, salt, active_ingredient, category, pronunciation_en",
          )
          .contains("synonyms", [t])
          .limit(5),
        supabase
          .from("brands")
          .select(
            "brand_name, composition, strength, verified, medicines(slug, display_name), manufacturers(name)",
          )
          .ilike("brand_name", like)
          .limit(10),
        supabase.from("drug_classes").select("slug, name, class_type").ilike("name", like).limit(8),
        supabase
          .from("medical_terms")
          .select("slug, term, simple_definition")
          .ilike("term", like)
          .limit(8),
        supabase.from("manufacturers").select("id, name, country").ilike("name", like).limit(5),
      ]);

      const results: SearchResult[] = [];
      const seen = new Set<string>();

      for (const m of [...(meds.data ?? []), ...(synMeds.data ?? [])]) {
        if (seen.has(m.slug)) continue;
        seen.add(m.slug);
        const rank = Math.min(
          rankFor(m.generic_name, needle, 1),
          rankFor(m.display_name, needle, 1),
          rankFor(m.salt, needle, 3),
          rankFor(m.active_ingredient, needle, 4),
        );
        results.push({
          kind: "medicine",
          title: m.display_name,
          subtitle: [m.salt, m.category].filter(Boolean).join(" • ") || "Medicine",
          href: `/medicines/${m.slug}`,
          pronunciation: m.pronunciation_en,
          rank,
        });
      }

      for (const b of brands.data ?? [])
        results.push({
          kind: "brand",
          title: b.brand_name,
          subtitle: `Brand${b.manufacturers?.name ? ` • ${b.manufacturers.name}` : ""} • ${
            b.verified ? (b.composition ?? "composition on record") : "composition not yet verified"
          }${b.strength ? ` ${b.strength}` : ""}`,
          href: b.medicines ? `/medicines/${b.medicines.slug}` : "/medicines",
          rank: rankFor(b.brand_name, needle, 2),
        });

      for (const c of classes.data ?? [])
        results.push({
          kind: "class",
          title: c.name,
          subtitle: `${c.class_type} class`,
          href: `/classes/${c.slug}`,
          rank: rankFor(c.name, needle, 5),
        });

      for (const mk of makers.data ?? [])
        results.push({
          kind: "manufacturer",
          title: mk.name,
          subtitle: `Manufacturer${mk.country ? ` • ${mk.country}` : ""}`,
          href: `/medicines`,
          rank: rankFor(mk.name, needle, 5) + 1,
        });

      for (const t2 of terms.data ?? [])
        results.push({
          kind: "term",
          title: t2.term,
          subtitle: t2.simple_definition ?? "Medical term",
          href: `/terms?q=${encodeURIComponent(t2.term)}`,
          rank: Math.max(rankFor(t2.term, needle, 6), 6),
        });

      return results.sort((a, b) => (a.rank ?? 8) - (b.rank ?? 8)).slice(0, 30);
    },
  });

/* -------------------------------------------------------------------------
 * Scale helpers: paginated medicine listing + verified safety alerts.
 * ---------------------------------------------------------------------- */

export type MedicinePage = { rows: MedicineListItem[]; total: number };

export const medicinesPageQuery = (opts: {
  page: number;
  pageSize: number;
  category?: string | null;
  search?: string;
}) =>
  queryOptions({
    queryKey: [
      "medicines-page",
      opts.page,
      opts.pageSize,
      opts.category ?? "all",
      opts.search ?? "",
    ],
    queryFn: async (): Promise<MedicinePage> => {
      const from = opts.page * opts.pageSize;
      let q = supabase
        .from("medicines")
        .select(LIST_COLUMNS, { count: "exact" })
        .order("generic_name")
        .range(from, from + opts.pageSize - 1);
      if (opts.category) q = q.eq("category", opts.category);
      const s = (opts.search ?? "").trim().slice(0, 80).replace(/[,()"'*%\\]/g, " ").trim();
      if (s.length >= 2) {
        const like = `%${s}%`;
        q = q.or(
          `generic_name.ilike.${like},display_name.ilike.${like},salt.ilike.${like},active_ingredient.ilike.${like}`,
        );
      }
      const { data, error, count } = await q.returns<MedicineListItem[]>();
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
  });

export const safetyAlertsQuery = (medicineId?: string) =>
  queryOptions({
    queryKey: ["safety-alerts", medicineId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("safety_alerts")
        .select("*")
        .order("alert_date", { ascending: false })
        .limit(20);
      if (medicineId && UUID_RE.test(medicineId)) q = q.eq("medicine_id", medicineId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
