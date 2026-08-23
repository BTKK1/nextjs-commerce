import { GET as getSharedWidgetLoader } from "@/app/salla-widget.js/route";

export const dynamic = "force-dynamic";

export function GET() {
  return getSharedWidgetLoader();
}
