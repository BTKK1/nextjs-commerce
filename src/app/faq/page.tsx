import type { Metadata } from "next";
import { NbehPolicyPage } from "@/components/public/NbehPolicyPage";

export const metadata: Metadata = {
  title: "FAQ | Nbeh",
  description: "Answers to common questions about installing and using Nbeh on Salla and Zid product pages.",
};

export default function FaqPage() {
  return (
    <NbehPolicyPage
      eyebrow="Merchant FAQ"
      eyebrowAr="أسئلة التجار"
      title="The essentials, without a setup maze."
      titleAr="المهم فقط، بدون تعقيد الإعداد."
      intro="Install Nbeh, synchronize the catalog, and verify the storefront widget. Nbeh then answers from the product page the shopper is viewing."
      introAr="ثبّت نبيه وزامن المنتجات وتأكد من ظهور الواجهة في المتجر. بعدها يجيب نبيه اعتمادًا على صفحة المنتج التي يشاهدها المتسوق."
      sections={[
        {
          title: "Where does Nbeh appear?",
          titleAr: "أين يظهر نبيه؟",
          body: <p>Nbeh appears on product pages, where the current product provides the context needed for a useful sales conversation.</p>,
          bodyAr: <p>يظهر نبيه في صفحات المنتجات، لأن المنتج المعروض هو السياق الذي يحتاجه لتقديم محادثة مبيعات مفيدة.</p>,
        },
        {
          title: "Does every store get its own agent?",
          titleAr: "هل لكل متجر مساعده الخاص؟",
          body: <p>Yes. Store data, products, conversations, preferences, and integration credentials are isolated per merchant. The shared Nbeh behavior is combined with each store and product context.</p>,
          bodyAr: <p>نعم. تُعزل بيانات المتجر والمنتجات والمحادثات والتفضيلات وبيانات الربط لكل تاجر، ويُدمج أسلوب نبيه العام مع سياق كل متجر ومنتج.</p>,
        },
        {
          title: "Can Nbeh invent missing details?",
          titleAr: "هل يخترع نبيه معلومات ناقصة؟",
          body: <p>No. Nbeh is instructed to state when information is unavailable instead of inventing a price, size, shipping promise, warranty, or product fact.</p>,
          bodyAr: <p>لا. يوضح نبيه أن المعلومة غير متوفرة بدل اختراع سعر أو مقاس أو وعد شحن أو ضمان أو معلومة عن المنتج.</p>,
        },
        {
          title: "Which languages are supported?",
          titleAr: "ما اللغات المدعومة؟",
          body: <p>The storefront experience supports Arabic and English. Arabic replies use a clear Saudi conversational style, while English replies remain concise and natural.</p>,
          bodyAr: <p>تدعم واجهة المتجر العربية والإنجليزية. يستخدم نبيه في العربية أسلوبًا سعوديًا أبيض وواضحًا، وتبقى الإجابات الإنجليزية مختصرة وطبيعية.</p>,
        },
        {
          title: "How do I know installation worked?",
          titleAr: "كيف أتأكد أن التثبيت نجح؟",
          body: <p>The integrations page shows authorization, catalog synchronization, and product readiness. Open a synchronized product page and send a real question to complete the check.</p>,
          bodyAr: <p>تعرض صفحة الربط حالة التفويض ومزامنة المنتجات وجاهزيتها. افتح صفحة منتج متزامن وأرسل سؤالًا فعليًا لإكمال التحقق.</p>,
        },
        {
          title: "How is beta success measured?",
          titleAr: "كيف نقيس نجاح النسخة التجريبية؟",
          body: <p>The initial signal is meaningful shopper interaction across real merchants. Nbeh does not promise a fixed sales or conversion result.</p>,
          bodyAr: <p>المؤشر الأول هو تفاعل المتسوقين بشكل مفيد لدى متاجر حقيقية. لا يعد نبيه بنسبة ثابتة للمبيعات أو التحويل.</p>,
        },
      ]}
    />
  );
}
