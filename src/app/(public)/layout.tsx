import type { ReactNode } from "react";
import { LocalizedStoreShell } from "@/components/saleh-demo/LocalizedStoreShell";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <LocalizedStoreShell>{children}</LocalizedStoreShell>;
}
