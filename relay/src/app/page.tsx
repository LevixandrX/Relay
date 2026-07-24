import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { LandingInteractive } from "@/components/LandingInteractive";

export default async function HomePage() {
  const userId = await getSessionUserId();
  if (userId) redirect("/app");
  return <LandingInteractive />;
}
