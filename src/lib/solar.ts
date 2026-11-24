// Solar geometry helpers. Converts NASA's horizontal irradiance into what a
// tilted, south-facing panel actually receives (isotropic-sky / Liu–Jordan model).

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// Klein's recommended "average day" for each month
const MID_DAY = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];

const D2R = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Extraterrestrial daily irradiation on a horizontal surface, kWh/m²/day */
function extraterrestrial(latDeg: number, n: number) {
  const phi = latDeg * D2R;
  const delta = 23.45 * D2R * Math.sin((2 * Math.PI * (284 + n)) / 365);
  const ws = Math.acos(clamp(-Math.tan(phi) * Math.tan(delta), -1, 1));
  const e0 = 1 + 0.033 * Math.cos((2 * Math.PI * n) / 365);
  const h0 =
    ((24 * 3600 * 1367) / Math.PI) *
    e0 *
    (Math.cos(phi) * Math.cos(delta) * Math.sin(ws) + ws * Math.sin(phi) * Math.sin(delta));
  return { h0: h0 / 3.6e6, delta, ws };
}

/**
 * Monthly-average daily irradiation on a south-facing surface tilted `tiltDeg`,
 * from monthly-average horizontal irradiation `ghi` (kWh/m²/day).
 */
export function tiltedIrradiance(ghi: number, monthIdx: number, latDeg: number, tiltDeg: number, albedo = 0.2) {
  if (ghi <= 0) return 0;
  const n = MID_DAY[monthIdx];
  const { h0, delta, ws } = extraterrestrial(latDeg, n);
  const kt = clamp(ghi / h0, 0.1, 0.8);
  // Liu–Jordan monthly diffuse fraction
  const fd = clamp(1.39 - 4.027 * kt + 5.531 * kt ** 2 - 3.108 * kt ** 3, 0.1, 0.9);
  const phi = latDeg * D2R;
  const beta = tiltDeg * D2R;
  const phiB = phi - beta;
  const wsTilt = Math.min(ws, Math.acos(clamp(-Math.tan(phiB) * Math.tan(delta), -1, 1)));
  const rb =
    (Math.cos(phiB) * Math.cos(delta) * Math.sin(wsTilt) + wsTilt * Math.sin(phiB) * Math.sin(delta)) /
    (Math.cos(phi) * Math.cos(delta) * Math.sin(ws) + ws * Math.sin(phi) * Math.sin(delta));
  const beam = (1 - fd) * rb;
  const diffuse = (fd * (1 + Math.cos(beta))) / 2;
  const ground = (albedo * (1 - Math.cos(beta))) / 2;
  return ghi * (beam + diffuse + ground);
}

/** Good default tilt for year-round yield in Pakistan's latitudes */
export function optimalTilt(latDeg: number) {
  return Math.round(Math.abs(latDeg) * 0.87 + 1);
}

/** Sun elevation at solar noon on Dec 21 — worst case for row shading */
export function winterNoonElevation(latDeg: number) {
  return 90 - Math.abs(latDeg) - 23.45;
}
