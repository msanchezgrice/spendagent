import type { NormalizedUsage } from "../types.js";
import { round2 } from "../pricing/estimateCost.js";

export interface HardwareProfile {
  name: string;
  purchase_price_usd: number;
  amortization_months: number;
  electricity_cost_usd_per_kwh: number;
  average_power_watts: number;
  active_hours_per_day: number;
  ops_cost_usd_per_month: number;
  supported_workloads?: string[];
  quality_risk?: "low" | "medium" | "high";
}

export const EXAMPLE_HARDWARE_PROFILE: HardwareProfile = {
  name: "local-machine-placeholder",
  purchase_price_usd: 1200,
  amortization_months: 24,
  electricity_cost_usd_per_kwh: 0.15,
  average_power_watts: 80,
  active_hours_per_day: 8,
  ops_cost_usd_per_month: 50,
  supported_workloads: [
    "classification",
    "summarization",
    "extraction",
    "embeddings",
  ],
  quality_risk: "medium",
};

export interface HardwareBreakEven {
  monthly_api_cost_usd: number;
  monthly_hardware_cost_usd: number;
  monthly_electricity_cost_usd: number;
  monthly_amortized_cost_usd: number;
  monthly_ops_cost_usd: number;
  break_even: "yes" | "no" | "maybe";
  notes: string;
}

export function hardwareBreakEven(
  profile: HardwareProfile,
  monthlyApiCost: number,
): HardwareBreakEven {
  const amortized = profile.purchase_price_usd / profile.amortization_months;
  const electricity =
    (profile.average_power_watts / 1000) *
    profile.active_hours_per_day *
    30 *
    profile.electricity_cost_usd_per_kwh;
  const ops = profile.ops_cost_usd_per_month;
  const hardware = amortized + electricity + ops;

  let breakEven: HardwareBreakEven["break_even"] = "no";
  if (monthlyApiCost > hardware * 2) breakEven = "yes";
  else if (monthlyApiCost > hardware) breakEven = "maybe";

  return {
    monthly_api_cost_usd: round2(monthlyApiCost),
    monthly_hardware_cost_usd: round2(hardware),
    monthly_amortized_cost_usd: round2(amortized),
    monthly_electricity_cost_usd: round2(electricity),
    monthly_ops_cost_usd: round2(ops),
    break_even: breakEven,
    notes:
      "Hardware break-even is directional only. It does not prove quality, latency, or ops feasibility. Run an eval before moving production traffic.",
  };
}
