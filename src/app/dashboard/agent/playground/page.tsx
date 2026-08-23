import { requireAdvancedAgentUser } from "@/lib/auth/require-user";
import { getAgentAdminState } from "@/lib/agent/config-repository";
import { getDashboardOverviewForRequest } from "@/lib/dashboard/server";
import Link from "next/link";
import { ExternalLink, Store } from "lucide-react";
import { AgentPlayground } from "@/components/dashboard/AgentPlayground";
import { DashboardTranslatedServer } from "@/components/dashboard/DashboardTranslatedServer";
import { getCurrentPromptCandidate } from "@/lib/agent/prompt-versioning";

export const dynamic = "force-dynamic";

export default async function AgentPlaygroundPage() {
  const identity = await requireAdvancedAgentUser();
  const [state, overview] = await Promise.all([
    getAgentAdminState(identity),
    getDashboardOverviewForRequest(),
  ]);
  const draft = getCurrentPromptCandidate(state.versions);
  const products = overview.products.map((product) => ({
    slug: product.slug,
    name: product.name,
    category: product.category,
    priceLabel: `${product.currency ?? "SAR"} ${product.priceSar.toLocaleString("en-US")}`,
  }));
  return (
    <DashboardTranslatedServer>
      <main className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#5B2EFF]">
              Agent settings
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[#17131F]">
              Agent Playground
            </h1>
            <p className="mt-2 max-w-3xl text-[#666170]">
              Choose a product page, then talk to the Live Agent and Draft Agent
              side by side with the same shopper question.
            </p>
          </div>
          <Link
            href="/store"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[14px] bg-[#17131F] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#5B2EFF]"
          >
            <Store className="h-4 w-4" /> Founder demo store{" "}
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
        {products.length ? (
          <AgentPlayground
            products={products}
            draftVersionId={draft?.id}
            draftVersion={draft?.version_number}
          />
        ) : (
          <section className="mt-8 rounded-[20px] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            The demo store has no product context yet. Seed or sync the catalog
            before testing the agents.
          </section>
        )}
      </main>
    </DashboardTranslatedServer>
  );
}
