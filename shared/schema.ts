import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, real, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

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
  ttsDefaultVoice: text("tts_default_voice").notNull().default("alloy"),
  storefrontTitle: text("storefront_title").notNull().default("Lexora Book Collection"),
  exportFormat: text("export_format").notNull().default("html"),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

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

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({ id: true, updatedAt: true });
export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;

export const insertAutopilotRunSchema = createInsertSchema(autopilotRuns).omit({ id: true, startedAt: true, completedAt: true });
export const insertInviteTokenSchema = createInsertSchema(inviteTokens).omit({ id: true, createdAt: true, viewCount: true });
export const insertBookRequestSchema = createInsertSchema(bookRequests).omit({ id: true, createdAt: true, isRead: true });

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true, publishedToStore: true });
export const insertChapterSchema = createInsertSchema(chapters).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTrendReportSchema = createInsertSchema(trendReports).omit({ id: true, createdAt: true });
export const insertMarketingAssetSchema = createInsertSchema(marketingAssets).omit({ id: true, createdAt: true });
export const insertRunStepSchema = createInsertSchema(runSteps).omit({ id: true, createdAt: true });
export const insertBookDnaSchema = createInsertSchema(bookDna).omit({ id: true, createdAt: true });
export const insertAutopilotConfigSchema = createInsertSchema(autopilotConfig).omit({ id: true, createdAt: true, updatedAt: true });

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
