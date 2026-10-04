"use client";

import { useEffect, useState } from "react";
import { SlaConfig } from "@/types";
import { subscribeToSlaConfig } from "@/lib/locations";
import { DEFAULT_SLA_CONFIG } from "@/lib/intelligence/sla";

// One shared, reference-counted listener for config/sla, however many
// components on the page ask for it.
let current: SlaConfig = DEFAULT_SLA_CONFIG;
let unsubscribe: (() => void) | null = null;
const subscribers = new Set<(config: SlaConfig) => void>();

/** Live SLA targets (the defaults until an admin saves their own). */
export function useSlaConfig(): SlaConfig {
  const [config, setConfig] = useState(current);

  useEffect(() => {
    subscribers.add(setConfig);
    if (!unsubscribe) {
      unsubscribe = subscribeToSlaConfig((next) => {
        current = next;
        subscribers.forEach((notify) => notify(next));
      });
    }
    setConfig(current);
    return () => {
      subscribers.delete(setConfig);
      if (subscribers.size === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  }, []);

  return config;
}
