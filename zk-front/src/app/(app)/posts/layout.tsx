import AppShell from "@/components/layout/AppShell";

export default function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
