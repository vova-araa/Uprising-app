import { useState, useEffect } from "react";
import { getSignedUrl } from "@/lib/storage";

interface SignedImageProps {
  bucket: string;
  urlOrPath: string;
  alt: string;
  className?: string;
}

/** Renders an image from a private bucket using a signed URL. */
export const SignedImage = ({ bucket, urlOrPath, alt, className }: SignedImageProps) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSignedUrl(bucket, urlOrPath).then(url => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [bucket, urlOrPath]);

  if (!src) return <div className={className + " bg-muted animate-pulse"} />;
  return <img src={src} alt={alt} className={className} />;
};

interface SignedLinkProps {
  bucket: string;
  urlOrPath: string;
  children: React.ReactNode;
  className?: string;
}

/** Renders a link to a file in a private bucket using a signed URL. */
export const SignedLink = ({ bucket, urlOrPath, children, className }: SignedLinkProps) => {
  const [href, setHref] = useState<string>("#");

  useEffect(() => {
    let cancelled = false;
    getSignedUrl(bucket, urlOrPath).then(url => {
      if (!cancelled) setHref(url);
    });
    return () => { cancelled = true; };
  }, [bucket, urlOrPath]);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
};
