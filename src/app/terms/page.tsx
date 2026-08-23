import type { Metadata } from "next";
import { NbehPolicyPage } from "@/components/public/NbehPolicyPage";

export const metadata: Metadata = {
  title: "Terms of Service | Nbeh",
  description: "Terms governing merchant use of the Nbeh AI sales agent.",
};

export default function TermsPage() {
  return (
    <NbehPolicyPage
      eyebrow="Terms · Last updated August 22, 2026"
      eyebrowAr="الشروط · آخر تحديث 22 أغسطس 2026"
      title="Clear terms for a practical beta."
      titleAr="شروط واضحة لنسخة تجريبية عملية."
      intro="These terms govern merchant access to Nbeh during the MVP beta. Nbeh helps shoppers understand products; merchants remain responsible for their catalog, policies, and fulfilment."
      introAr="تنظم هذه الشروط استخدام التجار لنبيه خلال النسخة التجريبية. يساعد نبيه المتسوق على فهم المنتجات، ويبقى التاجر مسؤولًا عن بيانات متجره وسياساته وتنفيذ الطلبات."
      sections={[
        {
          title: "Account responsibility",
          titleAr: "مسؤولية الحساب",
          body: <p>Merchants must provide accurate account information, protect access credentials, and promptly report suspected unauthorized access.</p>,
          bodyAr: <p>يلتزم التاجر بتقديم معلومات صحيحة وحماية بيانات الدخول والإبلاغ سريعًا عن أي وصول غير مصرح به.</p>,
        },
        {
          title: "Store and product data",
          titleAr: "بيانات المتجر والمنتج",
          body: <p>Nbeh answers from the connected catalog and store information. Merchants are responsible for keeping prices, inventory, shipping, warranty, and product details accurate.</p>,
          bodyAr: <p>يجيب نبيه اعتمادًا على بيانات المتجر والمنتجات المربوطة. يتحمل التاجر مسؤولية دقة الأسعار والمخزون والشحن والضمان وتفاصيل المنتجات.</p>,
        },
        {
          title: "Acceptable use",
          titleAr: "الاستخدام المقبول",
          body: <p>Do not use Nbeh for unlawful, deceptive, harmful, abusive, or privacy-invasive activity, or to bypass platform or service security controls.</p>,
          bodyAr: <p>يُمنع استخدام نبيه في نشاط مخالف أو مضلل أو ضار أو مسيء للخصوصية، أو لمحاولة تجاوز وسائل حماية المنصة أو الخدمة.</p>,
        },
        {
          title: "AI limitations",
          titleAr: "حدود الذكاء الاصطناعي",
          body: <p>AI responses may occasionally be incomplete or incorrect. Nbeh is designed to acknowledge missing catalog information, but merchants should review important store policies and product facts.</p>,
          bodyAr: <p>قد تكون إجابات الذكاء الاصطناعي ناقصة أو غير دقيقة أحيانًا. صُمم نبيه لتوضيح نقص المعلومات، وعلى التاجر مراجعة سياسات المتجر وحقائق المنتجات المهمة.</p>,
        },
        {
          title: "Availability and changes",
          titleAr: "التوفر والتغييرات",
          body: <p>Beta functionality may evolve. We may perform maintenance or suspend access when necessary for security, abuse prevention, or platform compliance.</p>,
          bodyAr: <p>قد تتطور خصائص النسخة التجريبية. قد نجري صيانة أو نوقف الوصول عند الحاجة للحماية أو منع إساءة الاستخدام أو الالتزام بمتطلبات المنصات.</p>,
        },
        {
          title: "Ending service",
          titleAr: "إنهاء الخدمة",
          body: <p>A merchant may uninstall the platform app or request account closure. Applicable obligations concerning security, lawful records, and prior use continue after termination.</p>,
          bodyAr: <p>يستطيع التاجر حذف تطبيق المنصة أو طلب إغلاق الحساب. تستمر الالتزامات المتعلقة بالحماية والسجلات النظامية والاستخدام السابق بعد الإنهاء.</p>,
        },
      ]}
    />
  );
}
