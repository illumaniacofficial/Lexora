# Lexora AI Provider Registry + Settings 4.0 Design

Date: 2026-10-01
Status: Approved design, implementation contract
Branch: `lx-3.0/visual-system-foundation`

## 1. Goal

Replace Lexora's current singleton custom-AI-provider model with a provider and model registry that supports multiple simultaneously saved providers, provider-specific model discovery, global routing defaults, project overrides, and bounded fallback behavior.

At the same time, reorganize Settings into a structured workspace so AI configuration is a first-class area rather than one large card inside a long page.

Primary user outcome:

- Save more than one API provider.
- Each saved provider becomes its own persistent module.
- After entering a provider API key, Lexora discovers available models when the provider supports discovery.
- The user selects default models from dropdowns instead of manually typing model IDs.
- Saving a provider clears the add-provider form so another provider can be added immediately.
- Lexora's writing, reasoning, fast, research, vision, embedding, and fallback workflows recognize the full provider/model registry instead of assuming OpenAI.
- OpenAI can be unavailable or out of credits without preventing Lexora text workflows from using other connected providers.

## 2. Current State

Lexora currently stores exactly one custom provider in `custom_ai_provider` with a singleton constraint `id = 1`.

The current runtime in `server/openai.ts` has two effective paths:

1. Configured OpenAI.
2. One enabled custom OpenAI-compatible provider.

Existing call sites continue to pass `FAST_MODEL` or `HIGH_MODEL`, while a proxy swaps those requests onto the single custom provider when enabled.

This is intentionally preserved during migration but is no longer the target architecture.

## 3. Design Principles

1. Additive migration first. No destructive provider or manuscript data changes.
2. Provider secrets remain server-side and encrypted at rest using the existing encryption strategy.
3. Provider metadata and model catalogs may be returned to the browser; raw API keys must never be returned.
4. Features request capabilities or roles, not vendor-specific models.
5. Existing OpenAI-based call sites continue to work during migration.
6. Provider discovery failures must not prevent manual model configuration.
7. Routing failures must be bounded. No infinite fallback loops.
8. Settings should expose common provider flows simply and keep custom endpoint details in advanced UI.

## 4. Data Model

### 4.1 ai_providers

Persistent provider records.

Fields:

- `id` identity primary key
- `slug` unique stable identifier
- `name`
- `provider_type`
  - `openai`
  - `openrouter`
  - `gemini`
  - `groq`
  - `together`
  - `fireworks`
  - `cerebras`
  - `mistral`
  - `deepinfra`
  - `custom_openai`
- `enabled`
- `base_url`
- `api_key_ciphertext`
- `last_tested_at`
- `last_test_status`
- `last_test_latency_ms`
- `created_at`
- `updated_at`

Provider presets supply known base URLs. Only custom providers expose base URL editing by default.

### 4.2 ai_provider_models

Cached discovered models.

Fields:

- `id` identity primary key
- `provider_id` foreign key
- `model_id`
- `display_name`
- `capabilities` jsonb
- `pricing` jsonb nullable
- `metadata` jsonb
- `is_available`
- `discovered_at`
- `updated_at`

Unique index on `provider_id, model_id`.

Capabilities may include:

- text
- reasoning
- vision
- tools
- streaming
- embeddings
- image_generation

Unknown capabilities remain unknown rather than guessed.

### 4.3 ai_routing_defaults

Global role selection.

One row per role:

- `fast`
- `writing`
- `reasoning`
- `research`
- `vision`
- `embedding`
- `fallback`

Fields:

- `role`
- `provider_id`
- `model_id`
- `updated_at`

### 4.4 project_ai_overrides

Optional project-level role overrides.

Fields:

- `id`
- `project_id`
- `role`
- `provider_id`
- `model_id`
- `created_at`
- `updated_at`

Unique index on `project_id, role`.

## 5. Legacy Migration

The existing `custom_ai_provider` table is retained during the migration window.

Startup migration behavior:

1. Ensure new registry tables exist.
2. If registry contains no migrated legacy provider and `custom_ai_provider` contains usable data:
   - create one `ai_providers` row with provider type `custom_openai`
   - preserve provider name, base URL, enabled state, and encrypted key
   - map legacy fast model to global `fast`
   - map legacy writing model to global `writing`
3. Mark migration using a metadata flag or deterministic provider slug so it cannot duplicate on repeated startup.
4. Existing legacy endpoints remain available as compatibility wrappers during the migration phase.
5. New UI uses the registry endpoints only.

