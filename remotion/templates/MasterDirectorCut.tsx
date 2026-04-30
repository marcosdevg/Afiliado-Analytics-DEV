import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, useVideoConfig } from "remotion";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
  type TransitionPresentation,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { flip } from "@remotion/transitions/flip";
import { wipe } from "@remotion/transitions/wipe";
import { iris } from "@remotion/transitions/iris";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import type { VideoInputProps, VideoStyleId } from "../types";
import { MediaScene, type MediaSceneEffect } from "../components/MediaScene";
import { AnimatedCaption } from "../components/AnimatedCaption";
import { CTASlide } from "../components/CTASlide";
import { PriceTag } from "../components/PriceTag";
import { ColorGradeOverlay, type ColorGradeVariant } from "../components/ColorGradeOverlay";
import { GlitchOverlay } from "../components/GlitchOverlay";
import { CinematicMatte } from "../components/CinematicMatte";
import { LensFlareLayer } from "../components/LensFlareLayer";
import { IntroTitleCard } from "../components/IntroTitleCard";
import { interleaveMedia } from "../utils";

function gradeFor(style: VideoStyleId): ColorGradeVariant {
  if (style === "filmArc") return "luxuryGold";
  return "cinematicDark";
}

function effectsFor(style: VideoStyleId): MediaSceneEffect[] {
  if (style === "filmArc") {
    return ["kenBurnsIn", "kenBurnsOut", "dollyIn", "parallaxFloat", "whiplash"];
  }
  return ["impactPunch", "whiplash", "shakeMicro", "kenBurnsIn", "impactPunch"];
}

/**
 * Template “máximo esforço” Remotion: TransitionSeries + springTiming (durationRestThreshold),
 * apresentações iris/clock/slide, camadas matte/flare/glitch, card de abertura com spring.
 * Ver: https://www.remotion.dev/docs/transitions/timings/springtiming
 */
export const MasterDirectorCut: React.FC<VideoInputProps> = (props) => {
  const {
    style,
    media: rawMedia,
    voiceoverSrc,
    musicSrc,
    musicVolume,
    captions,
    subtitleTheme,
    price,
    ctaText,
    productName,
    showProductNameIntro,
    durationInFrames,
  } = props;
  const { fps, width, height } = useVideoConfig();
  const media = interleaveMedia(rawMedia);
  const ctaDuration = Math.round(fps * 2.8);
  const showIntro = showProductNameIntro === true && productName.trim().length > 0;
  const introFrames = showIntro ? Math.min(Math.round(fps * 1.35), 48) : 0;
  const contentFrames = durationInFrames - ctaDuration;
  const scenesCount = media.length || 1;
  const framesPerScene = Math.max(fps, Math.floor(contentFrames / Math.max(scenesCount, 1)));
  const transitionFrames = Math.min(Math.round(fps * 0.42), Math.floor(framesPerScene / 4));

  const presentations = [
    fade(),
    slide({ direction: "from-bottom" }),
    flip({ direction: "from-left" }),
    wipe({ direction: "from-right" }),
    iris({ width, height }),
    clockWipe({ width, height }),
  ] as unknown as TransitionPresentation<Record<string, unknown>>[];

  const springT = (dur: number) =>
    springTiming({
      durationInFrames: dur,
      config: { damping: 15, stiffness: 110, mass: 0.55 },
      durationRestThreshold: 0.001,
    });

  const useSpringForIndex = (i: number) => i % 6 < 4;

  const effects = effectsFor(style);
  const grade = gradeFor(style);
  const isFilm = style === "filmArc";

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {introFrames > 0 && showIntro && (
        <Sequence from={0} durationInFrames={introFrames}>
          <IntroTitleCard title={productName.trim()} durationInFrames={introFrames} />
        </Sequence>
      )}

      <TransitionSeries>
        {media.map((asset, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={framesPerScene}>
              <MediaScene asset={asset} effect={effects[i % effects.length]} />
              {price && i === 0 && <PriceTag price={price} showAtFrame={Math.round(fps * 0.75)} />}
              <ColorGradeOverlay
                variant={grade}
                grainAmount={isFilm ? 0.1 : 0.16}
                vignetteAmount={isFilm ? 0.42 : 0.58}
              />
              {!isFilm && <GlitchOverlay intensity={0.55} />}
              {isFilm && <CinematicMatte />}
              <LensFlareLayer tone={isFilm ? "warm" : "cool"} intensity={isFilm ? 0.42 : 0.38} />
            </TransitionSeries.Sequence>
            {i < media.length - 1 && (
              <TransitionSeries.Transition
                presentation={presentations[i % presentations.length]}
                timing={
                  useSpringForIndex(i)
                    ? springT(transitionFrames)
                    : linearTiming({ durationInFrames: transitionFrames })
                }
              />
            )}
          </React.Fragment>
        ))}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springT(Math.round(fps * 0.38))}
        />
        <TransitionSeries.Sequence durationInFrames={ctaDuration}>
          <CTASlide text={ctaText || "Link na bio"} productName={productName} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {voiceoverSrc && <Audio src={voiceoverSrc} volume={1} />}
      {musicSrc && (
        <Audio
          src={musicSrc}
          volume={(f) => {
            const vol = musicVolume ?? 0.15;
            return interpolate(f, [durationInFrames - fps * 2, durationInFrames], [vol, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
          }}
          loop
        />
      )}
      {captions.length > 0 && <AnimatedCaption captions={captions} theme={subtitleTheme} />}
    </AbsoluteFill>
  );
};
