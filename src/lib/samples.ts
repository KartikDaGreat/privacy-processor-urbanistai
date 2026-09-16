import { assetUrl } from "./assets";

/**
 * Starter photos, so the tool can be tried without hunting for an image.
 *
 * All three are freely licensed and self-hosted in public/samples. They were
 * chosen by running the shipped detectors over a pool of candidates: one where
 * every model agrees, one where they disagree sharply, and one of candid
 * profiles rather than posed portraits. Full attribution lives in
 * public/samples/CREDITS.md and is also surfaced in the UI, as CC BY requires.
 */
export interface SampleCredit {
  author: string;
  licence: string;
  /** Wikimedia Commons file page. */
  source: string;
}

export interface SampleImage {
  id: string;
  /** Full-size image, fetched only when the sample is chosen. */
  file: string;
  /** Small preview shown in the picker. */
  thumb: string;
  label: string;
  note: string;
  credit: SampleCredit;
}

export const SAMPLES: SampleImage[] = [
  {
    id: "group-of-five",
    file: assetUrl("samples/group-of-five.jpg"),
    thumb: assetUrl("samples/group-of-five-thumb.jpg"),
    label: "Five people",
    note: "Clear frontal faces — every detector should agree",
    credit: {
      author: "Dev Jadiya",
      licence: "CC BY 4.0",
      source:
        "https://commons.wikimedia.org/wiki/File:Participants_at_Indic_Wikimedia_Hackathon_Bhubaneswar_2024_5.jpg",
    },
  },
  {
    id: "large-group",
    file: assetUrl("samples/large-group.jpg"),
    thumb: assetUrl("samples/large-group-thumb.jpg"),
    label: "Large group",
    note: "Dozens of small faces — detectors disagree sharply",
    credit: {
      author: "Jnanaranjan sahu",
      licence: "CC BY 4.0",
      source:
        "https://commons.wikimedia.org/wiki/File:Indic_Wikimedia_Hackathon_Hyderabad_2026_Group_Photo.jpg",
    },
  },
  {
    id: "family-at-table",
    file: assetUrl("samples/family-at-table.jpg"),
    thumb: assetUrl("samples/family-at-table-thumb.jpg"),
    label: "Around a table",
    note: "Profiles and three-quarter views, not posed portraits",
    credit: {
      author: "National Cancer Institute",
      licence: "public domain",
      source: "https://commons.wikimedia.org/wiki/File:Family_eating_meal.jpg",
    },
  },
];

/**
 * Fetch a sample and hand it back as a File, so it travels the same path as a
 * photo the person chose themselves — including the metadata strip.
 */
export async function loadSample(sample: SampleImage): Promise<File> {
  const response = await fetch(sample.file);
  if (!response.ok) {
    throw new Error(
      `Could not load the sample photo (HTTP ${response.status}). It should be at public/samples/.`,
    );
  }
  const blob = await response.blob();
  return new File([blob], `${sample.id}.jpg`, {
    type: blob.type || "image/jpeg",
  });
}
