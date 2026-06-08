import logoAsset from "@/assets/swing-academy-logo.png.asset.json";

type Props = {
  /** Pixel size of the logo mark (square). */
  size?: number;
  /** Show the "SWING Academy" wordmark next to the mark. */
  withWordmark?: boolean;
  /** Tailwind color classes for the wordmark text. */
  wordmarkClassName?: string;
  /** Additional classes for the outer element. */
  className?: string;
  /** Force light/dark text variant for the wordmark. */
  variant?: "auto" | "light" | "dark";
};

/**
 * SWING Academy brand logo. Renders the official rainbow mark from CDN, with
 * an optional wordmark beside it.
 */
export function BrandLogo({
  size = 36,
  withWordmark = true,
  wordmarkClassName,
  className,
  variant = "auto",
}: Props) {
  const wordmarkBase =
    variant === "light"
      ? "text-white"
      : variant === "dark"
        ? "text-navy-500"
        : "text-navy-500";
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <img
        src={logoAsset.url}
        alt="SWING Academy"
        width={size}
        height={size}
        className="block h-auto w-auto select-none drop-shadow-sm"
        style={{ height: size, width: size, objectFit: "contain" }}
        loading="eager"
        decoding="async"
      />
      {withWordmark && (
        <span
          className={`text-lg font-semibold whitespace-nowrap ${wordmarkBase} ${wordmarkClassName ?? ""}`}
        >
          SWING{" "}
          <span className={variant === "light" ? "text-white/80" : "text-magenta-500"}>
            Academy
          </span>
        </span>
      )}
    </span>
  );
}
