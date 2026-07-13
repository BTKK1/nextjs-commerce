import { DemoCheckoutPage } from "@/components/saleh-demo/DemoCheckoutPage";

export const metadata = {
  title: "Checkout | Maison Vert",
  description: "Complete the local Maison Vert demo checkout.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return <DemoCheckoutPage />;
}
