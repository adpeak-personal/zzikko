import YongadmShell from "@/components/admin/YongadmShell";

export default function YongadmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <YongadmShell>{children}</YongadmShell>;
}
