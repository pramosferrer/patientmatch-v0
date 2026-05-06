export const dynamic = 'force-dynamic';
export const revalidate = 0;
import MatchPageClient from "./MatchPageClient";
import { fetchAllConditions } from "@/shared/conditions";

export default async function MatchPage() {
  const conditions = await fetchAllConditions();

  return <MatchPageClient conditions={conditions} />;
}
