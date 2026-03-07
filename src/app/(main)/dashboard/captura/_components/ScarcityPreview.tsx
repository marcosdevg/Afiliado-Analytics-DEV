"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMMSS } from "../_lib/captureUtils";

export default function ScarcityPreview() {
  const initialSeconds = 180; // 03:00
  const initialSpots = 23;
  const minSpots = 15;
  const decayEverySeconds = 10;
  const initialFillPercent = 80;

  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [spots, setSpots] = useState(initialSpots);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
    setSpots(initialSpots);

    const tickId = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    const decayId = window.setInterval(() => {
      setSpots((v) => (v > minSpots ? v - 1 : v));
    }, decayEverySeconds * 1000);

    return () => {
      window.clearInterval(tickId);
      window.clearInterval(decayId);
    };
  }, []);

  const fillPercent = useMemo(() => {
    const p = (spots / initialSpots) * initialFillPercent;
    return Math.max(0, Math.min(100, p));
  }, [spots]);

  return (
    <div className="mt-6 sm:mt-7">
      <div className="rounded-2xl p-[1px] bg-gradient-to-br from-orange-200/60 via-pink-200/40 to-indigo-200/40">
        <div className="rounded-2xl px-4 sm:px-5 py-4 sm:py-5 bg-gradient-to-br from-orange-50 via-white to-pink-50">
          <div className="text-center text-[14px] sm:text-[15px] font-extrabold tracking-wide text-neutral-900">
            Vagas Limitadas
          </div>

          <div className="mt-2 flex items-center justify-center">
            {secondsLeft > 0 ? (
              <div className="px-4 py-2 rounded-xl font-extrabold text-[22px] sm:text-[24px] bg-white/90 border border-black/5 shadow-sm text-neutral-900">
                {formatMMSS(secondsLeft)}
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl font-extrabold text-[16px] sm:text-[18px] text-red-600 bg-white/80 border border-black/5">
                ENCERRANDO...
              </div>
            )}
          </div>

          <div className="mt-3">
            <div className="relative h-9 rounded-xl overflow-hidden bg-white/80 border border-black/5 shadow-sm">
              <div
                className="h-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${fillPercent}%`,
                  background:
                    "linear-gradient(90deg, rgba(251,191,36,0.95), rgba(244,63,94,0.90))",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[13px] sm:text-[14px] font-extrabold text-neutral-900">
                  Vagas: {spots}
                </span>
              </div>
            </div>

            <div className="mt-2 text-center text-[12px] text-neutral-600">
              Garanta sua entrada antes do tempo acabar.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
