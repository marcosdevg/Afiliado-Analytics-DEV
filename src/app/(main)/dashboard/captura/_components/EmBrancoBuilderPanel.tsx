"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type {
  BlankAnimationPreset,
  BlankBgImageFit,
  BlankBgImagePosition,
  BlankBgImageRepeat,
  BlankCanvasConfig,
  BlankCtaPlacement,
  BlankDecorative,
  BlankFontPreset,
} from "@/lib/capture-blank-canvas";
import { CAPTURE_FONT_PICKER_OPTIONS } from "@/lib/capture-google-font-presets";
import EmBrancoCssColorField from "./EmBrancoCssColorField";
import Toolist from "@/app/components/ui/Toolist";
import MetaSearchablePicker, { type MetaPickerOption } from "@/app/components/meta/MetaSearchablePicker";
import CaptureRangeField from "./CaptureRangeField";

const EMBRANCO_DECORATIVE_OPTIONS: MetaPickerOption[] = [
  { value: "none", label: "Nenhuma", description: "Sem padrão decorativo no fundo." },
  { value: "dots", label: "Pontos subtis", description: "Textura leve de pontos." },
  { value: "grid", label: "Grelha técnica", description: "Linhas discretas." },
  { value: "gradient_orbs", label: "Orbes de luz", description: "Formas suaves com brilho." },
];

const EMBRANCO_BG_FIT_OPTIONS: MetaPickerOption[] = [
  { value: "cover", label: "Cover (preenche)", description: "A imagem cobre toda a área." },
  { value: "contain", label: "Contain (inteira)", description: "Imagem inteira visível, pode haver margens." },
];

const EMBRANCO_BG_REPEAT_OPTIONS: MetaPickerOption[] = [
  { value: "no-repeat", label: "Sem repetir" },
  { value: "repeat", label: "Repetir" },
  { value: "repeat-x", label: "Só horizontal" },
  { value: "repeat-y", label: "Só vertical" },
];

const EMBRANCO_BG_POSITION_OPTIONS: MetaPickerOption[] = [
  { value: "center", label: "Centro" },
  { value: "top", label: "Topo" },
  { value: "bottom", label: "Base" },
  { value: "left", label: "Esquerda" },
  { value: "right", label: "Direita" },
];

const EMBRANCO_ALIGN_OPTIONS: MetaPickerOption[] = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
];

const EMBRANCO_CTA_PLACEMENT_OPTIONS: MetaPickerOption[] = [
  {
    value: "below_description",
    label: "Depois do texto (no cartão)",
    description: "O botão fica dentro do cartão, abaixo da descrição.",
  },
  {
    value: "bottom_sticky",
    label: "Fixo em baixo (sticky)",
    description: "Barra fixa no fundo do ecrã.",
  },
];

const EMBRANCO_ANIMATION_OPTIONS: MetaPickerOption[] = [
  { value: "none", label: "Nenhuma", description: "Sem animação de entrada." },
  { value: "fade_rise", label: "Subir com fade", description: "Entrada suave de baixo para cima." },
  { value: "bounce_in", label: "Bounce suave", description: "Pequeno salto ao aparecer." },
  { value: "float_card", label: "Cartão a flutuar", description: "Movimento contínuo suave." },
  { value: "pulse_cta", label: "Entrada rápida + foco CTA", description: "Destaque no botão após entrar." },
  { value: "shimmer_bg", label: "Brilho no fundo", description: "Brilho animado no fundo (sem imagem de fundo)." },
];

const labelClass = "block text-xs font-medium text-text-secondary mb-1";
const inputClass =
  "w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-shopee-orange/50";
const tabBase =
  "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors border border-transparent";
const tabActive = "bg-shopee-orange/15 text-shopee-orange border-shopee-orange/30";
const tabIdle = "text-text-secondary hover:text-text-primary hover:bg-dark-bg/60";

type TabId = "bg" | "card" | "text" | "btn" | "media" | "motion";

