import React from "react";
import { Composition, registerRoot } from "remotion";
import { VideoComposition } from "./VideoComposition";
import type { VideoInputProps } from "./types";
import { SUBTITLE_THEMES } from "./types";
import { REMOTION_COMPOSITION_ID } from "./constants";

const defaultProps: VideoInputProps = {
  style: "showcase",
  media: [],
  voiceoverSrc: null,
  musicSrc: null,
  musicVolume: 0.15,
  captions: [],
  subtitleTheme: SUBTITLE_THEMES.tiktokBold,
  productName: "",
  showProductNameIntro: false,
  price: "",
  ctaText: "Link na bio",
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 300,
};

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={REMOTION_COMPOSITION_ID}
      component={VideoComposition}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.durationInFrames,
        fps: props.fps,
        width: props.width,
        height: props.height,
      })}
    />
  );
};

registerRoot(RemotionRoot);
