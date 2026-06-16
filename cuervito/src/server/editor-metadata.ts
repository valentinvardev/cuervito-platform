import "server-only";

import exifr from "exifr";

import type { ProjectMetadata } from "~/lib/editor-types";

type ExifShape = {
  DateTimeOriginal?: Date | string;
  CreateDate?: Date | string;
  ModifyDate?: Date | string;
  Make?: string;
  Model?: string;
  LensModel?: string;
  LensMake?: string;
  Lens?: string;
  ExposureTime?: number;
  FNumber?: number;
  ApertureValue?: number;
  ISO?: number;
  ISOSpeedRatings?: number;
  FocalLength?: number;
  FocalLengthIn35mmFormat?: number;
};

/**
 * Extract EXIF metadata from a photo buffer. Returns whatever fields are
 * present — a photo without GPS, without EXIF date, etc. all just leave the
 * corresponding fields undefined.
 *
 * Important: we make TWO calls to exifr because GPS coordinates and regular
 * EXIF tags live in different segments of the metadata, and exifr's `pick`
 * filter doesn't include the computed `latitude`/`longitude` fields. So we
 * parse the regular EXIF (with pick for efficiency) AND call exifr.gps()
 * separately for coordinates.
 */
export async function extractExif(buffer: Buffer): Promise<ProjectMetadata> {
  const out: ProjectMetadata = {};
  try {
    const [exif, gps] = await Promise.all([
      // Regular EXIF tags. exifr.parse() with default config covers TIFF /
      // IFD0 / EXIF segments which is what we need for date / camera / lens
      // / exposure / ISO / focal length.
      exifr.parse(buffer).catch((err: unknown) => {
        console.error("[editor metadata] exifr.parse failed:", err);
        return null;
      }),
      // GPS coordinates — exifr.gps() is the explicit helper for lat/lon and
      // is more reliable than asking parse() for `latitude`/`longitude`.
      exifr.gps(buffer).catch((err: unknown) => {
        console.error("[editor metadata] exifr.gps failed:", err);
        return null;
      }),
    ]);

    console.log("[editor metadata] raw exif keys:", exif ? Object.keys(exif) : null);
    console.log("[editor metadata] gps:", gps);

    if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
      out.lat = gps.latitude;
      out.lon = gps.longitude;
    }

    if (!exif) return out;
    const e = exif as ExifShape;

    // EXIF date — fall back through possible fields.
    const rawDate = e.DateTimeOriginal ?? e.CreateDate ?? e.ModifyDate;
    if (rawDate) {
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (!isNaN(d.getTime())) out.takenAt = d.toISOString();
    }

    const camera = [e.Make, e.Model]
      .filter(Boolean)
      .map((s) => (s ?? "").trim())
      .join(" ")
      .trim();
    if (camera) out.camera = camera;

    // Lens — prefer LensModel; fall back to "LensMake LensModel" or Lens.
    const lens = (e.LensModel ?? e.Lens ?? "").trim();
    if (lens) {
      out.lens =
        e.LensMake && !lens.toLowerCase().includes(e.LensMake.toLowerCase())
          ? `${e.LensMake.trim()} ${lens}`
          : lens;
    }

    // Exposure time — print as "1/200" if fractional, else "0.5 s".
    if (typeof e.ExposureTime === "number" && e.ExposureTime > 0) {
      if (e.ExposureTime < 1) {
        out.exposureTime = `1/${Math.round(1 / e.ExposureTime)}`;
      } else {
        out.exposureTime = `${e.ExposureTime} s`;
      }
    }

    // Aperture — "f/2.8".
    const fNumber = e.FNumber ?? e.ApertureValue;
    if (typeof fNumber === "number" && fNumber > 0) {
      out.aperture = `f/${fNumber.toFixed(1).replace(/\.0$/, "")}`;
    }

    const iso = e.ISO ?? e.ISOSpeedRatings;
    if (typeof iso === "number" && iso > 0) out.iso = Math.round(iso);

    // Focal length — "85mm".
    const focal = e.FocalLength ?? e.FocalLengthIn35mmFormat;
    if (typeof focal === "number" && focal > 0) {
      out.focalLength = `${Math.round(focal)}mm`;
    }
  } catch (err) {
    console.error("[editor metadata] EXIF extraction failed:", err);
  }
  console.log("[editor metadata] extracted:", out);
  return out;
}

type NominatimResponse = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    municipality?: string;
    state?: string;
    region?: string;
    country?: string;
  };
};

/**
 * Reverse-geocode lat/lon via OpenStreetMap Nominatim (free, no API key).
 * Best-effort — failures are silently swallowed so a missing geocode never
 * blocks the upload. Rate-limited to ~1 req/sec by Nominatim's policy, but
 * uploads are rare enough that we don't bother batching.
 */
export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<Pick<ProjectMetadata, "city" | "region" | "country">> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("accept-language", "es");
    url.searchParams.set("zoom", "12");
    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim policy: identify yourself.
        "User-Agent": "Cuervito Admin Editor (https://cuervito.app)",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[editor metadata] Nominatim non-OK:", res.status);
      return {};
    }
    const data = (await res.json()) as NominatimResponse;
    const a = data.address ?? {};
    const city =
      a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.county;
    const region = a.state ?? a.region;
    console.log("[editor metadata] geocoded:", { city, region, country: a.country });
    return {
      ...(city ? { city } : {}),
      ...(region ? { region } : {}),
      ...(a.country ? { country: a.country } : {}),
    };
  } catch (err) {
    console.error("[editor metadata] reverse geocode failed:", err);
    return {};
  }
}

/** Convenience: EXIF + reverse geocode in one go. */
export async function extractMetadata(buffer: Buffer): Promise<ProjectMetadata> {
  const exif = await extractExif(buffer);
  if (exif.lat !== undefined && exif.lon !== undefined) {
    const geo = await reverseGeocode(exif.lat, exif.lon);
    return { ...exif, ...geo };
  }
  return exif;
}
