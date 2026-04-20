"use client";

import React from "react";
import { ThemeProvider } from "./components/theme/ThemeProvider";

/** Chart.js só no layout do dashboard — evita carregar/registar Chart em páginas públicas (captura /go, etc.). */
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
