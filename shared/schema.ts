import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, real, boolean, jsonb, json, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Session table managed by connect-pg-simple. Declared here so drizzle-kit
// tracks it and does not treat new tables as renames of it during push.
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire),
]);

export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const VERTICALS = [
  "money", "fitness", "spirituality", "career", "education", "relationships", "health", "mindset", "parenting", "technology",
  "cooking", "travel", "photography", "music", "writing", "art", "gardening", "pets", "sports", "gaming",
  "philosophy", "history", "science", "psychology", "sociology", "politics", "law", "business", "marketing", "sales",
  "real-estate", "crypto", "ai", "cybersecurity", "productivity", "minimalism", "sustainability", "fashion", "beauty", "diy",
  "sci-fi", "fantasy", "horror", "romance", "thriller", "mystery", "literary-fiction", "dystopian", "erotica",
  "memoir", "biography", "true-crime", "comedy", "adventure", "young-adult", "children", "poetry", "drama", "western",
  "novel",
] as const;
export type Vertical = typeof VERTICALS[number];

export const LANGUAGES = ["english", "spanish", "portuguese", "french", "german"] as const;
export type Language = typeof LANGUAGES[number];

export const PROJECT_STATUSES = ["draft", "trend_analysis", "outlining", "writing", "editing", "marketing", "complete", "paused"] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export const projects = pgTable("projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  authorName: text("author_name").notNull().default(""),
  description: text("description"),
  vertical: text("vertical").notNull().default("money"),
  targetLanguage: text("target_language").notNull().default("english"),
  status: text("status").notNull().default("draft"),
  greenlightScore: real("greenlight_score"),
  qualityScore: real("quality_score"),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  wordCount: integer("word_count").notNull().default(0),
  chapterCount: integer("chapter_count").notNull().default(0),
  coverImageUrl: text("cover_image_url"),
  coverPrompt: text("cover_prompt"),
  coverAvoidStyles: text("cover_avoid_styles"),
  publishedToStore: boolean("published_to_store").notNull().default(false),
  seriesId: integer("series_id").references((): any => series.id, { onDelete: "set null" }),
  styleFingerprintId: integer("style_fingerprint_id").references((): any => styleFingerprints.id, { onDelete: "set null" }),
  brandKitId: integer("brand_kit_id").references((): any => brandKits.id, { onDelete: "set null" }),
  priceUsd: real("price_usd").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const bookDna = pgTable("book_dna", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  corePromise: text("core_promise"),
  readerAvatar: text("reader_avatar"),
  toneRules: text("tone_rules"),
  transformationArc: text("transformation_arc"),
  frameworkSummary: text("framework_summary"),
  bannedPhrases: text("banned_phrases").array(),
  keyVocabulary: text("key_vocabulary").array(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("book_dna_project_idx").on(table.projectId),
]);

export const trendReports = pgTable("trend_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  vertical: text("vertical").notNull(),
  demandScore: real("demand_score"),
  competitionScore: real("competition_score"),
  greenlightScore: real("greenlight_score"),
  painPoints: text("pain_points").array(),
  titleAngles: text("title_angles").array(),
  nicheTopics: text("niche_topics").array(),
  keywords: text("keywords").array(),
  summary: text("summary"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("trend_reports_project_idx").on(table.projectId),
  index("trend_reports_vertical_idx").on(table.vertical),
]);

export const chapters = pgTable("chapters", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  title: text("title").notNull(),
  blueprint: text("blueprint"),
  content: text("content"),
  wordCount: integer("word_count").notNull().default(0),
  qualityScore: real("quality_score"),
  status: text("status").notNull().default("pending"),
  approvalStatus: text("approval_status").notNull().default("none"),
  audioUrl: text("audio_url"),
  lastEditedAt: timestamp("last_edited_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("chapters_project_idx").on(table.projectId),
]);

export const runSteps = pgTable("run_steps", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  stepName: text("step_name").notNull(),
  model: text("model").notNull().default("gpt-5.1"),
  tokensUsed: integer("tokens_used").notNull().default(0),
  costEstimate: real("cost_estimate").notNull().default(0),
  qualityScore: real("quality_score"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("run_steps_project_idx").on(table.projectId),
]);

export const marketingAssets = pgTable("marketing_assets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  shortBlurb: text("short_blurb"),
  mediumBlurb: text("medium_blurb"),
  longBlurb: text("long_blurb"),
  amazonDescription: text("amazon_description"),
  hooks: text("hooks").array(),
  adAngles: text("ad_angles").array(),
  emailSequence: jsonb("email_sequence"),
  socialCalendar: jsonb("social_calendar"),
  pricingMatrix: jsonb("pricing_matrix"),
  authorBio: text("author_bio"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("marketing_assets_project_idx").on(table.projectId),
]);

export const autopilotConfig = pgTable("autopilot_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  vertical: text("vertical").notNull().default("money"),
  monthlyBookTarget: integer("monthly_book_target").notNull().default(2),
  budgetCapUsd: real("budget_cap_usd").notNull().default(50),
  minQualityScore: real("min_quality_score").notNull().default(7.0),
  targetLanguages: text("target_languages").array().notNull().default(sql`ARRAY['english']`),
  strategyData: jsonb("strategy_data"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const autopilotRuns = pgTable("autopilot_runs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  vertical: text("vertical").notNull(),
  status: text("status").notNull().default("pending"),
  currentStep: text("current_step"),
  bookTitle: text("book_title"),
  errorMessage: text("error_message"),
  totalTokens: integer("total_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull().default(0),
  startedAt: timestamp("started_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const inviteTokens = pgTable("invite_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  label: text("label").notNull().default("Reader Invite"),
  isActive: boolean("is_active").notNull().default(true),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const bookRequests = pgTable("book_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  inviteToken: varchar("invite_token", { length: 64 }).notNull(),
  readerName: text("reader_name").notNull().default("Anonymous"),
  genre: text("genre").notNull(),
  description: text("description").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("book_requests_token_idx").on(table.inviteToken),
]);

export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  defaultAuthorName: text("default_author_name").notNull().default("Sergio A. Delgado"),
  defaultVertical: text("default_vertical").notNull().default("money"),
  defaultLanguage: text("default_language").notNull().default("english"),
  aiModel: text("ai_model").notNull().default("high"),
  chapterWordTarget: integer("chapter_word_target").notNull().default(3000),
  autoGenerateCover: boolean("auto_generate_cover").notNull().default(true),
  autoGenerateMarketing: boolean("auto_generate_marketing").notNull().default(true),
  ttsDefaultVoice: text("tts_default_voice").notNull().default("fabb918a343d4591b428083a35980dc4"),
  storefrontTitle: text("storefront_title").notNull().default("Lexora Book Collection"),
  exportFormat: text("export_format").notNull().default("html"),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const storefrontReaders = pgTable("storefront_readers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull().default("Reader"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertStorefrontReaderSchema = createInsertSchema(storefrontReaders).omit({ createdAt: true });
export type StorefrontReader = typeof storefrontReaders.$inferSelect;
export type InsertStorefrontReader = z.infer<typeof insertStorefrontReaderSchema>;

export const chatConversations = pgTable("chat_conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull().default("New Conversation"),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("chat_conversations_project_idx").on(table.projectId),
]);

export const chatMessages = pgTable("chat_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("user"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("chat_messages_conversation_idx").on(table.conversationId),
]);

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({ createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ createdAt: true });
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({ updatedAt: true });
export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;

export const insertAutopilotRunSchema = createInsertSchema(autopilotRuns).omit({ startedAt: true, completedAt: true });
export const insertInviteTokenSchema = createInsertSchema(inviteTokens).omit({ createdAt: true, viewCount: true });
export const insertBookRequestSchema = createInsertSchema(bookRequests).omit({ createdAt: true, isRead: true });

export const insertProjectSchema = createInsertSchema(projects).omit({ createdAt: true, updatedAt: true, publishedToStore: true });
export const insertChapterSchema = createInsertSchema(chapters).omit({ createdAt: true, updatedAt: true });
export const insertTrendReportSchema = createInsertSchema(trendReports).omit({ createdAt: true });
export const insertMarketingAssetSchema = createInsertSchema(marketingAssets).omit({ createdAt: true });
export const insertRunStepSchema = createInsertSchema(runSteps).omit({ createdAt: true });
export const insertBookDnaSchema = createInsertSchema(bookDna).omit({ createdAt: true });
export const insertAutopilotConfigSchema = createInsertSchema(autopilotConfig).omit({ createdAt: true, updatedAt: true });

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type TrendReport = typeof trendReports.$inferSelect;
export type InsertTrendReport = z.infer<typeof insertTrendReportSchema>;
export type MarketingAsset = typeof marketingAssets.$inferSelect;
export type InsertMarketingAsset = z.infer<typeof insertMarketingAssetSchema>;
export type RunStep = typeof runSteps.$inferSelect;
export type InsertRunStep = z.infer<typeof insertRunStepSchema>;
export type BookDna = typeof bookDna.$inferSelect;
export type InsertBookDna = z.infer<typeof insertBookDnaSchema>;
export type AutopilotConfig = typeof autopilotConfig.$inferSelect;
export type InsertAutopilotConfig = z.infer<typeof insertAutopilotConfigSchema>;
export type AutopilotRun = typeof autopilotRuns.$inferSelect;
export type InsertAutopilotRun = z.infer<typeof insertAutopilotRunSchema>;
export type InviteToken = typeof inviteTokens.$inferSelect;
export type BookRequest = typeof bookRequests.$inferSelect;
export type InsertBookRequest = z.infer<typeof insertBookRequestSchema>;
export type InsertInviteToken = z.infer<typeof insertInviteTokenSchema>;

// ===================================================================
// Roadmap foundation tables (shared by the 30-feature roadmap)
// ===================================================================

export const series = pgTable("series", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  description: text("description"),
  bible: jsonb("bible"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const styleFingerprints = pgTable("style_fingerprints", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  sampleText: text("sample_text"),
  profile: jsonb("profile"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const brandKits = pgTable("brand_kits", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  palette: jsonb("palette"),
  fonts: jsonb("fonts"),
  logoUrl: text("logo_url"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const storyEntities = pgTable("story_entities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  seriesId: integer("series_id").references(() => series.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("character"),
  name: text("name").notNull(),
  profile: jsonb("profile"),
  relationships: jsonb("relationships"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("story_entities_project_idx").on(table.projectId),
  index("story_entities_series_idx").on(table.seriesId),
]);

export const chapterAnalyses = pgTable("chapter_analyses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  score: real("score"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("chapter_analyses_project_idx").on(table.projectId),
  index("chapter_analyses_chapter_idx").on(table.chapterId),
]);

export const marketReports = pgTable("market_reports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  vertical: text("vertical"),
  kind: text("kind").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("market_reports_project_idx").on(table.projectId),
]);

export const revenueForecasts = pgTable("revenue_forecasts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assumptions: jsonb("assumptions"),
  projections: jsonb("projections"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("revenue_forecasts_project_idx").on(table.projectId),
]);

export const abTests = pgTable("ab_tests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  testType: text("test_type").notNull(),
  variants: jsonb("variants"),
  winnerIndex: integer("winner_index"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("ab_tests_project_idx").on(table.projectId),
]);

export const analyticsEvents = pgTable("analytics_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  value: real("value").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("analytics_events_project_idx").on(table.projectId),
  index("analytics_events_type_idx").on(table.eventType),
]);

export const coverVariants = pgTable("cover_variants", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt"),
  isSelected: boolean("is_selected").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("cover_variants_project_idx").on(table.projectId),
]);

export const exportJobs = pgTable("export_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  format: text("format").notNull(),
  language: text("language"),
  status: text("status").notNull().default("pending"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("export_jobs_project_idx").on(table.projectId),
]);

export const membershipTiers = pgTable("membership_tiers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  priceUsd: real("price_usd").notNull().default(0),
  stripePriceId: text("stripe_price_id"),
  benefits: jsonb("benefits"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const readerMemberships = pgTable("reader_memberships", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  readerId: integer("reader_id").notNull().references(() => storefrontReaders.id, { onDelete: "cascade" }),
  tierId: integer("tier_id").references(() => membershipTiers.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("reader_memberships_reader_idx").on(table.readerId),
]);

export const storefrontOrders = pgTable("storefront_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  readerId: integer("reader_id").references(() => storefrontReaders.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  inviteToken: varchar("invite_token", { length: 64 }),
  amount: real("amount").notNull().default(0),
  currency: text("currency").notNull().default("usd"),
  stripeSessionId: text("stripe_session_id"),
  status: text("status").notNull().default("pending"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("storefront_orders_reader_idx").on(table.readerId),
  index("storefront_orders_project_idx").on(table.projectId),
]);

export const referrals = pgTable("referrals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  readerId: integer("reader_id").references(() => storefrontReaders.id, { onDelete: "set null" }),
  clicks: integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  rewardAmount: real("reward_amount").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const launchSchedules = pgTable("launch_schedules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  launchDate: timestamp("launch_date"),
  items: jsonb("items"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("launch_schedules_project_idx").on(table.projectId),
]);

export const mediaAssets = pgTable("media_assets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  url: text("url"),
  status: text("status").notNull().default("pending"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("media_assets_project_idx").on(table.projectId),
]);

export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  kind: text("kind").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("notifications_read_idx").on(table.isRead),
]);

export const bookEditions = pgTable("book_editions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("book_editions_project_idx").on(table.projectId),
]);

export const editionChapters = pgTable("edition_chapters", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  editionId: integer("edition_id").notNull().references(() => bookEditions.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  title: text("title").notNull(),
  content: text("content"),
  wordCount: integer("word_count").notNull().default(0),
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("edition_chapters_edition_idx").on(table.editionId),
]);

export const workspaceMembers = pgTable("workspace_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("viewer"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("workspace_members_user_idx").on(table.userId),
]);

export const chapterComments = pgTable("chapter_comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chapterId: integer("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull().default("Admin"),
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("chapter_comments_chapter_idx").on(table.chapterId),
]);

export const chapterVersions = pgTable("chapter_versions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chapterId: integer("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  wordCount: integer("word_count").notNull().default(0),
  versionNote: text("version_note"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("chapter_versions_chapter_idx").on(table.chapterId),
]);

// Narration audio tracks. One row per (project, scope, page, voice). Stores the
// audio file plus a timing map that aligns audio to text at word + syllable level
// so playback can be synchronized (and stays in sync when sped up / slowed down,
// since client scales the relative timestamps by the playback rate).
// scope: 'book' (intro/outro/whole) | 'chapter' | 'page'. chapterId is null for
// book-level tracks; pageIndex is set only for page-level tracks.
export const audioTracks = pgTable("audio_tracks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  scope: text("scope").notNull().default("chapter"),
  pageIndex: integer("page_index"),
  voiceId: text("voice_id").notNull(),
  audioUrl: text("audio_url").notNull(),
  durationMs: integer("duration_ms"),
  baseSpeed: real("base_speed").notNull().default(1),
  wordCount: integer("word_count").notNull().default(0),
  fileSize: integer("file_size"),
  // timingMap: { words: [{ text, startMs, endMs, syllables?: [{ text, startMs, endMs }] }], cadence?: {...} }
  timingMap: jsonb("timing_map"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("audio_tracks_project_idx").on(table.projectId),
  index("audio_tracks_chapter_idx").on(table.chapterId),
  // Null-safe logical uniqueness: one track per (project, scope, chapter, page, voice).
  // NULLS NOT DISTINCT treats NULL chapter/page as equal (Postgres 15+), matching the
  // intent of the previous coalesce() expression index while emitting clean migration SQL.
  unique("audio_tracks_unique_idx").on(
    table.projectId,
    table.scope,
    table.voiceId,
    table.chapterId,
    table.pageIndex,
  ).nullsNotDistinct(),
]);

export const insertSeriesSchema = createInsertSchema(series).omit({ createdAt: true, updatedAt: true });
export type Series = typeof series.$inferSelect;
export type InsertSeries = z.infer<typeof insertSeriesSchema>;

export const insertStyleFingerprintSchema = createInsertSchema(styleFingerprints).omit({ createdAt: true });
export type StyleFingerprint = typeof styleFingerprints.$inferSelect;
export type InsertStyleFingerprint = z.infer<typeof insertStyleFingerprintSchema>;

export const insertBrandKitSchema = createInsertSchema(brandKits).omit({ createdAt: true, updatedAt: true });
export type BrandKit = typeof brandKits.$inferSelect;
export type InsertBrandKit = z.infer<typeof insertBrandKitSchema>;

export const insertStoryEntitySchema = createInsertSchema(storyEntities).omit({ createdAt: true, updatedAt: true });
export type StoryEntity = typeof storyEntities.$inferSelect;
export type InsertStoryEntity = z.infer<typeof insertStoryEntitySchema>;

export const insertChapterAnalysisSchema = createInsertSchema(chapterAnalyses).omit({ createdAt: true });
export type ChapterAnalysis = typeof chapterAnalyses.$inferSelect;
export type InsertChapterAnalysis = z.infer<typeof insertChapterAnalysisSchema>;

export const insertMarketReportSchema = createInsertSchema(marketReports).omit({ createdAt: true });
export type MarketReport = typeof marketReports.$inferSelect;
export type InsertMarketReport = z.infer<typeof insertMarketReportSchema>;

export const insertRevenueForecastSchema = createInsertSchema(revenueForecasts).omit({ createdAt: true });
export type RevenueForecast = typeof revenueForecasts.$inferSelect;
export type InsertRevenueForecast = z.infer<typeof insertRevenueForecastSchema>;

export const insertAbTestSchema = createInsertSchema(abTests).omit({ createdAt: true });
export type AbTest = typeof abTests.$inferSelect;
export type InsertAbTest = z.infer<typeof insertAbTestSchema>;

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({ createdAt: true });
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

export const insertCoverVariantSchema = createInsertSchema(coverVariants).omit({ createdAt: true });
export type CoverVariant = typeof coverVariants.$inferSelect;
export type InsertCoverVariant = z.infer<typeof insertCoverVariantSchema>;

export const insertExportJobSchema = createInsertSchema(exportJobs).omit({ createdAt: true });
export type ExportJob = typeof exportJobs.$inferSelect;
export type InsertExportJob = z.infer<typeof insertExportJobSchema>;

export const insertMembershipTierSchema = createInsertSchema(membershipTiers).omit({ createdAt: true });
export type MembershipTier = typeof membershipTiers.$inferSelect;
export type InsertMembershipTier = z.infer<typeof insertMembershipTierSchema>;

export const insertReaderMembershipSchema = createInsertSchema(readerMemberships).omit({ createdAt: true });
export type ReaderMembership = typeof readerMemberships.$inferSelect;
export type InsertReaderMembership = z.infer<typeof insertReaderMembershipSchema>;

export const insertStorefrontOrderSchema = createInsertSchema(storefrontOrders).omit({ createdAt: true });
export type StorefrontOrder = typeof storefrontOrders.$inferSelect;
export type InsertStorefrontOrder = z.infer<typeof insertStorefrontOrderSchema>;

export const insertReferralSchema = createInsertSchema(referrals).omit({ createdAt: true, clicks: true, conversions: true, rewardAmount: true });
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;

export const insertLaunchScheduleSchema = createInsertSchema(launchSchedules).omit({ createdAt: true });
export type LaunchSchedule = typeof launchSchedules.$inferSelect;
export type InsertLaunchSchedule = z.infer<typeof insertLaunchScheduleSchema>;

export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({ createdAt: true });
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;

export const insertNotificationSchema = createInsertSchema(notifications).omit({ createdAt: true, isRead: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const insertBookEditionSchema = createInsertSchema(bookEditions).omit({ createdAt: true });
export type BookEdition = typeof bookEditions.$inferSelect;
export type InsertBookEdition = z.infer<typeof insertBookEditionSchema>;

export const insertEditionChapterSchema = createInsertSchema(editionChapters).omit({ createdAt: true });
export type EditionChapter = typeof editionChapters.$inferSelect;
export type InsertEditionChapter = z.infer<typeof insertEditionChapterSchema>;

export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers).omit({ createdAt: true });
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;

export const insertChapterCommentSchema = createInsertSchema(chapterComments).omit({ createdAt: true, resolved: true });
export type ChapterComment = typeof chapterComments.$inferSelect;
export type InsertChapterComment = z.infer<typeof insertChapterCommentSchema>;

export const insertChapterVersionSchema = createInsertSchema(chapterVersions).omit({ createdAt: true });
export type ChapterVersion = typeof chapterVersions.$inferSelect;
export type InsertChapterVersion = z.infer<typeof insertChapterVersionSchema>;

export const insertAudioTrackSchema = createInsertSchema(audioTracks).omit({ createdAt: true });
export type AudioTrack = typeof audioTracks.$inferSelect;
export type InsertAudioTrack = z.infer<typeof insertAudioTrackSchema>;


// ===================================================================
// Lexora Revival — additive studio operating model
// These tables sit above/alongside legacy projects. They are intentionally
// additive so existing manuscripts remain readable without destructive migration.
// ===================================================================

export const studioProperties = pgTable("studio_properties", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workingTitle: text("working_title").notNull(),
  canonicalTitle: text("canonical_title"),
  status: text("status").notNull().default("idea"),
  format: text("format").notNull().default("custom"),
  seriesIntent: text("series_intent").notNull().default("standalone"),
  legacyVertical: text("legacy_vertical"),
  classification: jsonb("classification").notNull().default(sql`'{}'::jsonb`),
  targetContract: jsonb("target_contract").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("studio_properties_status_idx").on(table.status),
  index("studio_properties_updated_idx").on(table.updatedAt),
]);

export const propertyProjects = pgTable("property_projects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  propertyId: varchar("property_id", { length: 64 }).notNull().references(() => studioProperties.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  relation: text("relation").notNull().default("book"),
  isPrimary: boolean("is_primary").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  unique("property_projects_project_unique").on(table.projectId),
  index("property_projects_property_idx").on(table.propertyId),
]);

export const creativeArtifacts = pgTable("creative_artifacts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  propertyId: varchar("property_id", { length: 64 }).references(() => studioProperties.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  version: integer("version").notNull().default(1),
  parentArtifactId: varchar("parent_artifact_id", { length: 64 }),
  createdBy: text("created_by").notNull().default("system"),
  runtimeId: text("runtime_id"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  context: jsonb("context").notNull().default(sql`'{}'::jsonb`),
  content: jsonb("content").notNull().default(sql`'null'::jsonb`),
  contentHash: text("content_hash").notNull(),
  estimatedCostUsd: real("estimated_cost_usd"),
  state: text("state").notNull().default("generated"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("creative_artifacts_property_idx").on(table.propertyId),
  index("creative_artifacts_project_idx").on(table.projectId),
  index("creative_artifacts_chapter_idx").on(table.chapterId),
  index("creative_artifacts_state_idx").on(table.state),
  index("creative_artifacts_created_idx").on(table.createdAt),
]);

export const continuitySnapshots = pgTable("continuity_snapshots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  state: jsonb("state").notNull().default(sql`'{}'::jsonb`),
  lastAcceptedChapterId: integer("last_accepted_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  unique("continuity_snapshots_project_unique").on(table.projectId),
]);

export const conceptDossiers = pgTable("concept_dossiers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  propertyId: varchar("property_id", { length: 64 }).references(() => studioProperties.id, { onDelete: "set null" }),
  sourceType: text("source_type").notNull(),
  source: jsonb("source").notNull().default(sql`'{}'::jsonb`),
  dossier: jsonb("dossier").notNull().default(sql`'{}'::jsonb`),
  status: text("status").notNull().default("candidate"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("concept_dossiers_property_idx").on(table.propertyId),
  index("concept_dossiers_status_idx").on(table.status),
]);

export const triadDraws = pgTable("triad_draws", {
  id: varchar("id", { length: 64 }).primaryKey(),
  mode: text("mode").notNull().default("pure-chaos"),
  whoCard: jsonb("who_card").notNull(),
  whatCard: jsonb("what_card").notNull(),
  howCard: jsonb("how_card").notNull(),
  lockedAxes: text("locked_axes").array().notNull().default(sql`ARRAY[]::text[]`),
  wildcards: text("wildcards").array().notNull().default(sql`ARRAY[]::text[]`),
  status: text("status").notNull().default("drawn"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
}, (table) => [
  index("triad_draws_created_idx").on(table.createdAt),
]);

export const artifactStreams = pgTable("artifact_streams", {
  id: varchar("id", { length: 64 }).primaryKey(),
  propertyId: varchar("property_id", { length: 64 }).references(() => studioProperties.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  chapterId: integer("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  nextVersion: integer("next_version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  unique("artifact_streams_scope_type_unique").on(table.propertyId, table.projectId, table.chapterId, table.type),
  index("artifact_streams_property_idx").on(table.propertyId),
  index("artifact_streams_project_idx").on(table.projectId),
]);

export const conceptSynthesisRuns = pgTable("concept_synthesis_runs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  triadDrawId: varchar("triad_draw_id", { length: 64 }).notNull().references(() => triadDraws.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id", { length: 64 }).references(() => studioProperties.id, { onDelete: "set null" }),
  status: text("status").notNull().default("generated"),
  context: jsonb("context").notNull().default(sql`'{}'::jsonb`),
  oracleAnalysis: jsonb("oracle_analysis").notNull().default(sql`'{}'::jsonb`),
  directions: jsonb("directions").notNull().default(sql`'[]'::jsonb`),
  contributions: jsonb("contributions").notNull().default(sql`'[]'::jsonb`),
  runtime: jsonb("runtime").notNull().default(sql`'{}'::jsonb`),
  selectedDirectionId: varchar("selected_direction_id", { length: 64 }),
  selectedDossierId: varchar("selected_dossier_id", { length: 64 }).references(() => conceptDossiers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
}, (table) => [
  index("concept_synthesis_runs_draw_idx").on(table.triadDrawId),
  index("concept_synthesis_runs_property_idx").on(table.propertyId),
  index("concept_synthesis_runs_status_idx").on(table.status),
  index("concept_synthesis_runs_created_idx").on(table.createdAt),
]);

export const insertStudioPropertySchema = createInsertSchema(studioProperties).omit({ createdAt: true, updatedAt: true });
export const insertPropertyProjectSchema = createInsertSchema(propertyProjects).omit({ createdAt: true });
export const insertCreativeArtifactSchema = createInsertSchema(creativeArtifacts).omit({ createdAt: true });
export const insertContinuitySnapshotSchema = createInsertSchema(continuitySnapshots).omit({ createdAt: true, updatedAt: true });
export const insertConceptDossierSchema = createInsertSchema(conceptDossiers).omit({ createdAt: true, updatedAt: true });
export const insertTriadDrawSchema = createInsertSchema(triadDraws).omit({ createdAt: true });
export const insertArtifactStreamSchema = createInsertSchema(artifactStreams).omit({ createdAt: true, updatedAt: true });
export const insertConceptSynthesisRunSchema = createInsertSchema(conceptSynthesisRuns).omit({ createdAt: true, updatedAt: true });

export type StudioProperty = typeof studioProperties.$inferSelect;
export type InsertStudioProperty = z.infer<typeof insertStudioPropertySchema>;
export type PropertyProject = typeof propertyProjects.$inferSelect;
export type InsertPropertyProject = z.infer<typeof insertPropertyProjectSchema>;
export type CreativeArtifactRow = typeof creativeArtifacts.$inferSelect;
export type InsertCreativeArtifact = z.infer<typeof insertCreativeArtifactSchema>;
export type ContinuitySnapshot = typeof continuitySnapshots.$inferSelect;
export type InsertContinuitySnapshot = z.infer<typeof insertContinuitySnapshotSchema>;
export type ConceptDossierRow = typeof conceptDossiers.$inferSelect;
export type InsertConceptDossier = z.infer<typeof insertConceptDossierSchema>;
export type TriadDrawRow = typeof triadDraws.$inferSelect;
export type InsertTriadDraw = z.infer<typeof insertTriadDrawSchema>;
export type ArtifactStreamRow = typeof artifactStreams.$inferSelect;
export type InsertArtifactStream = z.infer<typeof insertArtifactStreamSchema>;
export type ConceptSynthesisRunRow = typeof conceptSynthesisRuns.$inferSelect;
export type InsertConceptSynthesisRun = z.infer<typeof insertConceptSynthesisRunSchema>;
