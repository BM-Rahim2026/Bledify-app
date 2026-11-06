// The 58 wilayas (data, not logic: extend here when the list changes).
export type Wilaya = { code: number; fr: string; ar: string };

export const WILAYAS: Wilaya[] = [
  [1, "Adrar", "أدرار"], [2, "Chlef", "الشلف"], [3, "Laghouat", "الأغواط"],
  [4, "Oum El Bouaghi", "أم البواقي"], [5, "Batna", "باتنة"], [6, "Béjaïa", "بجاية"],
  [7, "Biskra", "بسكرة"], [8, "Béchar", "بشار"], [9, "Blida", "البليدة"],
  [10, "Bouira", "البويرة"], [11, "Tamanrasset", "تمنراست"], [12, "Tébessa", "تبسة"],
  [13, "Tlemcen", "تلمسان"], [14, "Tiaret", "تيارت"], [15, "Tizi Ouzou", "تيزي وزو"],
  [16, "Alger", "الجزائر"], [17, "Djelfa", "الجلفة"], [18, "Jijel", "جيجل"],
  [19, "Sétif", "سطيف"], [20, "Saïda", "سعيدة"], [21, "Skikda", "سكيكدة"],
  [22, "Sidi Bel Abbès", "سيدي بلعباس"], [23, "Annaba", "عنابة"], [24, "Guelma", "قالمة"],
  [25, "Constantine", "قسنطينة"], [26, "Médéa", "المدية"], [27, "Mostaganem", "مستغانم"],
  [28, "M'Sila", "المسيلة"], [29, "Mascara", "معسكر"], [30, "Ouargla", "ورقلة"],
  [31, "Oran", "وهران"], [32, "El Bayadh", "البيض"], [33, "Illizi", "إليزي"],
  [34, "Bordj Bou Arréridj", "برج بوعريريج"], [35, "Boumerdès", "بومرداس"],
  [36, "El Tarf", "الطارف"], [37, "Tindouf", "تندوف"], [38, "Tissemsilt", "تيسمسيلت"],
  [39, "El Oued", "الوادي"], [40, "Khenchela", "خنشلة"], [41, "Souk Ahras", "سوق أهراس"],
  [42, "Tipaza", "تيبازة"], [43, "Mila", "ميلة"], [44, "Aïn Defla", "عين الدفلى"],
  [45, "Naâma", "النعامة"], [46, "Aïn Témouchent", "عين تموشنت"], [47, "Ghardaïa", "غرداية"],
  [48, "Relizane", "غليزان"], [49, "Timimoun", "تيميمون"], [50, "Bordj Badji Mokhtar", "برج باجي مختار"],
  [51, "Ouled Djellal", "أولاد جلال"], [52, "Béni Abbès", "بني عباس"], [53, "In Salah", "عين صالح"],
  [54, "In Guezzam", "عين قزام"], [55, "Touggourt", "تقرت"], [56, "Djanet", "جانت"],
  [57, "El M'Ghair", "المغير"], [58, "El Meniaa", "المنيعة"],
].map(([code, fr, ar]) => ({ code: code as number, fr: fr as string, ar: ar as string }));

/** Stored form on orders: "31 - Oran". */
export const wilayaValue = (w: Wilaya) => `${String(w.code).padStart(2, "0")} - ${w.fr}`;

export function wilayaLabel(value: string, lang: "fr" | "ar"): string {
  const code = parseInt(value, 10);
  const w = WILAYAS.find((x) => x.code === code);
  if (!w) return value;
  return `${String(w.code).padStart(2, "0")} - ${lang === "ar" ? w.ar : w.fr}`;
}
