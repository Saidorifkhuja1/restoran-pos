import { redirect } from "next/navigation";
import { getPageSession, defaultPathForPageRole, PageRole } from "@/lib/page-auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // If the user already has a valid session, redirect to their home page
  const session = await getPageSession();
  if (session) {
    redirect(defaultPathForPageRole(session.role as PageRole));
  }

  return <>{children}</>;
}