No existing encrypted key needs to be decrypted and re-encrypted during migration unless required by schema mechanics.

## 6. Provider Discovery

### 6.1 Known OpenAI-Compatible Providers

For OpenAI-compatible providers, the discovery adapter first attempts the provider's documented model-list endpoint, normally equivalent to:

`GET /models`

using the stored credential.

The adapter normalizes provider responses into `ai_provider_models`.

### 6.2 Provider-Specific Adapters

Each provider gets a small adapter boundary:

- resolve base URL
- validate credential
- discover models
- normalize metadata
- construct runtime client

Provider adapters must not leak provider-specific response shapes into the rest of Lexora.

### 6.3 Discovery Failure

If automatic discovery is unsupported or fails:

- show the error without deleting the saved provider
- offer manual model entry
- allow the manually entered model to be assigned to roles
- retain a Refresh Models action for future retries

## 7. Provider Add Flow

Settings > AI Providers:

1. User selects provider preset or Custom OpenAI-Compatible.
2. Lexora fills known endpoint details for presets.
3. User enters API key.
4. User selects `Test & Discover Models`.
5. Server validates connection and fetches the model catalog.
6. UI opens model dropdowns for supported roles.
7. User chooses defaults.
8. User selects `Save Provider`.
9. Provider becomes a persistent provider card/module.
10. Add-provider form resets to a clean state.
11. `+ Add another provider` remains available.

Saving one provider never overwrites another.

## 8. Provider Module UI

Each saved provider card shows:

- provider name
- connection state
- enabled/disabled state
- last tested time
- discovered model count
- selected role models
- masked credential indicator
- optional latency
- Test
- Refresh Models
- Manage
- Disable

Raw credentials are never displayed.

## 9. Model Selection UX

Model assignments use dropdowns populated from the provider model registry.

Roles:

- Fast
- Writing
- Reasoning
- Research
- Vision
- Embedding
- Fallback

If model metadata is insufficient to filter confidently, Lexora shows the full discovered list rather than hiding valid choices.

Manual model ID entry remains available under an advanced fallback path.

## 10. Runtime Routing

Introduce a capability/role router in `server/core/modelRouter.ts`.

Primary interface:

```ts
resolveModel({
  role,
  projectId?,
  requiredCapabilities?
})
```

Resolution order:

1. project override for role
2. global default for role
3. compatible enabled provider/model
4. configured legacy/default OpenAI mapping during migration
5. configured fallback route

The resolved object includes:

- provider
- model
- client/runtime adapter
- runtimeId
- capabilities

Features should migrate away from vendor constants toward role requests.

## 11. Failure and Fallback Policy

Fallback is opt-in through the routing configuration.

Eligible failure classes:

- quota exhausted
- payment required
- rate limit after bounded retry
- provider unavailable
- transient upstream 5xx

Do not fallback automatically for:

- invalid request
- safety refusal
- malformed prompt contract
- application validation error
- authentication failure on a provider unless another configured route is explicitly eligible

Maximum provider/model attempts per user action: 3.

The original error chain is retained server-side for diagnostics without storing secrets or manuscript payloads.

## 12. Cost Preference

Global routing preference:

- Best quality
- Prefer free/included
- Lowest cost
- Fastest response

Phase 1 uses this preference only when metadata is trustworthy. It must not invent price or free-status metadata.

If OpenRouter or another provider supplies reliable free/pricing metadata, Lexora can use that metadata during candidate ordering.

## 13. Settings 4.0 Information Architecture

Desktop settings becomes a two-column settings workspace with a persistent settings navigation rail and one content surface.

Sections:

### Account
- account identity
- password
- workspace members
- session/security

### Appearance
- theme
- interface density
- reduced motion
- reading appearance shortcuts

### AI Providers
- provider modules
- add provider
- test connection
- refresh/discover models
- credential management

### AI Routing
- global role assignments
- provider priority
- fallback behavior
- cost preference

### Writing
- author defaults
- chapter targets
- writing behavior
- AI editing behavior

### Reader
- typography
- themes
- line spacing
- read-along behavior
- bookmark preferences

### Narration
- narration provider
- default voice
- pronunciation behavior
- playback defaults

### Project Defaults
- default language
- project type
- genre defaults
- auto cover
- model inheritance

### Storage & Export
- export format
- backups
- storage/cache controls

### Privacy
- AI data handling
- credential explanation
- cloud/local behavior

### Advanced
- custom endpoints
- experimental features
- diagnostic/provider information
- cache/reset controls

On mobile, the navigation rail becomes a settings index that opens a selected section.

