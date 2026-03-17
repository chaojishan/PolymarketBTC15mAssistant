import { clamp } from "../utils.js";

export function computeEdge({ modelUp, modelDown, marketYes, marketNo }) {
  if (marketYes === null || marketNo === null) {
    return { marketUp: null, marketDown: null, edgeUp: null, edgeDown: null };
  }

  const sum = marketYes + marketNo;
  const marketUp = sum > 0 ? marketYes / sum : null;
  const marketDown = sum > 0 ? marketNo / sum : null;

  const edgeUp = marketUp === null ? null : modelUp - marketUp;
  const edgeDown = marketDown === null ? null : modelDown - marketDown;

  return {
    marketUp: marketUp === null ? null : clamp(marketUp, 0, 1),
    marketDown: marketDown === null ? null : clamp(marketDown, 0, 1),
    edgeUp,
    edgeDown
  };
}

export function decide({ remainingMinutes, edgeUp, edgeDown, modelUp = null, modelDown = null }) {
  const phase = remainingMinutes > 3 ? "EARLY" : remainingMinutes > 2 ? "MID" : "LATE";

  const threshold = phase === "EARLY" ? 0.05 : phase === "MID" ? 0.1 : 0.2;

  const minProb = phase === "EARLY" ? 0.55 : phase === "MID" ? 0.6 : 0.65;

  if (edgeUp === null || edgeDown === null) {
    return { action: "NO_TRADE", side: null, phase, reason: "missing_market_data" };
  }

  // 修复：只有当边缘为正且大于阈值时才考虑该方向
  // 如果两个方向的边缘都小于阈值，则不交易
  const upValid = edgeUp >= threshold;
  const downValid = edgeDown >= threshold;

  if (!upValid && !downValid) {
    return { action: "NO_TRADE", side: null, phase, reason: `both_edges_below_${threshold}` };
  }

  // 如果只有一个方向有效，选择那个方向
  if (upValid && !downValid) {
    if (modelUp !== null && modelUp < minProb) {
      return { action: "NO_TRADE", side: null, phase, reason: `prob_below_${minProb}` };
    }
    const strength = edgeUp >= 0.2 ? "STRONG" : edgeUp >= 0.1 ? "GOOD" : "OPTIONAL";
    return { action: "ENTER", side: "UP", phase, strength, edge: edgeUp };
  }

  if (downValid && !upValid) {
    if (modelDown !== null && modelDown < minProb) {
      return { action: "NO_TRADE", side: null, phase, reason: `prob_below_${minProb}` };
    }
    const strength = edgeDown >= 0.2 ? "STRONG" : edgeDown >= 0.1 ? "GOOD" : "OPTIONAL";
    return { action: "ENTER", side: "DOWN", phase, strength, edge: edgeDown };
  }

  // 如果两个方向都有效，选择边缘更大的
  const bestSide = edgeUp > edgeDown ? "UP" : "DOWN";
  const bestEdge = bestSide === "UP" ? edgeUp : edgeDown;
  const bestModel = bestSide === "UP" ? modelUp : modelDown;

  if (bestModel !== null && bestModel < minProb) {
    return { action: "NO_TRADE", side: null, phase, reason: `prob_below_${minProb}` };
  }

  const strength = bestEdge >= 0.2 ? "STRONG" : bestEdge >= 0.1 ? "GOOD" : "OPTIONAL";
  return { action: "ENTER", side: bestSide, phase, strength, edge: bestEdge };
}
