"use client";

import ATIClient from "./ATIClient";
import ProFeatureGate from "../ProFeatureGate";

export default function ATIPage() {
  return (
    <ProFeatureGate feature="ati">
      <ATIClient />
    </ProFeatureGate>
  );
}
