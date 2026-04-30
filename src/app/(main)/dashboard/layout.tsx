"use client";

import "@/lib/chart-setup";
import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import {
  Link2,
  BarChart3,
  MousePointerClick,
  ChevronRight,
  ExternalLink,
  Calculator,
  PanelsTopLeft,
  TrendingUp,
  Megaphone,
  ShoppingBag,
  Handshake,
  MessageCircle,
  ArrowLeftRight,
  ListChecks,
  Film,
  Lock,
  Sparkles,
  ShoppingCart,
  BookOpen,
  Globe,
  Zap,
  Bot,
  Flame,
  ChevronDown,
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
  PlanEntitlementsProvider,
  usePlanEntitlements,
} from "./PlanEntitlementsContext";
import { isTrialBlockedDashboardPath } from "@/lib/trial-dashboard-blocked-paths";
import { shouldShowPaidPlanUpsellInDashboard } from "@/lib/dashboard-paid-plan-upsell";
import DashboardPaidPlanUpsell from "./DashboardPaidPlanUpsell";
import type { PlanEntitlements } from "@/lib/plan-entitlements";
import { MERCADOLIVRE_UX_COMING_SOON } from "@/lib/mercadolivre-ux-coming-soon";
import { META_ADS_MAINTENANCE } from "@/lib/meta-ads-maintenance";

type ProSidebarFeature =
  | "ati"
  | "criarCampanhaMeta"
  | "geradorCriativos"
  | "espelhamentogrupos"
  | "especialistagenerate";

type NavItem = {
  title: string;
  href: string;
  icon: React.ReactNode;
  proOnly?: boolean;
  proFeature?: ProSidebarFeature;
  hidden?: boolean;
};

type NavGroup = {
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
};

type NavSection =
  | { type: "group"; group: NavGroup }
  | { type: "single"; item: NavItem };

