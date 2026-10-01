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

    `CREATE TABLE IF NOT EXISTS artifact_streams (
      id varchar(64) PRIMARY KEY,
      property_id varchar(64) REFERENCES studio_properties(id) ON DELETE CASCADE,
      project_id integer REFERENCES projects(id) ON DELETE CASCADE,
      chapter_id integer REFERENCES chapters(id) ON DELETE CASCADE,
      type text NOT NULL,
      next_version integer NOT NULL DEFAULT 1,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS artifact_streams_scope_type_unique
      ON artifact_streams(
        coalesce(property_id, ''),
        coalesce(project_id, -1),
        coalesce(chapter_id, -1),
        type
      )`,
    `CREATE INDEX IF NOT EXISTS artifact_streams_property_idx ON artifact_streams(property_id)`,
    `CREATE INDEX IF NOT EXISTS artifact_streams_project_idx ON artifact_streams(project_id)`,

    `CREATE TABLE IF NOT EXISTS concept_synthesis_runs (
      id varchar(64) PRIMARY KEY,
      triad_draw_id varchar(64) NOT NULL REFERENCES triad_draws(id) ON DELETE CASCADE,
      property_id varchar(64) REFERENCES studio_properties(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'generated',
      context jsonb NOT NULL DEFAULT '{}'::jsonb,
      oracle_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
      directions jsonb NOT NULL DEFAULT '[]'::jsonb,
      contributions jsonb NOT NULL DEFAULT '[]'::jsonb,
      runtime jsonb NOT NULL DEFAULT '{}'::jsonb,
      selected_direction_id varchar(64),
      selected_dossier_id varchar(64) REFERENCES concept_dossiers(id) ON DELETE SET NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS concept_synthesis_runs_draw_idx ON concept_synthesis_runs(triad_draw_id)`,
    `CREATE INDEX IF NOT EXISTS concept_synthesis_runs_property_idx ON concept_synthesis_runs(property_id)`,
    `CREATE INDEX IF NOT EXISTS concept_synthesis_runs_status_idx ON concept_synthesis_runs(status)`,
    `CREATE INDEX IF NOT EXISTS concept_synthesis_runs_created_idx ON concept_synthesis_runs(created_at)`,

    `CREATE TABLE IF NOT EXISTS custom_ai_provider (
      id integer PRIMARY KEY DEFAULT 1,
      enabled boolean NOT NULL DEFAULT false,
      name text NOT NULL DEFAULT 'Custom API',
      base_url text NOT NULL DEFAULT '',
      api_key_ciphertext text,
      fast_model text NOT NULL DEFAULT '',
      writing_model text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT custom_ai_provider_singleton CHECK (id = 1)
    )`,

    `CREATE TABLE IF NOT EXISTS reader_bookmarks (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      owner_type text NOT NULL,
      owner_key text NOT NULL,
      kind text NOT NULL DEFAULT 'bookmark',
      page_index integer NOT NULL DEFAULT 0,
      chapter_number integer,
      chapter_title text,
      page_in_chapter integer,
      label text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS reader_bookmarks_project_owner_idx
      ON reader_bookmarks(project_id, owner_type, owner_key)`,
    `ALTER TABLE reader_bookmarks ADD COLUMN IF NOT EXISTS page_in_chapter integer`,
    `CREATE UNIQUE INDEX IF NOT EXISTS reader_progress_owner_project_unique
      ON reader_bookmarks(project_id, owner_type, owner_key, kind)
      WHERE kind = 'progress'`,
  ];

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}
