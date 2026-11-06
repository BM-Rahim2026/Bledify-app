import Image from "next/image";

/** Bledify logo. `white` for dark/photo backgrounds, `mark` for the B-arch symbol only. */
export function Logo({ variant = "color", height = 32, className = "" }: {
  variant?: "color" | "white" | "mark"; height?: number; className?: string;
}) {
  if (variant === "mark") {
    return <Image src="/brand/mark.png" alt="Bledify" width={Math.round(height * 252 / 256)} height={height} className={className} priority />;
  }
  return (
    <Image src={variant === "white" ? "/brand/logo-white.png" : "/brand/logo.png"} alt="Bledify"
      width={Math.round(height * 596 / 160)} height={height} className={className} priority />
  );
}
