"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AMAZON_EXT_AFFILIATE_TAG_LS_KEY,
  AMAZON_EXT_SESSION_LS_KEY,
} from "@/lib/amazon/amazon-session-cookie";

export const AMAZON_AFFILIATE_SETTINGS_CHANGED_EVENT = "aa-amazon-affiliate-settings-changed";

export function dispatchAmazonAffiliateSettingsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AMAZON_AFFILIATE_SETTINGS_CHANGED_EVENT));
}

function readFromStorage(): { sessionToken: string; affiliateTag: string } {
  if (typeof window === "undefined") return { sessionToken: "", affiliateTag: "" };
  try {
    return {
      sessionToken: localStorage.getItem(AMAZON_EXT_SESSION_LS_KEY) ?? "",
      affiliateTag: localStorage.getItem(AMAZON_EXT_AFFILIATE_TAG_LS_KEY) ?? "",
    };
  } catch {
    return { sessionToken: "", affiliateTag: "" };
  }
}

/** Etiqueta + token Amazon salvos no navegador (mesmo localStorage em toda a app). */
export function useAmazonAffiliateLocalSettings(): {
  sessionToken: string;
  affiliateTag: string;
  reload: () => void;
} {
  const [state, setState] = useState({ sessionToken: "", affiliateTag: "" });

  const reload = useCallback(() => {
    setState(readFromStorage());
  }, []);

  useEffect(() => {
    const sync = () => setState(readFromStorage());
    sync();
    window.addEventListener(AMAZON_AFFILIATE_SETTINGS_CHANGED_EVENT, sync);
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AMAZON_AFFILIATE_SETTINGS_CHANGED_EVENT, sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { sessionToken: state.sessionToken, affiliateTag: state.affiliateTag, reload };
}
