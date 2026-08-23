import type { Metadata } from "next";
import { NbehPolicyPage } from "@/components/public/NbehPolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Nbeh",
  description: "How Nbeh handles merchant, storefront, product, and shopper conversation data.",
};

export default function PrivacyPage() {
  return (
    <NbehPolicyPage
      eyebrow="Privacy · Last updated August 22, 2026"
      eyebrowAr="الخصوصية · آخر تحديث 22 أغسطس 2026"
      title="Privacy built for merchant trust."
      titleAr="خصوصية تحفظ ثقة التاجر والمتسوق."
      intro="Nbeh processes only the information required to connect a merchant's store, understand the product currently being viewed, and answer shopper questions. We do not sell personal data."
      introAr="يعالج نبيه المعلومات اللازمة فقط لربط متجر التاجر وفهم المنتج المعروض والإجابة عن أسئلة المتسوق. لا نبيع البيانات الشخصية."
      sections={[
        {
          title: "Information we process",
          titleAr: "المعلومات التي نعالجها",
          body: <p>Store identity, product catalog data, integration credentials, widget preferences, account details, and shopper messages sent to Nbeh. Payment-card details are not collected by Nbeh.</p>,
          bodyAr: <p>هوية المتجر وبيانات المنتجات وبيانات ربط المنصة وتفضيلات الواجهة وبيانات الحساب ورسائل المتسوق المرسلة لنبيه. لا يجمع نبيه بيانات بطاقات الدفع.</p>,
        },
        {
          title: "How information is used",
          titleAr: "كيف نستخدم المعلومات",
          body: <p>We use data to synchronize products, provide product-aware answers, secure merchant access, operate the dashboard, prevent abuse, and improve answer quality.</p>,
          bodyAr: <p>نستخدم البيانات لمزامنة المنتجات وتقديم إجابات مرتبطة بالمنتج وتأمين وصول التاجر وتشغيل لوحة التحكم ومنع إساءة الاستخدام وتحسين جودة الإجابات.</p>,
        },
        {
          title: "Storage and security",
          titleAr: "التخزين والحماية",
          body: <p>Integration credentials are encrypted at rest. Merchant data is isolated by store, access is role-based, and incoming platform webhooks are verified before processing.</p>,
          bodyAr: <p>تُشفّر بيانات ربط المنصات أثناء التخزين، وتُعزل بيانات كل متجر، ويُقيّد الوصول حسب الصلاحية، وتُتحقق طلبات الويب هوك قبل معالجتها.</p>,
        },
        {
          title: "Sharing and subprocessors",
          titleAr: "المشاركة ومقدمو الخدمة",
          body: <p>We share only what is necessary with hosting, database, security, and AI-model providers used to operate Nbeh. We do not use shopper conversations for advertising.</p>,
          bodyAr: <p>نشارك القدر اللازم فقط مع مزودي الاستضافة وقواعد البيانات والحماية ونماذج الذكاء الاصطناعي المستخدمة لتشغيل نبيه. لا نستخدم محادثات المتسوق للإعلانات.</p>,
        },
        {
          title: "Retention and deletion",
          titleAr: "الاحتفاظ والحذف",
          body: <p>Data is retained only for service operation, security, support, and legally required records. Merchants may request account or store-data deletion through the support page.</p>,
          bodyAr: <p>نحتفظ بالبيانات بقدر الحاجة لتشغيل الخدمة والحماية والدعم والمتطلبات النظامية. يستطيع التاجر طلب حذف الحساب أو بيانات المتجر عبر صفحة الدعم.</p>,
        },
        {
          title: "Questions and requests",
          titleAr: "الأسئلة والطلبات",
          body: <p>For access, correction, or deletion requests, email Founder@nbeh.io. We may verify the requester&apos;s identity before acting.</p>,
          bodyAr: <p>لطلب الوصول أو التصحيح أو الحذف، تواصل عبر Founder@nbeh.io. قد نتحقق من هوية مقدم الطلب قبل التنفيذ.</p>,
        },
      ]}
    />
  );
}
