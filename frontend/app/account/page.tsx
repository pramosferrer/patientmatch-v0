import { redirect } from "next/navigation";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  redirect("/privacy");
}
