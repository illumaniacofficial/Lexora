import type { Chapter, Project, StudioProperty } from "@shared/schema";

function targetContract(property: StudioProperty): any {
  return (property.targetContract || {}) as any;
}

export function buildChapterDraftInstructions(opts: {
  project: Project;
  chapter: Chapter;
  property: StudioProperty;
}): string {
  const { project, chapter, property } = opts;
  const contract = targetContract(property);
  const reader = contract.targetReader || "the intended reader";
  const format = property.format || "custom";

  const base = `Write Chapter ${chapter.chapterNumber}: "${chapter.title}"

Blueprint:
${chapter.blueprint || "No detailed blueprint was supplied."}

Target reader:
${reader}

The chapter must honor the Property classification and Creative Target Contract already in your system context.
Write the actual chapter only. Do not include planning notes, explanations of your process, or self-evaluation.`;

  switch (format) {
    case "children":
      return `${base}

CHILDREN'S CRAFT:
- Use vocabulary, sentence length, emotional intensity, and concepts appropriate to the target age/reading level.
- Prioritize clarity, imagination, read-aloud rhythm, memorable images, and emotional safety.
- If the concept is spooky, scary, sad, or dark, calibrate it to the stated age and target contract rather than adult horror conventions.
- Avoid adult abstractions disguised as children's language.
- Let the story carry the lesson; do not lecture.
- Aim for the length appropriate to this specific children's format, even if that is much shorter than an adult chapter.`;

    case "cookbook":
      return `${base}

COOKBOOK / FOOD CRAFT:
- Prioritize usability, reliability, appetite appeal, and clear sequencing over dramatic prose.
- Give precise quantities, timings, temperatures, yields, equipment, substitutions, and storage notes when the blueprint calls for recipes.
- Never invent safety-critical food guidance or unsupported health claims.
- Explain why a technique matters when that helps the reader succeed.
- Keep instructions scannable and testable.`;

    case "biography":
    case "memoir":
    case "history":
    case "music":
    case "fashion":
    case "culture":
    case "documentary-source":
    case "narrative-journalism":
      return `${base}

EVIDENCE-AWARE NARRATIVE CRAFT:
- Make the chapter vivid and readable without inventing events, quotes, motives, dates, or private thoughts.
- Clearly distinguish established fact, attributed claim, disputed account, and interpretation when relevant.
- Preserve chronology and cultural/historical context.
- Use concrete scenes only when supported by source material or explicitly framed as reconstruction.
- Let voice and narrative momentum coexist with factual discipline.`;

    case "educational":
    case "reference":
    case "workbook":
      return `${base}

INSTRUCTIONAL CRAFT:
- Optimize for comprehension, retention, and practical use.
- Introduce concepts in a deliberate progression.
- Use examples, checks for understanding, exercises, frameworks, or summaries only when they help this reader.
- Avoid filler case studies and generic motivational language.
- Make every section earn its place.`;

    case "poetry":
      return `${base}

POETIC CRAFT:
- Treat the blueprint as an emotional/structural brief rather than a demand for explanatory prose.
- Prioritize image, sound, compression, surprise, rhythm, and intentional form.
- Avoid generic inspirational phrasing and synthetic profundity.
- Preserve variation across pieces while maintaining the collection's voice.`;

    case "fiction":
    case "graphic-story":
      return `${base}

FICTION CRAFT:
- Build the chapter around scene-level desire, obstacle, change, cost, and an unresolved forward pull.
- Use concrete sensory detail and character-specific observation.
- Dialogue must reveal distinct character, pressure, relationship, or information; avoid interchangeable voices.
- Respect established character state, chronology, world rules, open loops, and prior approved chapters.
- Avoid generic exposition, repetitive emotional labeling, and filler transitions.
- End where the story has genuinely changed, not with an artificial cliffhanger unless the genre calls for one.
- Approximate adult chapter length may be 2,000–3,000 words, but the Property contract outranks a fixed word target.`;

    default:
      return `${base}

GENERAL LONG-FORM CRAFT:
- Build a strong opening, purposeful progression, concrete examples/details, and a satisfying chapter-level movement.
- Match structure, voice, density, and length to the actual target reader and format.
- Do not force fiction conventions onto nonfiction or vice versa.
- Avoid generic AI phrasing, repetition, and filler.`;
  }
}
