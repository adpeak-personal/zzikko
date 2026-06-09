import AppShell from "@/components/layout/AppShell";

export default function CategoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
