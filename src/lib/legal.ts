// Bledify policies (DRAFTS — to be validated by an Algerian lawyer before launch).
// Fill the [bracketed] company details in OPERATOR below.
import type { DictKey, Lang } from "@/lib/i18n/dict";

export const LEGAL_DOCS = ["terms", "privacy", "returns", "sellers", "delivery"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export const legalKey = (d: LegalDoc) => `legal_${d}` as DictKey;
export const LEGAL_UPDATED = "2026-11-08";

const OPERATOR = {
  name: "[Raison sociale de l'exploitant]",
  address: "[Adresse du siège]",
  register: "[N° de registre du commerce]",
  email: "[e-mail de contact]",
};

type Section = { h: string; p: string[] };
type Docs = Record<LegalDoc, Section[]>;

const fr: Docs = {
  terms: [
    { h: "1. Qui sommes-nous ?", p: [
      `Bledify est une plateforme qui met en relation des clients avec des vendeuses et artisans qui fabriquent leurs produits à la maison en Algérie. Elle est exploitée par ${OPERATOR.name}, ${OPERATOR.address}, ${OPERATOR.register}. Contact : ${OPERATOR.email}.`,
      "Bledify n'achète pas et ne revend pas les produits : chaque vente est conclue directement entre le client et la vendeuse.",
    ] },
    { h: "2. Compte", p: [
      "La navigation est libre. Pour commander, il faut créer un compte avec une adresse e-mail valide et donner des informations exactes (nom, téléphone, wilaya).",
      "Vous êtes responsable de votre mot de passe. Un compte utilisé pour des commandes fictives ou abusives peut être suspendu.",
    ] },
    { h: "3. Produits acceptés", p: [
      "Seuls les produits fabriqués à la main en Algérie sont acceptés : pâtisserie, cuisine, couture, artisanat, décoration, produits du terroir, articles pour les fêtes et mariages.",
      "Sont interdits notamment : produits importés, électronique, contrefaçons, médicaments, armes, et tout produit interdit par la loi algérienne. Bledify peut retirer une annonce sans préavis.",
    ] },
    { h: "4. Commande", p: [
      "Le prix du produit et le prix de livraison de votre wilaya sont affichés avant la validation. Le prix enregistré est celui de la base Bledify au moment de la commande.",
      "Après la commande, la vendeuse vous appelle pour la confirmer. Une commande non confirmée peut être annulée. Une commande n'est définitive qu'après cette confirmation.",
    ] },
    { h: "5. Paiement", p: [
      "Le paiement se fait uniquement en espèces à la livraison (au livreur ou au point relais). Bledify ne demande jamais de paiement à l'avance ni de coordonnées bancaires.",
    ] },
    { h: "6. Avis", p: [
      "Seul un client dont la commande a été livrée peut laisser un avis. L'avis doit être honnête, respectueux et porter sur le produit reçu. Bledify peut masquer un avis injurieux, hors sujet ou contenant des données personnelles.",
    ] },
    { h: "7. Responsabilités", p: [
      "La vendeuse est responsable de ses produits (qualité, hygiène, conformité à la description). Bledify fournit l'outil, vérifie les boutiques signalées « vérifiées » et aide à régler les litiges.",
    ] },
    { h: "8. Droit applicable", p: [
      "Ces conditions sont soumises au droit algérien, notamment la loi n° 18-05 relative au commerce électronique et la loi n° 09-03 relative à la protection du consommateur. En cas de litige, une solution amiable est recherchée en premier.",
    ] },
  ],
  privacy: [
    { h: "1. Données collectées", p: [
      "Compte : nom, e-mail, mot de passe (chiffré). Commande : nom, téléphone, wilaya, commune, adresse, produits commandés. Vendeuses : informations de la boutique et photos des produits.",
      "Nous ne collectons aucune donnée bancaire.",
    ] },
    { h: "2. Pourquoi", p: [
      "Pour traiter les commandes (confirmation par téléphone, livraison), lutter contre les fausses commandes, afficher les avis et améliorer le service.",
    ] },
    { h: "3. Qui voit vos données", p: [
      "La vendeuse chez qui vous commandez voit votre nom, téléphone et adresse de livraison, uniquement pour cette commande. Le transporteur reçoit ce qui est nécessaire à la livraison.",
      "Sur un avis, seul votre prénom et l'initiale du nom sont affichés. Nous ne vendons jamais vos données.",
    ] },
    { h: "4. Durée de conservation", p: [
      "Les données de commande sont conservées le temps nécessaire à la gestion des commandes et aux obligations légales, puis supprimées ou anonymisées.",
    ] },
    { h: "5. Vos droits", p: [
      `Conformément à la loi n° 18-07 relative à la protection des personnes physiques dans le traitement des données à caractère personnel, vous pouvez demander l'accès, la rectification ou la suppression de vos données : ${OPERATOR.email}.`,
    ] },
    { h: "6. Hébergement et sécurité", p: [
      "Les données sont protégées par des accès limités et chiffrés. Le lieu d'hébergement et les formalités auprès de l'Autorité nationale de protection des données (ANPDP) sont en cours de validation.",
    ] },
  ],
  returns: [
    { h: "1. À la livraison", p: [
      "Vérifiez le colis devant le livreur quand c'est possible. Si le colis est ouvert, abîmé ou ne correspond pas, vous pouvez le refuser : vous ne payez rien.",
    ] },
    { h: "2. Produit non conforme ou défectueux", p: [
      "Signalez le problème dans les 4 jours ouvrables suivant la réception, avec des photos, via la vendeuse (téléphone ou WhatsApp) ou le contact Bledify.",
      "La vendeuse propose, au choix du client : un échange, une réparation ou un remboursement. Les frais de retour d'un produit non conforme sont à la charge de la vendeuse. Le remboursement intervient au plus tard 15 jours après la réception du retour.",
    ] },
    { h: "3. Produits alimentaires et sur mesure", p: [
      "Les gâteaux, plats cuisinés et produits frais ne sont ni repris ni échangés, sauf s'ils sont arrivés abîmés ou non conformes (signalement le jour de la réception, avec photos).",
      "Les créations faites sur mesure (taille, prénom, couleur demandés) ne sont reprises qu'en cas de défaut ou de non-conformité à la demande.",
    ] },
    { h: "4. Changement d'avis", p: [
      "Pour les autres produits, la vendeuse peut accepter un retour par simple changement d'avis ; ses conditions sont alors indiquées sur sa boutique. Le produit doit être intact et les frais de retour sont à la charge du client.",
    ] },
    { h: "5. Si la vendeuse ne répond pas", p: [
      "Sans solution sous 3 jours, contactez Bledify avec votre numéro de commande. Nous contactons la vendeuse et pouvons suspendre une boutique qui ne respecte pas ces règles.",
    ] },
  ],
  sellers: [
    { h: "1. Qui peut vendre", p: [
      "Toute personne qui fabrique elle-même ses produits en Algérie, à la maison ou en petit atelier. La vendeuse s'engage à disposer du statut requis pour son activité (artisan, auto-entrepreneur ou registre du commerce), à vérifier avec Bledify.",
    ] },
    { h: "2. Annonces", p: [
      "Photos réelles de ses propres produits, description et prix exacts, ingrédients ou matières principales, et allergènes pour l'alimentaire. Uniquement des produits faits main en Algérie : pas d'importation, pas de revente.",
    ] },
    { h: "3. Commandes", p: [
      "Appeler le client pour confirmer dans les 24 heures, préparer et expédier dans le délai annoncé, et mettre à jour le statut de la commande (confirmée, expédiée, livrée).",
      "Les prix de livraison par zone affichés dans la boutique sont ceux facturés au client.",
    ] },
    { h: "4. Qualité et hygiène", p: [
      "Pour l'alimentaire : préparation dans des conditions d'hygiène correctes, emballage propre et fermé, date de fabrication indiquée. Pour les autres produits : finitions conformes aux photos.",
    ] },
    { h: "5. Retours et avis", p: [
      "La vendeuse applique la politique de retours Bledify. Elle ne peut ni modifier ni supprimer les avis ; elle peut signaler un avis abusif à Bledify.",
    ] },
    { h: "6. Badge « Boutique vérifiée »", p: [
      "Attribué par l'équipe Bledify après un appel, la vérification de l'identité et la preuve que les produits sont faits maison (photos ou vidéo de fabrication). Il peut être retiré en cas de manquement.",
    ] },
    { h: "7. Suspension", p: [
      "Fausses annonces, produits interdits, commandes non honorées à répétition ou comportement abusif envers les clients peuvent entraîner la suspension de la boutique.",
    ] },
  ],
  delivery: [
    { h: "1. Prix de livraison", p: [
      "Chaque vendeuse fixe ses prix par zone : sa propre wilaya, le Nord, les Hauts-Plateaux, le Sud et le Grand Sud. Le prix correspondant à votre wilaya (domicile ou point relais) s'affiche avant la commande et ne peut pas être changé ensuite.",
    ] },
    { h: "2. Délais", p: [
      "Le délai indiqué (par exemple 2–4 jours) commence après la confirmation téléphonique. Les produits faits sur commande peuvent demander un temps de fabrication, annoncé par la vendeuse au moment de la confirmation.",
    ] },
    { h: "3. Suivi", p: [
      "Le numéro de suivi du transporteur apparaît dans « Mes commandes » dès l'expédition. Vous pouvez aussi suivre une commande avec son numéro et votre téléphone.",
    ] },
    { h: "4. Colis perdu ou en retard", p: [
      "Au-delà de 7 jours après le délai annoncé, contactez la vendeuse puis Bledify. La vendeuse se charge de la réclamation auprès du transporteur ; si le colis est perdu, vous ne payez rien.",
    ] },
    { h: "5. Litiges", p: [
      "1) Contactez la vendeuse. 2) Sans réponse sous 3 jours, écrivez à Bledify avec votre numéro de commande et des photos. 3) Bledify propose une solution sous 7 jours. Si le désaccord persiste, vous gardez la possibilité de saisir les services de la protection du consommateur ou le tribunal compétent.",
    ] },
  ],
};

const ar: Docs = {
  terms: [
    { h: "1. من نحن؟", p: [
      `Bledify منصة تربط الزبائن ببائعات وحرفيين يصنعون منتجاتهم في البيت في الجزائر. تسيّرها ${OPERATOR.name}، ${OPERATOR.address}، ${OPERATOR.register}. للتواصل: ${OPERATOR.email}.`,
      "Bledify لا تشتري ولا تعيد بيع المنتجات: كل عملية بيع تتم مباشرة بين الزبون والبائعة.",
    ] },
    { h: "2. الحساب", p: [
      "التصفح حر. للطلب يجب إنشاء حساب ببريد إلكتروني صحيح وإعطاء معلومات صحيحة (الاسم، الهاتف، الولاية).",
      "أنت مسؤول عن كلمة السر. الحساب الذي يُستعمل في طلبات وهمية أو مسيئة قد يُوقف.",
    ] },
    { h: "3. المنتجات المقبولة", p: [
      "تُقبل فقط المنتجات المصنوعة يدويًا في الجزائر: الحلويات، الأكل، الخياطة، الحرف، الديكور، منتجات الأرض، ولوازم الأعراس والمناسبات.",
      "يُمنع خاصة: المنتجات المستوردة، الإلكترونيات، المقلّدة، الأدوية، الأسلحة، وكل منتوج يمنعه القانون الجزائري. يمكن لـ Bledify حذف أي إعلان دون إشعار.",
    ] },
    { h: "4. الطلب", p: [
      "سعر المنتوج وسعر التوصيل لولايتك يظهران قبل تأكيد الطلب. السعر المسجّل هو السعر الموجود في Bledify لحظة الطلب.",
      "بعد الطلب تتصل بك البائعة لتأكيده. الطلبية غير المؤكدة قد تُلغى، ولا تصبح نهائية إلا بعد هذا التأكيد.",
    ] },
    { h: "5. الدفع", p: [
      "الدفع نقدًا عند الاستلام فقط (لعامل التوصيل أو في نقطة الاستلام). Bledify لا تطلب أبدًا دفعًا مسبقًا ولا معلومات بنكية.",
    ] },
    { h: "6. التقييمات", p: [
      "فقط الزبون الذي استلم طلبيته يمكنه التقييم. يجب أن يكون الرأي صادقًا ومحترمًا ويخص المنتوج المستلم. يمكن لـ Bledify إخفاء تقييم مسيء أو خارج الموضوع أو يحتوي معطيات شخصية.",
    ] },
    { h: "7. المسؤوليات", p: [
      "البائعة مسؤولة عن منتجاتها (الجودة، النظافة، المطابقة للوصف). Bledify توفر الأداة، وتتحقق من المتاجر «الموثّقة»، وتساعد في حل النزاعات.",
    ] },
    { h: "8. القانون المطبّق", p: [
      "تخضع هذه الشروط للقانون الجزائري، خاصة القانون رقم 18-05 المتعلق بالتجارة الإلكترونية والقانون رقم 09-03 المتعلق بحماية المستهلك. في حالة نزاع، يُبحث أولًا عن حل ودي.",
    ] },
  ],
  privacy: [
    { h: "1. المعطيات التي نجمعها", p: [
      "الحساب: الاسم، البريد، كلمة السر (مشفّرة). الطلب: الاسم، الهاتف، الولاية، البلدية، العنوان، المنتجات. البائعات: معلومات المتجر وصور المنتجات.",
      "لا نجمع أي معطيات بنكية.",
    ] },
    { h: "2. لماذا", p: [
      "لمعالجة الطلبيات (التأكيد بالهاتف، التوصيل)، ومحاربة الطلبات الوهمية، وعرض التقييمات، وتحسين الخدمة.",
    ] },
    { h: "3. من يرى معطياتك", p: [
      "البائعة التي تطلبين منها ترى اسمك وهاتفك وعنوان التوصيل، لهذه الطلبية فقط. شركة التوصيل تستلم ما يلزم للتوصيل.",
      "في التقييم يظهر الاسم الأول والحرف الأول من اللقب فقط. لا نبيع معطياتك أبدًا.",
    ] },
    { h: "4. مدة الحفظ", p: [
      "تُحفظ معطيات الطلبيات المدة اللازمة لتسييرها وللالتزامات القانونية، ثم تُحذف أو تُجعل مجهولة.",
    ] },
    { h: "5. حقوقك", p: [
      `طبقًا للقانون رقم 18-07 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي، يمكنك طلب الاطلاع على معطياتك أو تصحيحها أو حذفها: ${OPERATOR.email}.`,
    ] },
    { h: "6. الاستضافة والأمان", p: [
      "المعطيات محمية بصلاحيات وصول محدودة ومشفّرة. مكان الاستضافة والإجراءات لدى السلطة الوطنية لحماية المعطيات ذات الطابع الشخصي قيد المراجعة.",
    ] },
  ],
  returns: [
    { h: "1. عند الاستلام", p: [
      "تفقّدي الطرد أمام عامل التوصيل إن أمكن. إذا كان مفتوحًا أو متضررًا أو غير مطابق، يمكنك رفضه ولا تدفعين شيئًا.",
    ] },
    { h: "2. منتوج غير مطابق أو معيب", p: [
      "أبلغي عن المشكل خلال 4 أيام عمل من الاستلام، مع صور، عبر البائعة (هاتف أو واتساب) أو عبر Bledify.",
      "تقترح البائعة، حسب اختيار الزبون: استبدالًا أو تصليحًا أو استرجاع المبلغ. مصاريف إرجاع المنتوج غير المطابق على البائعة. يُسترجع المبلغ في أجل أقصاه 15 يومًا من استلام المنتوج المُرجع.",
    ] },
    { h: "3. المأكولات والمنتجات حسب الطلب", p: [
      "الحلويات والأطباق والمنتجات الطازجة لا تُرجع ولا تُستبدل، إلا إذا وصلت متضررة أو غير مطابقة (الإبلاغ يوم الاستلام مع صور).",
      "المنتجات المصنوعة حسب الطلب (مقاس، اسم، لون) لا تُرجع إلا في حالة عيب أو عدم مطابقة للطلب.",
    ] },
    { h: "4. تغيير الرأي", p: [
      "بالنسبة للمنتجات الأخرى، يمكن للبائعة قبول الإرجاع بسبب تغيير الرأي، وتذكر شروطها في متجرها. يجب أن يكون المنتوج سليمًا ومصاريف الإرجاع على الزبون.",
    ] },
    { h: "5. إذا لم ترد البائعة", p: [
      "إذا لم يُحل المشكل خلال 3 أيام، اتصلي بـ Bledify مع رقم الطلبية. نتصل بالبائعة ويمكننا توقيف متجر لا يحترم هذه القواعد.",
    ] },
  ],
  sellers: [
    { h: "1. من يمكنه البيع", p: [
      "كل شخص يصنع منتجاته بنفسه في الجزائر، في البيت أو في ورشة صغيرة. تلتزم البائعة بأن يكون لها الوضع القانوني المطلوب لنشاطها (حرفية، مقاول ذاتي أو سجل تجاري)، يُراجع مع Bledify.",
    ] },
    { h: "2. الإعلانات", p: [
      "صور حقيقية لمنتجاتها، وصف وسعر صحيحان، المكونات أو المواد الأساسية، ومسببات الحساسية بالنسبة للأكل. منتجات مصنوعة يدويًا في الجزائر فقط: لا استيراد ولا إعادة بيع.",
    ] },
    { h: "3. الطلبيات", p: [
      "الاتصال بالزبون للتأكيد خلال 24 ساعة، التحضير والإرسال في المدة المعلنة، وتحديث حالة الطلبية (مؤكدة، مُرسلة، مُسلّمة).",
      "أسعار التوصيل حسب المنطقة المعروضة في المتجر هي التي يدفعها الزبون.",
    ] },
    { h: "4. الجودة والنظافة", p: [
      "للأكل: تحضير في ظروف نظافة سليمة، تغليف نظيف ومغلق، وذكر تاريخ الصنع. للمنتجات الأخرى: تشطيب مطابق للصور.",
    ] },
    { h: "5. الإرجاع والتقييمات", p: [
      "تطبق البائعة سياسة الإرجاع الخاصة بـ Bledify. لا يمكنها تعديل أو حذف التقييمات، ويمكنها التبليغ عن تقييم مسيء.",
    ] },
    { h: "6. شارة «متجر موثّق»", p: [
      "يمنحها فريق Bledify بعد مكالمة، والتحقق من الهوية، وإثبات أن المنتجات مصنوعة في البيت (صور أو فيديو للصنع). يمكن سحبها في حالة الإخلال.",
    ] },
    { h: "7. التوقيف", p: [
      "الإعلانات الكاذبة، المنتجات الممنوعة، تكرار عدم الوفاء بالطلبيات أو سوء معاملة الزبائن قد تؤدي إلى توقيف المتجر.",
    ] },
  ],
  delivery: [
    { h: "1. سعر التوصيل", p: [
      "كل بائعة تحدد أسعارها حسب المنطقة: ولايتها، الشمال، الهضاب العليا، الجنوب والجنوب الكبير. السعر الخاص بولايتك (إلى المنزل أو نقطة الاستلام) يظهر قبل الطلب ولا يتغير بعده.",
    ] },
    { h: "2. المدة", p: [
      "المدة المعلنة (مثلًا 2–4 أيام) تبدأ بعد التأكيد بالهاتف. المنتجات المصنوعة حسب الطلب قد تحتاج وقتًا للصنع تعلنه البائعة عند التأكيد.",
    ] },
    { h: "3. التتبع", p: [
      "رقم تتبع شركة التوصيل يظهر في «طلبياتي» بمجرد الإرسال. يمكنك أيضًا تتبع الطلبية برقمها ورقم هاتفك.",
    ] },
    { h: "4. طرد ضائع أو متأخر", p: [
      "بعد 7 أيام من انتهاء المدة المعلنة، اتصلي بالبائعة ثم بـ Bledify. البائعة تتكفل بالشكوى لدى شركة التوصيل، وإذا ضاع الطرد لا تدفعين شيئًا.",
    ] },
    { h: "5. النزاعات", p: [
      "1) اتصلي بالبائعة. 2) إذا لم ترد خلال 3 أيام، راسلي Bledify برقم الطلبية وصور. 3) تقترح Bledify حلًا خلال 7 أيام. إذا استمر الخلاف، يبقى لك حق اللجوء إلى مصالح حماية المستهلك أو المحكمة المختصة.",
    ] },
  ],
};

export function legalDoc(doc: LegalDoc, lang: Lang): Section[] {
  return (lang === "ar" ? ar : fr)[doc];
}
