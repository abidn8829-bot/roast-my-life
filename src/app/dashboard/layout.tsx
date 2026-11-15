import { TimezoneSync } from "@/components/timezone-sync";

// Every signed-in session lands on /dashboard, so the time zone is captured here in the background.
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <TimezoneSync />
    </>
  );
}