const navSections: NavSection[] = [
  {
    type: "group",
    group: {
      label: "Relatórios",
      icon: <BarChart3 className="h-4 w-4" />,
      items: [
        {
          title: "Análise de Comissões",
          href: "/dashboard",
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          title: "Tendências Shopee",
          href: "/dashboard/tendencias-shopee",
          icon: <Flame className="h-4 w-4" />,
        },
        {
          title: "Análise de Cliques",
          href: "/dashboard/cliques",
          icon: <MousePointerClick className="h-4 w-4" />,
        },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Páginas e Links",
      icon: <Globe className="h-4 w-4" />,
      items: [
        {
          title: "Meus Links",
          href: "/dashboard/links",
          icon: <Link2 className="h-4 w-4" />,
        },
        {
          title: "Site de Captura",
          href: "/dashboard/captura",
          icon: <PanelsTopLeft className="h-4 w-4" />,
        },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Ads & Tráfego",
      icon: <TrendingUp className="h-4 w-4" />,
      items: [
        {
          title: "Calculadora GPL",
          href: "/dashboard/gpl",
          icon: <Calculator className="h-4 w-4" />,
        },
        {
          title: "Tráfego Inteligente (ATI)",
          href: "/dashboard/ati",
          icon: <TrendingUp className="h-4 w-4" />,
          proOnly: true,
          proFeature: "ati",
        },
        {
          title: "Criar Campanha Meta",
          href: "/dashboard/meta-ads",
          icon: <Megaphone className="h-4 w-4" />,
          proOnly: true,
          proFeature: "criarCampanhaMeta",
          // Escondido enquanto META_ADS_MAINTENANCE estiver true. A página
          // direta `/dashboard/meta-ads` ainda mostra o card de manutenção
          // se alguém colar a URL no browser.
          hidden: META_ADS_MAINTENANCE,
        },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Links de Afiliado",
      icon: <ShoppingBag className="h-4 w-4" />,
      items: [
        {
          title: "Gerador de Links Shopee",
          href: "/dashboard/gerador-links-shopee",
          icon: <ShoppingBag className="h-4 w-4" />,
        },
        {
          title: "Gerador de Links ML",
          href: "/dashboard/minha-lista-ofertas-ml",
          icon: <Handshake className="h-4 w-4" />,
        },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Automações",
      icon: <Zap className="h-4 w-4" />,
      items: [
        {
          title: "Automação de Grupos",
          href: "/dashboard/grupos-venda",
          icon: <MessageCircle className="h-4 w-4" />,
        },
        {
          title: "Espelhamento de Grupos",
          href: "/dashboard/espelhamento-grupos",
          icon: <ArrowLeftRight className="h-4 w-4" />,
          proOnly: true,
          proFeature: "espelhamentogrupos",
        },
      ],
    },
  },
  {
    type: "group",
    group: {
      label: "Criação com IA",
      icon: <Bot className="h-4 w-4" />,
      items: [
        {
          title: "Gerador de Criativos",
          href: "/dashboard/video-editor",
          icon: <Film className="h-4 w-4" />,
          proOnly: true,
          proFeature: "geradorCriativos",
        },
        {
          title: "Gerador de Especialista",
          href: "/dashboard/gerador-especialista",
          icon: <Sparkles className="h-4 w-4" />,
          proOnly: true,
          proFeature: "especialistagenerate",
        },
      ],
    },
  },
  {
    type: "single",
    item: {
      title: "Minha Lista de Ofertas",
      href: "/dashboard/minha-lista-ofertas",
      icon: <ListChecks className="h-4 w-4" />,
    },
  },
  {
    type: "single",
    item: {
      title: "Infoprodutor",
      href: "/dashboard/infoprodutor",
      icon: <ShoppingCart className="h-4 w-4" />,
    },
  },
];

function navItemLocked(
  item: NavItem,
  entitlements: PlanEntitlements | null
): boolean {
  const feature = item.proFeature;
  const hasFeature =
    feature && entitlements ? Boolean(entitlements[feature]) : false;
  if (item.proOnly === true && !hasFeature) return true;
  if (!entitlements) return false;
  if (item.href === "/dashboard/gpl") return !entitlements.gpl.enabled;
  if (item.href === "/dashboard/grupos-venda")
    return entitlements.gruposVenda.maxGroupsTotal <= 0;
  if (item.href === "/dashboard/minha-lista-ofertas")
    return entitlements.gruposVenda.maxLists === 0;
  return false;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanEntitlementsProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </PlanEntitlementsProvider>
  );
}

interface NavGroupItemProps {
  group: NavGroup;
  entitlements: PlanEntitlements | null;
  pathname: string;
  onItemClick: () => void;
  defaultOpen: boolean;
}

function NavGroupItem({
  group,
  entitlements,
  pathname,
  onItemClick,
  defaultOpen,
}: NavGroupItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  const visibleItems = group.items.filter((item) => !item.hidden).map((item) => ({
    ...item,
    locked: navItemLocked(item, entitlements),
  }));

  const hasActive = visibleItems.some((item) => pathname === item.href);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  return (
    <div className="sidebar-group">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={`sidebar-group-trigger${hasActive ? " sidebar-group-trigger--active" : ""}`}
      >
        <span className="sidebar-group-trigger__icon">{group.icon}</span>
        <span className="sidebar-group-trigger__label">{group.label}</span>
        <ChevronDown
          className={`sidebar-group-trigger__chevron${open ? " sidebar-group-trigger__chevron--open" : ""}`}
        />
      </button>

      <div className={`sidebar-group-items${open ? " sidebar-group-items--open" : ""}`}>
        <div className="sidebar-group-items__inner">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            const mlNavComingSoon =
              MERCADOLIVRE_UX_COMING_SOON &&
              item.href === "/dashboard/minha-lista-ofertas-ml";
            const metaAdsDown =
              META_ADS_MAINTENANCE && item.href === "/dashboard/meta-ads";

            // Pra rotas em manutenção: bloqueamos navegação no clique pra
            // evitar 404/erro. O usuário vê badge "Em manutenção" + lock.
            const handleClick = (e: React.MouseEvent) => {
              if (metaAdsDown) {
                e.preventDefault();
                return;
              }
              onItemClick();
            };

            return (
              <Link
                key={item.href}
                href={metaAdsDown ? "#" : item.href}
                onClick={handleClick}
                aria-current={isActive ? "page" : undefined}
                aria-disabled={metaAdsDown ? true : undefined}
                className={`sidebar-sub-item${isActive ? " sidebar-sub-item--active" : ""}${item.locked || metaAdsDown ? " sidebar-sub-item--locked" : ""}`}
                style={metaAdsDown ? { cursor: "not-allowed", opacity: 0.6 } : undefined}
              >
                <span className="sidebar-sub-item__dot" aria-hidden="true" />
                <span className="sidebar-sub-item__icon">{item.icon}</span>
                <span className="sidebar-sub-item__label">{item.title}</span>

                {mlNavComingSoon && (
                  <span className="sidebar-badge sidebar-badge--soon">
                    Em breve
                  </span>
                )}

                {(item.locked || metaAdsDown) && (
                  <Lock className="sidebar-sub-item__lock" aria-hidden="true" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface SingleNavItemProps {
  item: NavItem;
  entitlements: PlanEntitlements | null;
  pathname: string;
  onItemClick: () => void;
}

function SingleNavItem({ item, entitlements, pathname, onItemClick }: SingleNavItemProps) {
  const locked = navItemLocked(item, entitlements);
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      onClick={onItemClick}
      aria-current={isActive ? "page" : undefined}
      className={`sidebar-single-item${isActive ? " sidebar-single-item--active" : ""}${locked ? " sidebar-single-item--locked" : ""}`}
    >
      <span className="sidebar-single-item__icon">{item.icon}</span>
      <span className="sidebar-single-item__label">{item.title}</span>
      {locked && <Lock className="sidebar-sub-item__lock" aria-hidden="true" />}
    </Link>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const { entitlements, tier, loading: entitlementsLoading } =
    usePlanEntitlements();

  const trialBlockedRoute = isTrialBlockedDashboardPath(pathname);
  const showTrialPaidUpsell =
    !entitlementsLoading &&
    shouldShowPaidPlanUpsellInDashboard(pathname, tier, entitlements);
  const showTrialBlockedLoading = entitlementsLoading && trialBlockedRoute;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSidebarOpen]);

  useEffect(() => {
    if (isSidebarOpen && sidebarRef.current) {
      const firstLink =
        sidebarRef.current.querySelector<HTMLAnchorElement>("a[href]");
      firstLink?.focus();
    }
  }, [isSidebarOpen]);

  function handleItemClick() {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }

  return (
    <>
      <style>{`
        /* ── Sidebar shell ─────────────────────────────── */
        .sidebar {
          width: 264px;
          flex-shrink: 0;
          background: #151518;
          border-right: 1px solid rgba(255,255,255,0.02);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(238,77,45,0.3) transparent;
          padding: 32px 12px 24px;
          border-radius: 0;
          margin: 0;
          height: 100%;
          position: fixed;
          top: 0;
          left: 0;
          border: 1px solid rgba(255,255,255,0.03);
          border-left: none;
          z-index: 100;
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
          --sidebar-line: rgba(255,255,255,0.05);
        }
        .sidebar--open { transform: translateX(0); }
        @media (min-width: 1024px) {
          .sidebar {
            position: static;
            height: auto;
            transform: none !important;
            transition: none;
            z-index: 20;
          }
        }

        /* ── Logo / brand strip (HIDDEN) ────────────────── */
        .sidebar-brand { display: none; }

        /* ── Section divider ───────────────────────────── */
        .sidebar-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 8px 8px;
        }

        /* ── Group trigger ─────────────────────────────── */
        .sidebar-group { margin-bottom: 0; }

        .sidebar-group-trigger {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 6px 10px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          text-align: left;
          color: rgba(255,255,255,0.9);
          transition: all 0.2s ease;
        }
        .sidebar-group-trigger:not(.sidebar-group-trigger--active):hover {
          background: rgba(255,255,255,0.05);
          color: #fff;
        }
        .sidebar-group-trigger--active {
          color: #fff;
          background: rgba(238,77,45,0.1);
          border-color: rgba(238,77,45,0.15);
        }

        .sidebar-group-trigger__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.85);
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .sidebar-group-trigger:not(.sidebar-group-trigger--active):hover .sidebar-group-trigger__icon {
          background: rgba(238,77,45,0.15);
          color: #EE4D2D;
        }
        .sidebar-group-trigger--active .sidebar-group-trigger__icon {
          background: #EE4D2D;
          color: #fff;
          box-shadow: 0 4px 12px rgba(238,77,45,0.3);
        }

        .sidebar-group-trigger__label {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
        }

        .sidebar-group-trigger__chevron {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          opacity: 0.4;
          transition: all 0.2s ease;
        }
        .sidebar-group-trigger--active .sidebar-group-trigger__chevron {
          color: #F24626;
          opacity: 1;
        }
        .sidebar-group-trigger__chevron--open {
          transform: rotate(180deg);
        }

        /* ── Group items container (animated) ──────────── */
        .sidebar-group-items {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
          overflow: hidden;
          opacity: 0;
          visibility: hidden;
        }
        .sidebar-group-items--open {
          grid-template-rows: 1fr;
          opacity: 1;
          visibility: visible;
        }
        .sidebar-group-items__inner {
          min-height: 0;
          padding: 8px 0 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          border-left: 1px solid var(--sidebar-line);
          margin-left: 25px;
          position: relative;
        }

        /* ── Sub item (inside group) ───────────────────── */
        .sidebar-sub-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.8);
          text-decoration: none;
          transition: all 0.2s ease;
          position: relative;
          border: 1px solid transparent;
        }
        .sidebar-sub-item:not(.sidebar-sub-item--active):hover {
          color: #fff;
          background: rgba(255,255,255,0.03);
        }
        .sidebar-sub-item--active {
          background: linear-gradient(135deg, rgba(238,77,45,0.2), rgba(238,77,45,0.05));
          border-color: rgba(238,77,45,0.2);
          color: #fff;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .sidebar-sub-item--active::before {
          content: '';
          position: absolute;
          left: -15px;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 4px;
          background: #EE4D2D;
          border-radius: 50%;
          box-shadow: 0 0 10px #EE4D2D;
        }
        .sidebar-sub-item--locked {
          opacity: 0.3;
          pointer-events: none;
        }

        .sidebar-sub-item__dot { display: none; }
        .sidebar-sub-item__icon {
          display: flex;
          align-items: center;
          color: inherit;
          opacity: 0.85;
          transition: all 0.2s ease;
        }
        .sidebar-sub-item--active .sidebar-sub-item__icon {
          color: #EE4D2D;
          opacity: 1;
          filter: drop-shadow(0 0 5px rgba(238,77,45,0.3));
        }
        .sidebar-sub-item__label {
          flex: 1;
        }
        .sidebar-sub-item__lock {
          width: 12px;
          height: 12px;
          opacity: 0.5;
        }

        /* ── Single item (outside group) ───────────────── */
        .sidebar-single-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 10px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          text-decoration: none;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }
        .sidebar-single-item:not(.sidebar-single-item--active):hover {
          background: rgba(255,255,255,0.05);
          color: #fff;
        }
        .sidebar-single-item--active {
          background: rgba(238,77,45,0.1);
          border-color: rgba(238,77,45,0.15);
          color: #fff;
        }
        .sidebar-single-item--locked {
          opacity: 0.3;
          pointer-events: none;
        }
        .sidebar-single-item__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.85);
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .sidebar-single-item:not(.sidebar-single-item--active):hover .sidebar-single-item__icon {
          background: rgba(238,77,45,0.15);
          color: #EE4D2D;
        }
        .sidebar-single-item--active .sidebar-single-item__icon {
          background: #EE4D2D;
          color: #fff;
          box-shadow: 0 4px 12px rgba(238,77,45,0.3);
        }
        .sidebar-single-item__label {
          flex: 1;
        }

        /* ── Badges ────────────────────────────────────── */
        .sidebar-badge {
          flex-shrink: 0;
          border-radius: 4px;
          padding: 1px 5px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .sidebar-badge--soon {
          background: rgba(220,38,38,0.25);
          color: #fca5a5;
          border: 1px solid rgba(220,38,38,0.3);
        }

        /* ── Tutorial link ─────────────────────────────── */
        .sidebar-tutorial {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
          color: #fff;
          text-decoration: none;
          background: linear-gradient(135deg, #EE4D2D, #d43a1f);
          box-shadow: 0 4px 15px rgba(238,77,45,0.3);
          transition: all 0.3s ease;
          margin-top: 12px;
        }
        .sidebar-tutorial:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(238,77,45,0.4);
          filter: brightness(1.1);
        }
        .sidebar-tutorial svg {
          flex-shrink: 0;
        }

        /* ── Light mode overrides ──────────────────────── */
        html.light .sidebar {
          background: #ffffff;
          border-right: 1px solid #e4e4e7;
          box-shadow: 4px 0 15px rgba(0,0,0,0.03);
          --sidebar-line: #e4e4e7;
        }
        html.light .sidebar-group-trigger,
        html.light .sidebar-single-item {
          color: #27272A;
        }
        html.light .sidebar-group-trigger:not(.sidebar-group-trigger--active):hover,
        html.light .sidebar-single-item:not(.sidebar-single-item--active):hover {
          background: #eaeaec;
          color: #18181b;
        }
        html.light .sidebar-group-trigger--active,
        html.light .sidebar-single-item--active {
          background: rgba(238,77,45,0.08);
          border-color: rgba(238,77,45,0.15);
          color: #EE4D2D;
        }
        html.light .sidebar-group-trigger__icon,
        html.light .sidebar-single-item__icon {
          background: #f4f4f5;
          color: #71717a;
        }
        html.light .sidebar-group-trigger--active .sidebar-group-trigger__icon,
        html.light .sidebar-single-item--active .sidebar-single-item__icon {
          background: #EE4D2D;
          color: #fff;
        }
        html.light .sidebar-sub-item {
          color: #52525b;
        }
        html.light .sidebar-sub-item:not(.sidebar-sub-item--active):hover {
          background: #eaeaec;
          color: #18181b;
        }
        html.light .sidebar-sub-item--active {
          background: rgba(238,77,45,0.08);
          border-color: rgba(238,77,45,0.12);
          color: #EE4D2D;
        }
        html.light .sidebar-sub-item--active .sidebar-sub-item__dot {
          background: #EE4D2D;
        }
        html.light .sidebar-group-trigger__chevron {
          color: #171718;
        }
        html.light .sidebar-group-trigger--active .sidebar-group-trigger__chevron {
          color: #F24626;
        }
      `}</style>

      <div className="bg-dark-bg min-h-[calc(100vh-8rem)] flex text-text-primary">
        {/* Mobile toggle button */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className={`lg:hidden fixed top-1/2 -translate-y-1/2 left-0 z-50
                      bg-shopee-orange p-2 pr-1 rounded-r-full border-y border-r border-shopee-orange
                      shadow-lg transition-all duration-300 ease-in-out
                      ${isSidebarOpen ? "-translate-x-24" : "translate-x-0"}`}
          aria-label="Abrir menu de navegação"
          aria-expanded={isSidebarOpen}
          aria-controls="sidebar-nav"
          type="button"
        >
          <ChevronRight className="h-6 w-6 text-white" />
        </button>

        {/* Overlay */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          id="sidebar-nav"
          ref={sidebarRef}
          className={`sidebar${isSidebarOpen ? " sidebar--open" : ""}`}
          aria-label="Navegação do dashboard"
        >
          {/* Brand strip */}
          <div className="sidebar-brand">
            <span className="sidebar-brand__dot" />
            <span className="sidebar-brand__text">Menu</span>
          </div>

          <nav role="navigation" aria-label="Navegação principal" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {navSections.map((section, idx) => {
              if (section.type === "group") {
                const hasActiveInGroup = section.group.items.some(
                  (item) => pathname === item.href
                );
                return (
                  <NavGroupItem
                    key={section.group.label}
                    group={section.group}
                    entitlements={entitlements}
                    pathname={pathname}
                    onItemClick={handleItemClick}
                    defaultOpen={hasActiveInGroup || idx < 1}
                  />
                );
              }

              if (section.type === "single") {
                return (
                  <SingleNavItem
                    key={section.item.href}
                    item={section.item}
                    entitlements={entitlements}
                    pathname={pathname}
                    onItemClick={handleItemClick}
                  />
                );
              }

              return null;
            })}
          </nav>

          <div style={{ flex: 1, minHeight: 16 }} />

          <Link
            href="https://www.youtube.com/playlist?list=PLt2etInlvKH1mUwYrUMOp8mBNcNsFh3WO"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-tutorial"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Acessar Tutorial (abre em nova guia)"
          >
            <BookOpen className="h-4 w-4" />
            <span>Acessar Tutorial</span>
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Link>
        </aside>

        <main className="min-h-0 flex-grow p-6 md:p-8 overflow-auto lg:ml-[-256px] scrollbar-thin">
          <div className="lg:ml-64">
            {showTrialBlockedLoading ? (
              <div className="flex items-center justify-center py-20 text-text-secondary text-sm">
                Carregando...
              </div>
            ) : showTrialPaidUpsell ? (
              <DashboardPaidPlanUpsell />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </>
  );
}