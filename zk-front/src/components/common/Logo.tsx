import Image from "next/image";
import Link from "next/link";

type Props = {
  width?: number;
  href?: string | null;
  className?: string;
  priority?: boolean;
};

export default function Logo({
  width = 120,
  href = "/",
  className = "",
  priority = false,
}: Props) {
  const height = Math.round((width * 100) / 400);

  const img = (
    <Image
      src="/logo.svg"
      width={width}
      height={height}
      priority={priority}
      alt="찍고"
      className="object-contain"
    />
  );

  if (href === null) {
    return <span className={className}>{img}</span>;
  }

  return (
    <Link href={href} className={`inline-flex items-center group ${className}`}>
      <span className="transition-transform group-hover:scale-105">{img}</span>
    </Link>
  );
}
