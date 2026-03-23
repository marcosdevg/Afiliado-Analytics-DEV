"use client";

import MetaAdsClient from "./MetaAdsClient";
import ProFeatureGate from "../ProFeatureGate";

export default function MetaAdsPage() {
  return (
    <ProFeatureGate feature="criarCampanhaMeta">
      <MetaAdsClient />
    </ProFeatureGate>
  );
}
