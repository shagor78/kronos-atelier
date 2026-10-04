import React, { useState } from 'react';

interface ProductImageProps {
  src: string;
  alt: string;
  sku?: string;
  className?: string;
}

/**
 * Enforces Zero-Broken-Image Policy with referrerPolicy="no-referrer"
 * and a refined architectural fallback surface if an image asset fails to load.
 */
export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  sku,
  className = 'w-full h-full object-cover',
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#EFEDE8] text-[#52525B] p-6 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-12 h-12 border border-[#D4D1C9] flex items-center justify-center mb-3">
          <span className="font-serif text-lg tracking-widest text-[#18181B]">KA</span>
        </div>
        <span className="text-xs font-medium text-[#18181B] text-center line-clamp-1">
          {alt}
        </span>
        {sku && (
          <span className="text-[11px] font-mono text-[#71717A] mt-1">{sku}</span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
};
