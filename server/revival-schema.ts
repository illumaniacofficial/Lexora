import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Additive boot-time schema guard for the Revival operating model.
 * This intentionally creates only new tables/indexes and never alters or drops
 * legacy Lexora structures.
 */
export async function ensureRevivalSchema(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS studio_properties (
      id varchar(64) PRIMARY KEY,
      working_title text NOT NULL,
      canonical_title text,
      status text NOT NULL DEFAULT 'idea',
      format text NOT NULL DEFAULT 'custom',
      series_intent text NOT NULL DEFAULT 'standalone',
      legacy_vertical text,
      classification jsonb NOT NULL DEFAULT '{}'::jsonb,
      target_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS studio_properties_status_idx ON studio_properties(status)`,
    `CREATE INDEX IF NOT EXISTS studio_properties_updated_idx ON studio_properties(updated_at)`,

    `CREATE TABLE IF NOT EXISTS property_projects (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      property_id varchar(64) NOT NULL REFERENCES studio_properties(id) ON DELETE CASCADE,
      project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      relation text NOT NULL DEFAULT 'book',
      is_primary boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT property_projects_project_unique UNIQUE(project_id)
    )`,
    `CREATE INDEX IF NOT EXISTS property_projects_property_idx ON property_projects(property_id)`,

    `CREATE TABLE IF NOT EXISTS creative_artifacts (
      id varchar(64) PRIMARY KEY,
      property_id varchar(64) REFERENCES studio_properties(id) ON DELETE SET NULL,
      project_id integer REFERENCES projects(id) ON DELETE CASCADE,
      chapter_id integer REFERENCES chapters(id) ON DELETE SET NULL,
      type text NOT NULL,
      version integer NOT NULL DEFAULT 1,
      parent_artifact_id varchar(64),
      created_by text NOT NULL DEFAULT 'system',
      runtime_id text,
      model text,
      prompt_version text,
      context jsonb NOT NULL DEFAULT '{}'::jsonb,
      content jsonb NOT NULL DEFAULT 'null'::jsonb,
      content_hash text NOT NULL,
      estimated_cost_usd real,
      state text NOT NULL DEFAULT 'generated',
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS creative_artifacts_property_idx ON creative_artifacts(property_id)`,
    `CREATE INDEX IF NOT EXISTS creative_artifacts_project_idx ON creative_artifacts(project_id)`,
    `CREATE INDEX IF NOT EXISTS creative_artifacts_chapter_idx ON creative_artifacts(chapter_id)`,
    `CREATE INDEX IF NOT EXISTS creative_artifacts_state_idx ON creative_artifacts(state)`,
    `CREATE INDEX IF NOT EXISTS creative_artifacts_created_idx ON creative_artifacts(created_at)`,

    `CREATE TABLE IF NOT EXISTS continuity_snapshots (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version integer NOT NULL DEFAULT 1,
      state jsonb NOT NULL DEFAULT '{}'::jsonb,
      last_accepted_chapter_id integer REFERENCES chapters(id) ON DELETE SET NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT continuity_snapshots_project_unique UNIQUE(project_id)
    )`,

    `CREATE TABLE IF NOT EXISTS concept_dossiers (
      id varchar(64) PRIMARY KEY,
      property_id varchar(64) REFERENCES studio_properties(id) ON DELETE SET NULL,
      source_type text NOT NULL,
      source jsonb NOT NULL DEFAULT '{}'::jsonb,
      dossier jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'candidate',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS concept_dossiers_property_idx ON concept_dossiers(property_id)`,
    `CREATE INDEX IF NOT EXISTS concept_dossiers_status_idx ON concept_dossiers(status)`,

    `CREATE TABLE IF NOT EXISTS triad_draws (
      id varchar(64) PRIMARY KEY,
      mode text NOT NULL DEFAULT 'pure-chaos',
      who_card jsonb NOT NULL,
      what_card jsonb NOT NULL,
      how_card jsonb NOT NULL,
      locked_axes text[] NOT NULL DEFAULT ARRAY[]::text[],
      wildcards text[] NOT NULL DEFAULT ARRAY[]::text[],
      status text NOT NULL DEFAULT 'drawn',
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS triad_draws_created_idx ON triad_draws(created_at)`,
  ];

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}
