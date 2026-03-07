"use client";

import { ExternalLink } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

interface CTAButtonProps {
  href: string;
  buttonColor: string;
  hasPixel: boolean;
  text: string;
  isWhatsApp?: boolean;
}

export default function CTAButton({
  href,
  buttonColor,
  hasPixel,
  text,
  isWhatsApp = true,
}: CTAButtonProps) {
  const handleClick = () => {
    const w = window as unknown as { fbq?: (...args: unknown[]) => void };

    if (hasPixel && typeof window !== "undefined" && w.fbq) {
      w.fbq("track", "Lead");
    }
  };

  return (
    <a
      href={href}
      rel="nofollow"
      onClick={handleClick}
      className="cta-pulse w-full sm:w-[420px] inline-flex items-center justify-center gap-2 px-6 py-4 font-extrabold
                 transition-transform duration-200 ease-out hover:scale-[1.03]"
      style={{
        backgroundColor: buttonColor,
        color: "rgb(255, 255, 255)",
        borderRadius: "16px",
        boxShadow: "none",
      }}
    >
      {isWhatsApp ? (
        <FaWhatsapp size={23} color="#fff" aria-hidden />
      ) : (
        <ExternalLink size={20} aria-hidden />
      )}

      {text}
    </a>
  );
}
