import "server-only";
import { loadDashboardDatabase } from "@/lib/dashboard/data";
import { getConversationDetail, getDashboardOverview } from "@/lib/dashboard/aggregation";

export async function getDashboardOverviewForRequest() {
  return getDashboardOverview(await loadDashboardDatabase());
}

export async function getConversationDetailForRequest(id: string) {
  return getConversationDetail(id, await loadDashboardDatabase());
}
