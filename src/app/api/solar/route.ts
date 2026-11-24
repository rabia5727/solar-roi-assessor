import { NextRequest, NextResponse } from "next/server";
import type { SolarData } from "@/lib/types";

const KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const PARAMS = ["ALLSKY_SFC_SW_DWN", "T2M", "T2M_MAX"];

// NASA POWER solar data is on a ~1° grid, so rounding to 0.1° loses nothing and improves caching.
const round = (v: number) => Math.round(v * 10) / 10;

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const url =
    "https://power.larc.nasa.gov/api/temporal/climatology/point" +
    `?parameters=${PARAMS.join(",")}&community=RE&latitude=${round(lat)}&longitude=${round(lon)}&format=JSON`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) throw new Error(`NASA POWER responded ${res.status}`);
    const json = await res.json();
    const p = json?.properties?.parameter;
    if (!p) throw new Error("Unexpected NASA POWER response");

    const series = (name: string) =>
      KEYS.map((k) => {
        const v = Number(p[name]?.[k]);
        if (!Number.isFinite(v) || v <= -998) throw new Error(`Missing ${name} for ${k}`);
        return v;
      });

    const start = json?.header?.start;
    const end = json?.header?.end;
    const data: SolarData = {
      lat,
      lon,
      ghi: series("ALLSKY_SFC_SW_DWN"),
      t2m: series("T2M"),
      t2mMax: series("T2M_MAX"),
      period: start && end ? `${String(start).slice(0, 4)}–${String(end).slice(0, 4)} average` : "long-term average",
      source: "NASA POWER (power.larc.nasa.gov), Renewable Energy community",
    };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load NASA solar data: ${(e as Error).message}. Please try again.` },
      { status: 502 },
    );
  }
}
