import { AgentSectionNav } from "@/components/dashboard/AgentSectionNav";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AgentSectionNav />
      {children}
    </div>
  );
}
