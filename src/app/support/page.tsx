import type { Metadata } from "next";
import Link from "next/link";
import { NbehPolicyPage } from "@/components/public/NbehPolicyPage";

export const metadata: Metadata = {
  title: "Merchant Support | Nbeh",
  description: "Installation, catalog synchronization, widget, and account support for Nbeh merchants.",
};

export default function SupportPage() {
  return (
    <NbehPolicyPage
      eyebrow="Merchant support"
      eyebrowAr="دعم التجار"
      title="One clear route when you need help."
      titleAr="مسار واضح عندما تحتاج مساعدة."
      intro={<p>Email <Link className="font-semibold text-[#5b2eff] underline underline-offset-4" href="mailto:Founder@nbeh.io">Founder@nbeh.io</Link> with your store name, platform, and a short description. Never send passwords or secret keys.</p>}
      introAr={<p>راسل <Link className="font-semibold text-[#5b2eff] underline underline-offset-4" href="mailto:Founder@nbeh.io">Founder@nbeh.io</Link> مع اسم المتجر والمنصة ووصف مختصر للمشكلة. لا ترسل كلمات المرور أو المفاتيح السرية.</p>}
      sections={[
        {
          title: "Installation help",
          titleAr: "مساعدة التثبيت",
          body: <p>For Salla or Zid installation issues, include the platform, store URL, approximate time of the attempt, and the readiness status shown in the integrations page.</p>,
          bodyAr: <p>لمشاكل تثبيت سلة أو زد، أرسل اسم المنصة ورابط المتجر والوقت التقريبي للمحاولة والحالة الظاهرة في صفحة الربط.</p>,
        },
        {
          title: "Catalog synchronization",
          titleAr: "مزامنة المنتجات",
          body: <p>If products are missing or outdated, run catalog synchronization once, wait for completion, and send the affected product URL if the issue remains.</p>,
          bodyAr: <p>إذا كان منتج مفقودًا أو قديمًا، شغّل المزامنة مرة واحدة وانتظر اكتمالها، ثم أرسل رابط المنتج المتأثر إذا استمرت المشكلة.</p>,
        },
        {
          title: "Widget troubleshooting",
          titleAr: "مشاكل واجهة نبيه",
          body: <p>Confirm you are on a product page, refresh once, and test in a private window. Include a screenshot and product URL if the widget is still absent or cannot send.</p>,
          bodyAr: <p>تأكد أنك داخل صفحة منتج، وحدّث الصفحة مرة واحدة، وجرّب نافذة خاصة. أرسل لقطة شاشة ورابط المنتج إذا لم تظهر الواجهة أو تعذر الإرسال.</p>,
        },
        {
          title: "Answer quality",
          titleAr: "جودة الإجابات",
          body: <p>Share the conversation and product URL. Do not add missing facts to the message; update the product catalog so every shopper receives the corrected information.</p>,
          bodyAr: <p>أرسل المحادثة ورابط المنتج. لا تضف المعلومات الناقصة داخل الرسالة فقط؛ حدّث بيانات المنتج ليحصل كل متسوق على المعلومة الصحيحة.</p>,
        },
        {
          title: "Security concerns",
          titleAr: "بلاغات الحماية",
          body: <p>For suspected credential exposure, unauthorized access, or privacy incidents, use the subject “Security” and include only non-secret diagnostic details.</p>,
          bodyAr: <p>عند الاشتباه بتسرب بيانات أو وصول غير مصرح أو حادث خصوصية، استخدم عنوان «Security» وأرسل تفاصيل تشخيصية غير سرية فقط.</p>,
        },
        {
          title: "Account and data requests",
          titleAr: "طلبات الحساب والبيانات",
          body: <p>For access, correction, export, or deletion requests, contact us from the merchant account email so ownership can be verified.</p>,
          bodyAr: <p>لطلب الوصول أو التصحيح أو التصدير أو الحذف، تواصل من بريد حساب التاجر حتى يمكن التحقق من الملكية.</p>,
        },
      ]}
    />
  );
}