## 14. Component Boundaries

The current `Settings.tsx` is already large. New work must not increase its responsibilities.

Create focused components under a settings namespace, for example:

- `client/src/components/settings/settings-shell.tsx`
- `client/src/components/settings/settings-nav.tsx`
- `client/src/components/settings/ai-providers-section.tsx`
- `client/src/components/settings/provider-card.tsx`
- `client/src/components/settings/provider-form.tsx`
- `client/src/components/settings/ai-routing-section.tsx`

Existing settings managers can be moved incrementally rather than rewritten all at once.

## 15. API Surface

New endpoints, owner-protected:

- `GET /api/ai/providers`
- `POST /api/ai/providers`
- `PATCH /api/ai/providers/:id`
- `POST /api/ai/providers/:id/test`
- `POST /api/ai/providers/:id/discover-models`
- `GET /api/ai/providers/:id/models`
- `GET /api/ai/routing`
- `PUT /api/ai/routing`
- `GET /api/projects/:projectId/ai-routing`
- `PUT /api/projects/:projectId/ai-routing`

Secrets are accepted only on create/update paths and never returned.

## 16. OpenAI Behavior

OpenAI remains a supported provider, not a privileged architectural assumption.

If the OpenAI key is configured but quota is exhausted:

- health may show degraded/unavailable
- routing may select another configured provider
- text features must not fail solely because OpenAI has no credit if another compatible route is configured

OpenAI image generation remains separate until the image-provider registry is explicitly migrated.

## 17. Compatibility

During migration:

- existing `openai.chat.completions.create(...)` call sites continue to function
- the dynamic proxy resolves through the new router internally
- `FAST_MODEL` and `HIGH_MODEL` remain compatibility aliases
- new features should use the role router directly

This allows staged conversion without a risky all-at-once rewrite.

## 18. Security

- API keys remain encrypted at rest.
- API keys never return to the browser after save.
- Logs must not contain API keys, authorization headers, or full provider responses that may contain sensitive data.
- Provider test errors returned to UI are sanitized.
- Custom base URLs require http/https validation.
- SSRF protections should reject local metadata endpoints and other unsafe private-address destinations for arbitrary custom providers where feasible.
- Owner role is required for provider and routing mutations.

## 19. Error States

Provider UI distinguishes:

- Connected
- Untested
- Authentication failed
- Quota exhausted
- Rate limited
- Provider unavailable
- Model discovery unsupported
- Model unavailable

A provider failure never deletes its saved configuration.

## 20. Testing

Server:

- multi-provider CRUD
- encrypted-key preservation on edit
- model discovery normalization
- legacy migration is idempotent
- routing precedence
- project override precedence
- fallback attempt cap
- non-fallback errors stay non-fallback
- OpenAI unavailable while alternate provider succeeds
- secret fields never appear in public DTOs

Client:

- save provider creates a provider module
- form resets after save
- add-another-provider works
- discovery populates model dropdowns
- manual model fallback works
- settings navigation switches sections
- mobile settings navigation remains usable
- disabled provider is not presented as active route

Regression:

- current settings values survive
- current custom provider survives migration
- Concept Lab, Scribe, chapter generation, Autopilot, and existing text-generation workflows still function
- no project/manuscript schema or content is modified

## 21. Implementation Order

Wave AI-1 — Registry schema + migration
Wave AI-2 — Provider service/adapters + model discovery
Wave AI-3 — Registry API
Wave AI-4 — Capability router + legacy bridge
Wave AI-5 — Settings 4.0 shell
Wave AI-6 — Provider modules + discovery dropdowns
Wave AI-7 — Global AI Routing UI
Wave AI-8 — Project overrides
Wave AI-9 — System-wide call-site migration
Wave AI-10 — fallback/cost policy hardening + regression

## 22. Definition of Done

- Multiple provider APIs can coexist.
- Saving a provider does not overwrite another provider.
- Saving resets the add-provider form.
- Saved providers render as persistent modules.
- Compatible providers can discover models.
- Discovered models appear in dropdowns.
- Manual model IDs remain possible when discovery fails.
- Global defaults can select provider + model per role.
- Project overrides can select provider + model per role.
- Text-generation workflows can use non-OpenAI models.
- OpenAI quota exhaustion does not block text generation when another compatible route exists.
- The legacy custom provider is migrated safely and only once.
- API keys remain encrypted and undisclosed.
- Settings is reorganized into the approved Settings 4.0 information architecture.
- Existing Lexora project/manuscript data is unchanged.
