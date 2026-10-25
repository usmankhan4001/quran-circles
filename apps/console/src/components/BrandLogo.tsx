/** The Quran Circles app icon, from `public/logo.png`. Decorative: the name always sits beside it. */
export function BrandLogo({ size, className }: { size: number; className?: string }) {
  return (
    <img
      className={className ? `brand-logo ${className}` : 'brand-logo'}
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt=""
      width={size}
      height={size}
      style={{ inlineSize: `${size / 16}rem`, blockSize: `${size / 16}rem` }}
    />
  );
}
