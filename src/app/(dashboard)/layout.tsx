import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const userProfile = {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role as "agent" | "admin",
    avatar_url: user.avatarUrl || null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Sidebar profile={userProfile} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-64">
        <Topbar profile={userProfile} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
