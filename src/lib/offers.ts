// Offers are rows of public.offers (created by the Bledify team); shops propose products, the team approves.
export type Offer = {
  slug: string; kind: "seasonal" | "special"; title_fr: string; title_ar: string;
  image: string; icon: string; position: number; active: boolean;
};
export const offerTitle = (o: Pick<Offer, "title_fr" | "title_ar">, lang: "fr" | "ar") => (lang === "ar" ? o.title_ar : o.title_fr);
