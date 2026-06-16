import "server-only";

import exifr from "exifr";

import type { ProjectMetadata } from "~/lib/editor-types";

/**
 * Extract EXIF metadata from a photo buffer. Returns whatever fields are
 * present — a photo without GPS, without EXIF date, etc. all just leave the
 * corresponding fields undefined.
 */
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
  latitude?: number;
  longitude?: number;
};

export async function extractExif(buffer: Buffer): Promise<ProjectMetadata> {
  const out: ProjectMetadata = {};
  try {
    const exif = (await exifr.parse(buffer, {
      gps: true,
      pick: [
        "DateTimeOriginal",
        "CreateDate",
        "ModifyDate",
        "Make",
        "Model",
        "LensModel",
        "LensMake",
        "Lens",
        "ExposureTime",
        "FNumber",
        "ApertureValue",
        "ISO",
        "ISOSpeedRatings",
        "FocalLength",
        "FocalLengthIn35mmFormat",
        "latitude",
        "longitude",
      ],
    }).catch(() => null)) as ExifShape | null;
    if (!exif) return out;

    // EXIF date — fall back through possible fields.
    const rawDate = exif.DateTimeOriginal ?? exif.CreateDate ?? exif.ModifyDate;
    if (rawDate) {
      const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
      if (!isNaN(d.getTime())) out.takenAt = d.toISOString();
    }

    if (typeof exif.latitude === "number" && typeof exif.longitude === "number") {
      out.lat = exif.latitude;
      out.lon = exif.longitude;
    }

    const camera = [exif.Make, exif.Model]
      .filter(Boolean)
      .map((s) => (s ?? "").trim())
      .join(" ")
      .trim();
    if (camera) out.camera = camera;

    // Lens — prefer LensModel; fall back to "LensMake LensModel" or Lens.
    const lens = (exif.LensModel ?? exif.Lens ?? "").trim();
    if (lens) {
      out.lens =
        exif.LensMake && !lens.toLowerCase().includes(exif.LensMake.toLowerCase())
          ? `${exif.LensMake.trim()} ${lens}`
          : lens;
    }

    // Exposure time — print as "1/200" if fractional, else "0.5 s".
    if (typeof exif.ExposureTime === "number" && exif.ExposureTime > 0) {
      if (exif.ExposureTime < 1) {
        out.exposureTime = `1/${Math.round(1 / exif.ExposureTime)}`;
      } else {
        out.exposureTime = `${exif.ExposureTime} s`;
      }
    }

    // Aperture — "f/2.8".
    const fNumber = exif.FNumber ?? exif.ApertureValue;
    if (typeof fNumber === "number" && fNumber > 0) {
      out.aperture = `f/${fNumber.toFixed(1).replace(/\.0$/, "")}`;
    }

    const iso = exif.ISO ?? exif.ISOSpeedRatings;
    if (typeof iso === "number" && iso > 0) out.iso = Math.round(iso);

    // Focal length — "85mm".
    const focal = exif.FocalLength ?? exif.FocalLengthIn35mmFormat;
    if (typeof focal === "number" && focal > 0) {
      out.focalLength = `${Math.round(focal)}mm`;
    }
  } catch (err) {
    console.error("[editor metadata] EXIF parse failed:", err);
  }
  return out;
}

type NominatimResponse = {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
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
      // Don't wait forever if Nominatim is slow.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as NominatimResponse;
    const a = data.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.county;
    const region = a.state ?? a.region;
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
