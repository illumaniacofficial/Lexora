import crypto from "crypto";
import { storage } from "../storage";
import type { Project, StudioProperty } from "@shared/schema";
import type { CreativeTargetContract, PropertyClassification, PropertyType } from "./property";

function inferFormat(vertical: string): PropertyType {
  switch (vertical) {
    case "children": return "children";
    case "biography": return "biography";
    case "memoir": return "memoir";
    case "history": return "history";
    case "fashion": return "fashion";
    case "music": return "music";
    case "cooking": return "cookbook";
    case "photography": return "photography";
    case "poetry": return "poetry";
    case "education": return "educational";
    case "novel":
    case "sci-fi":
    case "fantasy":
    case "horror":
    case "romance":
    case "thriller":
    case "mystery":
    case "literary-fiction":
    case "dystopian":
    case "erotica":
    case "comedy":
    case "adventure":
    case "young-adult":
    case "drama":
    case "western":
      return "fiction";
    default:
      return "nonfiction";
  }
}

function legacyClassification(project: Project): PropertyClassification {
  return {
    format: inferFormat(project.vertical),
    primaryGenre: {
      id: project.vertical,
      label: project.vertical,
      weight: 1,
    },
    additionalGenres: [],
    subgenres: [],
    topics: [],
    themes: [],
    audiences: [],
    ageBands: [],
    tones: [],
    craftProfiles: [{
      id: project.vertical,
      label: project.vertical,
      weight: 1,
    }],
    maturityTags: [],
    marketPositions: [],
    seriesIntent: project.seriesId ? "planned-series" : "standalone",
    language: project.targetLanguage,
  };
}

function legacyTargetContract(project: Project): CreativeTargetContract {
  return {
    targetReader: project.description
      ? `Reader implied by the manuscript brief: ${project.description.slice(0, 500)}`
      : "Reader to be refined by Scribe and Oracle.",
    desiredFeelings: [],
    desiredKnowledgeOrTransformation: [],
    tone: [],
    structureExpectations: [],
    researchStandard: "standard",
    maturityBoundaries: [],
    pacingExpectations: [],
    usabilityRequirements: [],
    emotionalPromise: null,
    desiredAftereffect: [],
    conventionsToHonor: [],
    conventionsToChallenge: [],
    qualityCriteria: [
      {
        id: "reader-promise",
        label: "Reader promise",
        description: "The manuscript should fulfill the promise made to its intended reader.",
        importance: "critical",
      },
      {
        id: "coherence",
        label: "Coherence",
        description: "The work should remain internally consistent and purposeful.",
        importance: "critical",
      },
    ],
  };
}

/**
 * Wrap a legacy Project in the new Property model without mutating the Project.
 * This is the bridge that lets the original repo remain the backbone.
 */
export async function ensurePropertyForProject(projectId: number): Promise<StudioProperty> {
  const existing = await storage.getStudioPropertyByProject(projectId);
  if (existing) return existing;

  const project = await storage.getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const classification = legacyClassification(project);
  const targetContract = legacyTargetContract(project);
  const id = crypto.randomUUID();

  return storage.createStudioPropertyWithProjectLink(
    {
      id,
      workingTitle: project.title,
      canonicalTitle: project.status === "complete" ? project.title : null,
      status: project.status === "complete" ? "published" : "in-production",
      format: classification.format,
      seriesIntent: classification.seriesIntent,
      legacyVertical: project.vertical,
      classification,
      targetContract,
    },
    {
      projectId,
      relation: "book",
      isPrimary: true,
    },
  );
}

export async function createPropertyForProject(project: Project): Promise<StudioProperty> {
  return ensurePropertyForProject(project.id);
}
