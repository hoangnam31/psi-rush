import Link from "next/link";

export function WobbleLogo({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={`wobble-logo ${compact ? "compact" : ""}`}>
    <span className="logo-badge"><i>★</i><strong>PSI</strong></span><span>PSI <b>RUSH</b><small>MASCOT LEAGUE</small></span>
  </Link>;
}
