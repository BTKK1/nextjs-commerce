"use client";
import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { demoProducts } from "@/data/catalog";
import { stripStoreLocalePrefix } from "@/components/saleh-demo/store-i18n";

const demoProductSlugs = new Set(demoProducts.map((product) => product.slug));

function isDemoShowcasePath(pathname: string) {
  const demoPathname = stripStoreLocalePrefix(pathname);
  if (
    demoPathname === "/store" ||
    demoPathname === "/store/cart" ||
    demoPathname === "/checkout" ||
    demoPathname === "/success" ||
    demoPathname === "/store/categories" ||
    demoPathname.startsWith("/dashboard")
  ) {
    return true;
  }

  const productMatch = demoPathname.match(/^\/store\/products?\/([^/?#]+)$/);
  return productMatch ? demoProductSlugs.has(productMatch[1]) : false;
}

export const NextAuthProvider = ({
  children,
  sessionSync,
}: {
  children: ReactNode;
  sessionSync?: ReactNode;
}) => {
  const pathname = usePathname() ?? "";
  const skipSessionFetch = process.env.NEXT_PUBLIC_DEMO_MODE === "true" && isDemoShowcasePath(pathname);

  if (skipSessionFetch) {
    return <>{children}</>;
  }

  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {sessionSync}
      {children}
    </SessionProvider>
  );
}
