import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import path from "path";
import fs from "fs";

export interface ThreeMFMetadata {
  printTimeMinutes: number | null;
  filamentUsageGrams: number | null;
  filamentType: string | null;
  slicer: string | null;
  /** Thumbnail image buffer extracted from .3mf (PNG) */
  thumbnail: Buffer | null;
  /** Multiple plates in BambuStudio — aggregate totals */
  plates: PlateInfo[];
}

interface PlateInfo {
  index: number;
  printTimeMinutes: number;
  filamentUsageGrams: number;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

/**
 * Parse a .3mf file and extract slicer metadata (print time, filament usage).
 * Supports: PrusaSlicer, BambuStudio, OrcaSlicer, Cura.
 */
export function parseThreeMF(filePath: string): ThreeMFMetadata {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  const result: ThreeMFMetadata = {
    printTimeMinutes: null,
    filamentUsageGrams: null,
    filamentType: null,
    slicer: null,
    thumbnail: null,
    plates: [],
  };

  // Build a map of entry names for quick lookup
  const entryMap = new Map<string, AdmZip.IZipEntry>();
  for (const entry of entries) {
    entryMap.set(entry.entryName, entry);
  }

  // Extract thumbnail — try common paths across slicers
  const thumbnailPaths = [
    "Metadata/plate_1.png",         // BambuStudio
    "Metadata/plate_no_light_1.png", // BambuStudio (no-light variant)
    "Metadata/thumbnail.png",        // PrusaSlicer
    "thumbnail/thumbnail.png",       // Generic
    "Metadata/top_1.png",            // BambuStudio top view
  ];
  for (const tp of thumbnailPaths) {
    const entry = entryMap.get(tp);
    if (entry) {
      result.thumbnail = entry.getData();
      break;
    }
  }

  // Try each parser in order of popularity
  if (tryPrusaSlicer(entryMap, result)) return result;
  if (tryBambuStudio(entryMap, result)) return result;
  if (tryCura(entryMap, result)) return result;

  // Fallback: scan all entries for any recognizable config
  tryGenericConfig(entries, result);

  return result;
}

// ─── PrusaSlicer / OrcaSlicer ──────────────────────────────────────────────

function tryPrusaSlicer(
  entryMap: Map<string, AdmZip.IZipEntry>,
  result: ThreeMFMetadata
): boolean {
  const configEntry =
    entryMap.get("Metadata/Slic3r_PE.config") ||
    entryMap.get("Metadata/slic3r_pe.config");

  if (!configEntry) return false;

  const text = configEntry.getData().toString("utf-8");
  result.slicer = "PrusaSlicer";

  // Detect OrcaSlicer
  if (text.includes("OrcaSlicer") || entryMap.has("Metadata/orca_slicer.config")) {
    result.slicer = "OrcaSlicer";
  }

  // estimated printing time (normal mode) = 1h 23m 45s
  const timeMatch = text.match(
    /estimated printing time[^=]*=\s*(.+)/i
  );
  if (timeMatch) {
    result.printTimeMinutes = parseTimeString(timeMatch[1].trim());
  }

  // filament used [g] = 12.34
  const gramsMatch = text.match(/filament used \[g\]\s*=\s*([\d.]+)/i);
  if (gramsMatch) {
    result.filamentUsageGrams = parseFloat(gramsMatch[1]);
  }

  // If no grams, try mm and convert (rough: 1m PLA ≈ 3g)
  if (result.filamentUsageGrams == null) {
    const mmMatch = text.match(/filament used \[mm\]\s*=\s*([\d.]+)/i);
    if (mmMatch) {
      const mm = parseFloat(mmMatch[1]);
      result.filamentUsageGrams = Math.round((mm / 1000) * 3 * 100) / 100;
    }
  }

  // filament_type = PLA
  const typeMatch = text.match(/filament_type\s*=\s*(\S+)/i);
  if (typeMatch) {
    result.filamentType = typeMatch[1];
  }

  return true;
}

// ─── BambuStudio ───────────────────────────────────────────────────────────

function tryBambuStudio(
  entryMap: Map<string, AdmZip.IZipEntry>,
  result: ThreeMFMetadata
): boolean {
  const sliceInfo = entryMap.get("Metadata/slice_info.config");
  if (!sliceInfo) return false;

  result.slicer = "BambuStudio";

  const xml = sliceInfo.getData().toString("utf-8");
  const parsed = xmlParser.parse(xml);

  // slice_info > plate (array or single)
  const plates = parsed?.config?.plate
    ? Array.isArray(parsed.config.plate)
      ? parsed.config.plate
      : [parsed.config.plate]
    : [];

  let totalTime = 0;
  let totalWeight = 0;

  for (let i = 0; i < plates.length; i++) {
    const plate = plates[i];

    // BambuStudio stores plate-level data in two formats:
    // 1. Attributes on <plate>: <plate prediction="10327" weight="85.08">
    // 2. Child <metadata> elements: <metadata key="prediction" value="10327"/>
    // We need to handle both.
    let prediction = parseFloat(plate["@_prediction"] || plate.prediction || "0");
    let weight = parseFloat(plate["@_weight"] || plate.weight || "0");

    // Extract from <metadata key="..." value="..."/> children
    if (prediction === 0 || weight === 0) {
      const metadataArr = plate.metadata
        ? Array.isArray(plate.metadata)
          ? plate.metadata
          : [plate.metadata]
        : [];
      for (const m of metadataArr) {
        const key = m["@_key"];
        const val = m["@_value"];
        if (key === "prediction" && prediction === 0) prediction = parseFloat(val || "0");
        if (key === "weight" && weight === 0) weight = parseFloat(val || "0");
      }
    }

    // Also sum filament used_g from <filament> children (more accurate for multi-filament)
    if (plate.filament) {
      const filaments = Array.isArray(plate.filament) ? plate.filament : [plate.filament];
      const filamentWeight = filaments.reduce(
        (sum: number, f: any) => sum + parseFloat(f["@_used_g"] || "0"),
        0
      );
      if (filamentWeight > 0) weight = filamentWeight;
    }

    const plateMinutes = prediction / 60;
    totalTime += plateMinutes;
    totalWeight += weight;

    result.plates.push({
      index: i + 1,
      printTimeMinutes: Math.round(plateMinutes * 100) / 100,
      filamentUsageGrams: Math.round(weight * 100) / 100,
    });
  }

  if (totalTime > 0) result.printTimeMinutes = Math.round(totalTime * 100) / 100;
  if (totalWeight > 0) result.filamentUsageGrams = Math.round(totalWeight * 100) / 100;

  // Try to get filament type from project settings
  const projectSettings = entryMap.get("Metadata/project_settings.config");
  if (projectSettings) {
    const psText = projectSettings.getData().toString("utf-8");
    const typeMatch = psText.match(/filament_type\s*=\s*(\S+)/i);
    if (typeMatch) result.filamentType = typeMatch[1];
  }

  return totalTime > 0 || totalWeight > 0;
}

// ─── Cura ──────────────────────────────────────────────────────────────────

function tryCura(
  entryMap: Map<string, AdmZip.IZipEntry>,
  result: ThreeMFMetadata
): boolean {
  // Cura stores metadata in Metadata/cura.json or in the model XML
  const curaGlobal =
    entryMap.get("Metadata/cura_global.cfg") ||
    entryMap.get("Metadata/cura.json");

  if (!curaGlobal) return false;

  result.slicer = "Cura";

  const text = curaGlobal.getData().toString("utf-8");

  // Try JSON format first
  try {
    const json = JSON.parse(text);
    if (json.print_time) {
      result.printTimeMinutes = json.print_time / 60; // seconds to minutes
    }
    if (json.material_weight || json.filament_weight) {
      result.filamentUsageGrams = json.material_weight || json.filament_weight;
    }
    return true;
  } catch {
    // Not JSON, try key-value
  }

  // Key-value config
  const timeMatch = text.match(/print_time\s*=\s*([\d.]+)/i);
  if (timeMatch) {
    result.printTimeMinutes = parseFloat(timeMatch[1]) / 60;
  }

  const weightMatch = text.match(/(?:material_weight|filament_weight)\s*=\s*([\d.]+)/i);
  if (weightMatch) {
    result.filamentUsageGrams = parseFloat(weightMatch[1]);
  }

  return result.printTimeMinutes != null || result.filamentUsageGrams != null;
}

// ─── Generic fallback ──────────────────────────────────────────────────────

function tryGenericConfig(
  entries: AdmZip.IZipEntry[],
  result: ThreeMFMetadata
): void {
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.toLowerCase();
    if (!name.includes("metadata") && !name.endsWith(".config") && !name.endsWith(".json")) {
      continue;
    }

    try {
      const text = entry.getData().toString("utf-8");

      if (!result.printTimeMinutes) {
        const timeMatch = text.match(
          /(?:estimated[_ ]?printing[_ ]?time|print[_ ]?time)[^=:]*[=:]\s*(.+)/i
        );
        if (timeMatch) {
          const parsed = parseTimeString(timeMatch[1].trim());
          if (parsed > 0) result.printTimeMinutes = parsed;
        }
      }

      if (!result.filamentUsageGrams) {
        const gramsMatch = text.match(
          /(?:filament[_ ]?used[_ ]?\[?g\]?|filament[_ ]?weight|material[_ ]?weight)[^=:]*[=:]\s*([\d.]+)/i
        );
        if (gramsMatch) {
          result.filamentUsageGrams = parseFloat(gramsMatch[1]);
        }
      }
    } catch {
      // Skip unreadable entries
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Parse time strings like "1h 23m 45s", "1d 2h 30m", "83m", "5040s", etc.
 */
function parseTimeString(str: string): number {
  let totalMinutes = 0;

  const dayMatch = str.match(/([\d.]+)\s*d/i);
  const hourMatch = str.match(/([\d.]+)\s*h/i);
  const minMatch = str.match(/([\d.]+)\s*m(?!s)/i);
  const secMatch = str.match(/([\d.]+)\s*s/i);

  if (dayMatch) totalMinutes += parseFloat(dayMatch[1]) * 1440;
  if (hourMatch) totalMinutes += parseFloat(hourMatch[1]) * 60;
  if (minMatch) totalMinutes += parseFloat(minMatch[1]);
  if (secMatch) totalMinutes += parseFloat(secMatch[1]) / 60;

  // If no units matched, try parsing as raw seconds
  if (!dayMatch && !hourMatch && !minMatch && !secMatch) {
    const raw = parseFloat(str);
    if (!isNaN(raw)) totalMinutes = raw / 60;
  }

  return Math.round(totalMinutes * 100) / 100;
}