export type EmBrancoBuilderPanelProps = {
  value: BlankCanvasConfig;
  onChange: (next: BlankCanvasConfig) => void;
  heroFile: File | null;
  onHeroFile: (f: File | null) => void;
  onClearStoredHero: () => void | Promise<void>;
  bgFile: File | null;
  onBgFile: (f: File | null) => void;
  onClearStoredBg: () => void | Promise<void>;
  /** Pré-visualização (blob local ou URL pública já guardada). */
  heroPreviewUrl: string | null;
  bgPreviewUrl: string | null;
  captureWizardMode: "create" | "edit";
};

function patch(prev: BlankCanvasConfig, part: Partial<BlankCanvasConfig>): BlankCanvasConfig {
  return { ...prev, ...part };
}

function EmBrancoToggleRow(props: {
  id: string;
  label: string;
  /** Texto longo no ícone de ajuda (Toolist). */
  toolistText?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  const labelId = `${props.id}-label`;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
        <span id={labelId} className="text-sm font-medium text-text-primary min-w-0">
          {props.label}
        </span>
        {props.toolistText ? (
          <Toolist variant="below" wide text={props.toolistText} className="shrink-0" />
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-labelledby={labelId}
        aria-checked={props.checked}
        onClick={() => props.onCheckedChange(!props.checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-dark-border transition-colors focus:outline-none focus:ring-2 focus:ring-shopee-orange/50 ${
          props.checked ? "bg-shopee-orange" : "bg-dark-bg"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
            props.checked ? "translate-x-[1.35rem]" : "translate-x-0.5"
          } mt-px`}
        />
      </button>
    </div>
  );
}

const MAX_BLANK_IMAGE_BYTES = 3 * 1024 * 1024;
const BLANK_IMG_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

function EmBrancoImagePickBlock(props: {
  inputId: string;
  previewUrl: string | null;
  hasPendingOrStored: boolean;
  pendingFile: boolean;
  onPickFile: (f: File | null) => void;
  onClear: () => void | Promise<void>;
  selectTitle: string;
  constraintsLine: string;
  accept: string;
  uploadHint: string;
}) {
  const {
    inputId,
    previewUrl,
    hasPendingOrStored,
    pendingFile,
    onPickFile,
    onClear,
    selectTitle,
    constraintsLine,
    accept,
    uploadHint,
  } = props;

  return (
    <div className="space-y-2">
      {hasPendingOrStored ? (
        <div className="flex items-center gap-3">
          {previewUrl ? (
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md border border-dark-border bg-dark-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void onClear()}
            className="inline-flex items-center gap-2 rounded-md border border-dark-border bg-dark-bg px-3 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            <X className="h-4 w-4" />
            {pendingFile ? "Remover seleção" : "Remover imagem"}
          </button>
        </div>
      ) : null}

      <label
        htmlFor={inputId}
        className="block cursor-pointer rounded-lg border border-dashed border-dark-border bg-dark-bg/40 p-4 transition-colors hover:bg-dark-bg/60"
      >
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!f) {
              onPickFile(null);
              return;
            }
            if (!BLANK_IMG_MIME.has(f.type) || f.size > MAX_BLANK_IMAGE_BYTES) return;
            onPickFile(f);
          }}
        />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dark-border bg-dark-card">
            <Plus className="h-5 w-5 text-text-secondary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-primary">{selectTitle}</div>
            <div className="truncate text-xs text-text-secondary">{constraintsLine}</div>
          </div>
        </div>
      </label>
      <p className="text-[11px] leading-relaxed text-text-secondary/85">{uploadHint}</p>
    </div>
  );
}

export default function EmBrancoBuilderPanel({
  value: c,
  onChange,
  heroFile,
  onHeroFile,
  onClearStoredHero,
  bgFile,
  onBgFile,
  onClearStoredBg,
  heroPreviewUrl,
  bgPreviewUrl,
  captureWizardMode,
}: EmBrancoBuilderPanelProps) {
  const [tab, setTab] = useState<TabId>("bg");

  const blankImgUploadHint =
    captureWizardMode === "create"
      ? "Pré-visualização imediata. O envio ao armazenamento acontece ao criar o site (como a logo no passo 1)."
      : "Pré-visualização imediata. O envio ao armazenamento acontece ao guardar as alterações.";

  const tabs: { id: TabId; label: string }[] = [
    { id: "bg", label: "Fundo" },
    { id: "card", label: "Cartão" },
    { id: "text", label: "Textos" },
    { id: "btn", label: "Botão" },
    { id: "media", label: "Logo & imagem" },
    { id: "motion", label: "Animação" },
  ];

  return (
    <div className="rounded-lg border border-dark-border bg-dark-bg/25 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary">Página em branco</div>
        </div>
        <Toolist
          variant="below"
          wide
          className="shrink-0"
          text="Fundo (cor, gradiente, imagem, brilho animado), cartão, tipografia, botão, imagem de destaque e animações de entrada. YouTube, carrossel, notificações e secção promocional ficam no passo 5 do assistente."
        />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-dark-border/70 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`${tabBase} ${tab === t.id ? tabActive : tabIdle}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bg" ? (
        <div className="space-y-3">
          <EmBrancoToggleRow
            id="em-use-solid-bg"
            label="Fundo sólido"
            toolistText="Em vez do gradiente: usa uma única cor (definida abaixo) para o fundo da página."
            checked={c.useSolidBg}
            onCheckedChange={(useSolidBg) => onChange(patch(c, { useSolidBg }))}
          />
          {c.useSolidBg ? (
            <EmBrancoCssColorField
              label="Cor do fundo"
              value={c.solidBg}
              onChange={(solidBg) => onChange(patch(c, { solidBg }))}
              allowAlpha
              fallbackHex="#0c0c0f"
            />
          ) : (
            <>
              <CaptureRangeField
                label="Ângulo do gradiente"
                value={c.bgAngle}
                min={0}
                max={360}
                format={(n) => `${n}°`}
                onChange={(n) => onChange(patch(c, { bgAngle: n }))}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EmBrancoCssColorField
                  label="Cor inicial"
                  value={c.bgFrom}
                  onChange={(bgFrom) => onChange(patch(c, { bgFrom }))}
                  allowAlpha
                  fallbackHex="#0f0f14"
                />
                <EmBrancoCssColorField
                  label="Cor final"
                  value={c.bgTo}
                  onChange={(bgTo) => onChange(patch(c, { bgTo }))}
                  allowAlpha
                  fallbackHex="#1a0f24"
                />
              </div>
            </>
          )}
          <div>
            <label className={labelClass}>Decoração de fundo</label>
            <MetaSearchablePicker
              value={c.decorative}
              onChange={(v) => onChange(patch(c, { decorative: v as BlankDecorative }))}
              options={EMBRANCO_DECORATIVE_OPTIONS}
              modalTitle="Decoração de fundo"
              modalDescription="Padrão visual por trás do gradiente ou da cor sólida."
              searchPlaceholder="Filtrar opções…"
              emptyButtonLabel="Escolher decoração"
              className="w-full"
              openButtonId="em-blank-decorative"
            />
          </div>

          <div className="rounded-md border border-dark-border/60 bg-dark-bg/30 p-3 space-y-3">
            <EmBrancoToggleRow
              id="em-bg-image"
              label="Imagem de fundo"
              toolistText="Camada por baixo do gradiente ou da cor sólida: a imagem fica atrás do tratamento visual escolhido em cima."
              checked={c.bgImageEnabled}
              onCheckedChange={(bgImageEnabled) => onChange(patch(c, { bgImageEnabled }))}
            />
            {c.bgImageEnabled ? (
              <>
                <EmBrancoImagePickBlock
                  inputId="em-blank-bg-file"
                  previewUrl={bgPreviewUrl}
                  hasPendingOrStored={Boolean(bgFile || c.bgImagePath?.trim())}
                  pendingFile={Boolean(bgFile)}
                  onPickFile={onBgFile}
                  onClear={onClearStoredBg}
                  selectTitle="Selecionar imagem de fundo"
                  constraintsLine="PNG, JPEG ou WebP até 3 MB"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  uploadHint={blankImgUploadHint}
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className={labelClass}>Ajuste</label>
                    <MetaSearchablePicker
                      value={c.bgImageFit}
                      onChange={(v) => onChange(patch(c, { bgImageFit: v as BlankBgImageFit }))}
                      options={EMBRANCO_BG_FIT_OPTIONS}
                      modalTitle="Ajuste da imagem de fundo"
                      searchPlaceholder="Filtrar…"
                      emptyButtonLabel="Escolher ajuste"
                      className="w-full"
                      openButtonId="em-blank-bg-fit"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Repetição</label>
                    <MetaSearchablePicker
                      value={c.bgImageRepeat}
                      onChange={(v) => onChange(patch(c, { bgImageRepeat: v as BlankBgImageRepeat }))}
                      options={EMBRANCO_BG_REPEAT_OPTIONS}
                      modalTitle="Repetição da imagem de fundo"
                      searchPlaceholder="Filtrar…"
                      emptyButtonLabel="Escolher repetição"
                      className="w-full"
                      openButtonId="em-blank-bg-repeat"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Posição</label>
                    <MetaSearchablePicker
                      value={c.bgImagePosition}
                      onChange={(v) => onChange(patch(c, { bgImagePosition: v as BlankBgImagePosition }))}
                      options={EMBRANCO_BG_POSITION_OPTIONS}
                      modalTitle="Posição da imagem de fundo"
                      searchPlaceholder="Filtrar…"
                      emptyButtonLabel="Escolher posição"
                      className="w-full"
                      openButtonId="em-blank-bg-position"
                    />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "card" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-dark-border/60 bg-dark-bg/25 p-3 sm:p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-primary/90">
              Cores do cartão
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
              <EmBrancoCssColorField
                label="Fundo"
                value={c.cardBg}
                onChange={(cardBg) => onChange(patch(c, { cardBg }))}
                allowAlpha
                fallbackHex="#ffffff"
              />
              <EmBrancoCssColorField
                label="Borda"
                value={c.cardBorder}
                onChange={(cardBorder) => onChange(patch(c, { cardBorder }))}
                allowAlpha
                fallbackHex="#ffffff"
              />
            </div>
          </div>
          <CaptureRangeField
            label="Raio dos cantos"
            value={c.cardRadiusPx}
            min={0}
            max={48}
            onChange={(n) => onChange(patch(c, { cardRadiusPx: n }))}
          />
          <CaptureRangeField
            label="Intensidade da sombra"
            value={Math.round(c.cardShadowOpacity * 100)}
            min={0}
            max={100}
            format={(n) => `${n}%`}
            onChange={(n) => onChange(patch(c, { cardShadowOpacity: n / 100 }))}
          />
          <EmBrancoToggleRow
            id="em-glass-card"
            label="Efeito vidro"
            toolistText="Desfoque (backdrop blur) no cartão para aspeto de vidro fosco sobre o fundo."
            checked={c.glassCard}
            onCheckedChange={(glassCard) => onChange(patch(c, { glassCard }))}
          />
          <CaptureRangeField
            label="Largura máx. do conteúdo"
            value={c.maxContentWidthPx}
            min={320}
            max={640}
            step={10}
            onChange={(n) => onChange(patch(c, { maxContentWidthPx: n }))}
          />
        </div>
      ) : null}

      {tab === "text" ? (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Tipo de letra</label>
            <MetaSearchablePicker
              value={c.fontPreset}
              onChange={(v) => onChange(patch(c, { fontPreset: v as BlankFontPreset }))}
              options={CAPTURE_FONT_PICKER_OPTIONS}
              modalTitle="Tipo de letra"
              modalDescription="Fonte aplicada ao título e à descrição na página pública."
              searchPlaceholder="Filtrar fontes…"
              emptyButtonLabel="Escolher fonte"
              className="w-full"
              openButtonId="em-blank-font"
              triggerVariant="field"
            />
          </div>
          <div className="rounded-xl border border-dark-border/60 bg-dark-bg/30 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-primary/90">
                Título
              </span>
              <Toolist
                variant="below"
                wide
                text="Cor e tamanho do destaque principal no cartão."
              />
            </div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
              <EmBrancoCssColorField
                label="Cor"
                value={c.titleColor}
                onChange={(titleColor) => onChange(patch(c, { titleColor }))}
                fallbackHex="#fafafa"
              />
              <CaptureRangeField
                label="Tamanho"
                value={c.titleFontPx}
                min={18}
                max={48}
                onChange={(n) => onChange(patch(c, { titleFontPx: n }))}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Alinhamento do título</label>
            <MetaSearchablePicker
              value={c.titleAlign}
              onChange={(v) =>
                onChange(patch(c, { titleAlign: v as BlankCanvasConfig["titleAlign"] }))
              }
              options={EMBRANCO_ALIGN_OPTIONS}
              modalTitle="Alinhamento do título"
              searchPlaceholder="Filtrar…"
              emptyButtonLabel="Escolher alinhamento"
              className="w-full"
              openButtonId="em-blank-title-align"
            />
          </div>
          {c.showSubtitle ? (
            <div className="rounded-xl border border-dark-border/50 bg-dark-bg/20 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-primary/90">
                  Linha curta
                </span>
                <Toolist
                  variant="below"
                  wide
                  text="Frase opcional entre o título e a descrição (ativada no passo 2 do assistente)."
                />
              </div>
              <EmBrancoCssColorField
                label="Cor"
                value={c.subtitleColor}
                onChange={(subtitleColor) => onChange(patch(c, { subtitleColor }))}
                allowAlpha
                fallbackHex="#fafafa"
              />
            </div>
          ) : null}
          <div className="rounded-xl border border-dark-border/60 bg-dark-bg/30 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-primary/90">
                Descrição
              </span>
              <Toolist
                variant="below"
                wide
                text="Cor do parágrafo e tamanho da letra do texto de apoio."
              />
            </div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
              <EmBrancoCssColorField
                label="Cor"
                value={c.descColor}
                onChange={(descColor) => onChange(patch(c, { descColor }))}
                allowAlpha
                fallbackHex="#fafafa"
              />
              <CaptureRangeField
                label="Tamanho da letra"
                value={c.descFontPx}
                min={12}
                max={22}
                onChange={(n) => onChange(patch(c, { descFontPx: n }))}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Alinhamento do texto (título + descrição)</label>
            <MetaSearchablePicker
              value={c.textAlign}
              onChange={(v) =>
                onChange(patch(c, { textAlign: v as BlankCanvasConfig["textAlign"] }))
              }
              options={EMBRANCO_ALIGN_OPTIONS}
              modalTitle="Alinhamento do texto"
              modalDescription="Título e descrição no cartão."
              searchPlaceholder="Filtrar…"
              emptyButtonLabel="Escolher alinhamento"
              className="w-full"
              openButtonId="em-blank-text-align"
            />
          </div>
        </div>
      ) : null}

      {tab === "btn" ? (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Posição do botão</label>
            <MetaSearchablePicker
              value={c.ctaPlacement}
              onChange={(v) => onChange(patch(c, { ctaPlacement: v as BlankCtaPlacement }))}
              options={EMBRANCO_CTA_PLACEMENT_OPTIONS}
              modalTitle="Posição do botão"
              searchPlaceholder="Filtrar…"
              emptyButtonLabel="Escolher posição"
              className="w-full"
              openButtonId="em-blank-cta-placement"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-dark-border/60 bg-dark-bg/30 px-2.5 py-2">
            <span className="text-[11px] text-text-secondary/90">Cor do botão no passo 1</span>
            <Toolist
              variant="below"
              wide
              text="A cor de fundo do botão é a mesma do passo 1 (identidade da página). Neste separador defines só posição do CTA, raio, largura total e pulso."
            />
          </div>
          <CaptureRangeField
            label="Raio do botão (999 = pílula)"
            value={c.btnRadiusPx}
            min={0}
            max={999}
            onChange={(n) => onChange(patch(c, { btnRadiusPx: n }))}
          />
          <EmBrancoToggleRow
            id="em-btn-full-width"
            label="Botão largura total"
            checked={c.btnFullWidth}
            onCheckedChange={(btnFullWidth) => onChange(patch(c, { btnFullWidth }))}
          />
          <EmBrancoToggleRow
            id="em-btn-pulse"
            label="Pulso no botão"
            toolistText="Animação suave à volta do CTA para chamar mais atenção ao botão."
            checked={c.btnPulse}
            onCheckedChange={(btnPulse) => onChange(patch(c, { btnPulse }))}
          />
        </div>
      ) : null}

      {tab === "media" ? (
        <div className="space-y-3">
          <EmBrancoToggleRow
            id="em-show-logo"
            label="Mostrar logo"
            toolistText="Usa a mesma imagem enviada no passo 1 (logo opcional do site)."
            checked={c.showLogo}
            onCheckedChange={(showLogo) => onChange(patch(c, { showLogo }))}
          />
          <EmBrancoToggleRow
            id="em-show-hero"
            label="Mostrar imagem de destaque"
            checked={c.showHero}
            onCheckedChange={(showHero) => onChange(patch(c, { showHero }))}
          />
          {c.showHero ? (
            <>
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">Imagem de destaque</span>
                  <Toolist
                    variant="below"
                    wide
                    text="Aparece no cartão por baixo do título (quando ativa). Mesmo fluxo que a logo: pode escolher o ficheiro já; o upload ao armazenamento é ao criar ou guardar o site."
                  />
                </div>
                <EmBrancoImagePickBlock
                  inputId="em-blank-hero-file"
                  previewUrl={heroPreviewUrl}
                  hasPendingOrStored={Boolean(heroFile || c.heroPath?.trim())}
                  pendingFile={Boolean(heroFile)}
                  onPickFile={onHeroFile}
                  onClear={onClearStoredHero}
                  selectTitle="Selecionar imagem de destaque"
                  constraintsLine="PNG, JPEG ou WebP até 3 MB"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  uploadHint={blankImgUploadHint}
                />
              </div>
              <CaptureRangeField
                label="Raio da imagem"
                value={c.heroRadiusPx}
                min={0}
                max={40}
                onChange={(n) => onChange(patch(c, { heroRadiusPx: n }))}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "motion" ? (
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="block text-xs font-medium text-text-secondary">Animação de entrada</span>
              <Toolist
                variant="below"
                wide
                text='Respeitamos “menos movimento” no sistema: com essa opção ativa no dispositivo, as animações são desligadas automaticamente.'
              />
            </div>
            <MetaSearchablePicker
              value={c.animation}
              onChange={(v) => onChange(patch(c, { animation: v as BlankAnimationPreset }))}
              options={EMBRANCO_ANIMATION_OPTIONS}
              modalTitle="Animação de entrada"
              modalDescription="Respeitamos “menos movimento” no sistema: com essa opção ativa no dispositivo, as animações são desligadas automaticamente."
              searchPlaceholder="Filtrar animações…"
              emptyButtonLabel="Escolher animação"
              className="w-full"
              openButtonId="em-blank-animation"
            />
          </div>
          <div className="flex items-center gap-1.5 border-t border-dark-border/50 pt-2">
            <span className="text-[11px] font-medium text-text-primary">Brilho no fundo</span>
            <Toolist
              variant="below"
              wide
              text="Funciona com fundo sólido ou em gradiente (sem imagem de fundo). Com imagem de fundo ativa, o brilho animado fica desligado para não mover a foto — podes usar gradiente por cima da imagem para leitura."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
