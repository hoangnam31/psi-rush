import Link from "next/link";

export function WobbleLogo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={`wobble-logo ${compact ? "compact" : ""}`}>
    <span className="logo-badge">P</span><span>PSI <b>RUSH</b></span>
  </Link>;
}
