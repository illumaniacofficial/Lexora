import { db } from "./db";
import {
  users, projects, bookDna, trendReports, chapters, runSteps, marketingAssets, autopilotConfig, autopilotRuns, inviteTokens, appSettings, chatConversations, chatMessages, bookRequests, storefrontReaders,
  type User, type InsertUser, type Project, type InsertProject, type BookDna, type InsertBookDna,
  type TrendReport, type InsertTrendReport, type Chapter, type InsertChapter,
  type RunStep, type InsertRunStep, type MarketingAsset, type InsertMarketingAsset,
  type AutopilotConfig, type InsertAutopilotConfig,
  type AutopilotRun, type InsertAutopilotRun,
  type InviteToken, type InsertInviteToken,
  type AppSettings, type InsertAppSettings,
  type ChatConversation, type InsertChatConversation,
  type ChatMessage, type InsertChatMessage,
  type BookRequest, type InsertBookRequest,
  type StorefrontReader, type InsertStorefrontReader,
  series, styleFingerprints, brandKits, storyEntities, chapterAnalyses, marketReports,
  revenueForecasts, abTests, analyticsEvents, coverVariants, exportJobs, membershipTiers,
  readerMemberships, storefrontOrders, referrals, launchSchedules, mediaAssets, notifications,
  bookEditions, editionChapters, workspaceMembers, chapterComments, chapterVersions, audioTracks,
  studioProperties, propertyProjects, creativeArtifacts, continuitySnapshots, conceptDossiers, triadDraws,
  artifactStreams, conceptSynthesisRuns,
  type Series, type InsertSeries, type StyleFingerprint, type InsertStyleFingerprint,
  type BrandKit, type InsertBrandKit, type StoryEntity, type InsertStoryEntity,
  type ChapterAnalysis, type InsertChapterAnalysis, type MarketReport, type InsertMarketReport,
  type RevenueForecast, type InsertRevenueForecast, type AbTest, type InsertAbTest,
  type AnalyticsEvent, type InsertAnalyticsEvent, type CoverVariant, type InsertCoverVariant,
  type ExportJob, type InsertExportJob, type MembershipTier, type InsertMembershipTier,
  type ReaderMembership, type InsertReaderMembership, type StorefrontOrder, type InsertStorefrontOrder,
  type Referral, type InsertReferral, type LaunchSchedule, type InsertLaunchSchedule,
  type MediaAsset, type InsertMediaAsset, type Notification, type InsertNotification,
  type BookEdition, type InsertBookEdition, type EditionChapter, type InsertEditionChapter,
  type WorkspaceMember, type InsertWorkspaceMember, type ChapterComment, type InsertChapterComment,
  type ChapterVersion, type InsertChapterVersion,
  type AudioTrack, type InsertAudioTrack,
  type StudioProperty, type InsertStudioProperty,
  type PropertyProject, type InsertPropertyProject,
  type CreativeArtifactRow, type InsertCreativeArtifact,
  type ContinuitySnapshot, type InsertContinuitySnapshot,
  type ConceptDossierRow, type InsertConceptDossier,
  type TriadDrawRow, type InsertTriadDraw,
  type ArtifactStreamRow, type InsertArtifactStream,
  type ConceptSynthesisRunRow, type InsertConceptSynthesisRun,
} from "@shared/schema";
import { eq, desc, sql, and, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: string, password: string): Promise<void>;

  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  getBookDna(projectId: number): Promise<BookDna | undefined>;
  upsertBookDna(data: InsertBookDna): Promise<BookDna>;
  commitOutline(projectId: number, dna: InsertBookDna, newChapters: InsertChapter[]): Promise<{ dna: BookDna; chapters: Chapter[]; project: Project }>;

  getTrendReports(vertical?: string): Promise<TrendReport[]>;
  getTrendReportByProject(projectId: number): Promise<TrendReport | undefined>;
  createTrendReport(data: InsertTrendReport): Promise<TrendReport>;

  deleteChaptersByProject(projectId: number): Promise<void>;
  replaceOutlineChapters(projectId: number, newChapters: InsertChapter[]): Promise<Chapter[]>;
  getChapters(projectId: number): Promise<Chapter[]>;
  getChapter(id: number): Promise<Chapter | undefined>;
  createChapter(data: InsertChapter): Promise<Chapter>;
  updateChapter(id: number, data: Partial<InsertChapter>): Promise<Chapter>;

  getRunSteps(projectId: number): Promise<RunStep[]>;
  createRunStep(data: InsertRunStep): Promise<RunStep>;
  updateRunStep(id: number, data: Partial<InsertRunStep>): Promise<RunStep>;

  getMarketingAsset(projectId: number): Promise<MarketingAsset | undefined>;
  upsertMarketingAsset(data: InsertMarketingAsset): Promise<MarketingAsset>;

  getAutopilotConfig(): Promise<AutopilotConfig | undefined>;
  upsertAutopilotConfig(data: InsertAutopilotConfig): Promise<AutopilotConfig>;

  getAutopilotRuns(): Promise<AutopilotRun[]>;
  createAutopilotRun(data: InsertAutopilotRun): Promise<AutopilotRun>;
  updateAutopilotRun(id: number, data: Partial<AutopilotRun>): Promise<AutopilotRun>;

  getInviteTokens(): Promise<InviteToken[]>;
  getInviteByToken(token: string): Promise<InviteToken | undefined>;
  createInviteToken(data: InsertInviteToken): Promise<InviteToken>;
  deleteInviteToken(id: number): Promise<void>;
  incrementInviteViewCount(id: number): Promise<void>;

  getAppSettings(): Promise<AppSettings | undefined>;
  upsertAppSettings(data: InsertAppSettings): Promise<AppSettings>;

  getChatConversations(): Promise<ChatConversation[]>;
  getChatConversation(id: number): Promise<ChatConversation | undefined>;
  createChatConversation(data: InsertChatConversation): Promise<ChatConversation>;
  updateChatConversation(id: number, data: Partial<InsertChatConversation>): Promise<ChatConversation>;
  deleteChatConversation(id: number): Promise<void>;
  getChatMessages(conversationId: number): Promise<ChatMessage[]>;
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;

  getBookRequests(): Promise<BookRequest[]>;
  createBookRequest(data: InsertBookRequest): Promise<BookRequest>;
  markBookRequestRead(id: number): Promise<void>;
  deleteBookRequest(id: number): Promise<void>;

  getStorefrontReader(id: number): Promise<StorefrontReader | undefined>;
  getStorefrontReaderByEmail(email: string): Promise<StorefrontReader | undefined>;
  createStorefrontReader(data: InsertStorefrontReader): Promise<StorefrontReader>;

  getSeriesList(): Promise<Series[]>;
  getSeries(id: number): Promise<Series | undefined>;
  createSeries(data: InsertSeries): Promise<Series>;
  updateSeries(id: number, data: Partial<InsertSeries>): Promise<Series>;
  deleteSeries(id: number): Promise<void>;

  getStyleFingerprints(): Promise<StyleFingerprint[]>;
  getStyleFingerprint(id: number): Promise<StyleFingerprint | undefined>;
  createStyleFingerprint(data: InsertStyleFingerprint): Promise<StyleFingerprint>;
  deleteStyleFingerprint(id: number): Promise<void>;

  getBrandKits(): Promise<BrandKit[]>;
  getBrandKit(id: number): Promise<BrandKit | undefined>;
  createBrandKit(data: InsertBrandKit): Promise<BrandKit>;
  updateBrandKit(id: number, data: Partial<InsertBrandKit>): Promise<BrandKit>;
  deleteBrandKit(id: number): Promise<void>;

  getStoryEntities(opts: { projectId?: number; seriesId?: number }): Promise<StoryEntity[]>;
  createStoryEntity(data: InsertStoryEntity): Promise<StoryEntity>;
  updateStoryEntity(id: number, data: Partial<InsertStoryEntity>): Promise<StoryEntity>;
  deleteStoryEntity(id: number): Promise<void>;

  getChapterAnalyses(projectId: number, chapterId?: number): Promise<ChapterAnalysis[]>;
  createChapterAnalysis(data: InsertChapterAnalysis): Promise<ChapterAnalysis>;

  getMarketReports(projectId?: number): Promise<MarketReport[]>;
  createMarketReport(data: InsertMarketReport): Promise<MarketReport>;

  getRevenueForecasts(projectId: number): Promise<RevenueForecast[]>;
  createRevenueForecast(data: InsertRevenueForecast): Promise<RevenueForecast>;

  getAbTests(projectId: number): Promise<AbTest[]>;
  createAbTest(data: InsertAbTest): Promise<AbTest>;
  updateAbTest(id: number, data: Partial<InsertAbTest>): Promise<AbTest>;

  getAnalyticsEvents(projectId?: number): Promise<AnalyticsEvent[]>;
  createAnalyticsEvent(data: InsertAnalyticsEvent): Promise<AnalyticsEvent>;

  getCoverVariants(projectId: number): Promise<CoverVariant[]>;
  createCoverVariant(data: InsertCoverVariant): Promise<CoverVariant>;
  selectCoverVariant(projectId: number, id: number): Promise<void>;
  deleteCoverVariant(id: number): Promise<void>;

  getExportJobs(projectId: number): Promise<ExportJob[]>;
  createExportJob(data: InsertExportJob): Promise<ExportJob>;
  updateExportJob(id: number, data: Partial<InsertExportJob>): Promise<ExportJob>;

  getMembershipTiers(): Promise<MembershipTier[]>;
  createMembershipTier(data: InsertMembershipTier): Promise<MembershipTier>;
  updateMembershipTier(id: number, data: Partial<InsertMembershipTier>): Promise<MembershipTier>;

  getReaderMemberships(readerId: number): Promise<ReaderMembership[]>;
  createReaderMembership(data: InsertReaderMembership): Promise<ReaderMembership>;
  updateReaderMembership(id: number, data: Partial<InsertReaderMembership>): Promise<ReaderMembership>;

  getStorefrontOrders(): Promise<StorefrontOrder[]>;
  createStorefrontOrder(data: InsertStorefrontOrder): Promise<StorefrontOrder>;
  updateStorefrontOrder(id: number, data: Partial<InsertStorefrontOrder>): Promise<StorefrontOrder>;

  getReferrals(): Promise<Referral[]>;
  getReferralByCode(code: string): Promise<Referral | undefined>;
  createReferral(data: InsertReferral): Promise<Referral>;
  updateReferral(id: number, data: Partial<Referral>): Promise<Referral>;
  incrementReferralClick(id: number): Promise<void>;
  deleteReferral(id: number): Promise<void>;

  getLaunchSchedules(projectId: number): Promise<LaunchSchedule[]>;
  createLaunchSchedule(data: InsertLaunchSchedule): Promise<LaunchSchedule>;
  updateLaunchSchedule(id: number, data: Partial<InsertLaunchSchedule>): Promise<LaunchSchedule>;

  getMediaAssets(projectId: number): Promise<MediaAsset[]>;
  getMediaAsset(id: number): Promise<MediaAsset | undefined>;
  createMediaAsset(data: InsertMediaAsset): Promise<MediaAsset>;
  updateMediaAsset(id: number, data: Partial<InsertMediaAsset>): Promise<MediaAsset>;
  deleteMediaAsset(id: number): Promise<void>;

  getNotifications(): Promise<Notification[]>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  getBookEditions(projectId: number): Promise<BookEdition[]>;
  getBookEdition(id: number): Promise<BookEdition | undefined>;
  createBookEdition(data: InsertBookEdition): Promise<BookEdition>;
  updateBookEdition(id: number, data: Partial<InsertBookEdition>): Promise<BookEdition>;
  getEditionChapters(editionId: number): Promise<EditionChapter[]>;
  getEditionChapter(id: number): Promise<EditionChapter | undefined>;
  createEditionChapter(data: InsertEditionChapter): Promise<EditionChapter>;
  updateEditionChapter(id: number, data: Partial<InsertEditionChapter>): Promise<EditionChapter>;
  deleteEditionChapters(editionId: number): Promise<void>;
  replaceEditionChapters(editionId: number, chapters: Omit<InsertEditionChapter, "editionId">[]): Promise<void>;

  getWorkspaceMembers(): Promise<WorkspaceMember[]>;
  createWorkspaceMember(data: InsertWorkspaceMember): Promise<WorkspaceMember>;
  updateWorkspaceMember(id: number, data: Partial<InsertWorkspaceMember>): Promise<WorkspaceMember>;
  deleteWorkspaceMember(id: number): Promise<void>;

  getChapterComments(chapterId: number): Promise<ChapterComment[]>;
  createChapterComment(data: InsertChapterComment): Promise<ChapterComment>;
  updateChapterComment(id: number, data: Partial<ChapterComment>): Promise<ChapterComment>;
  deleteChapterComment(id: number): Promise<void>;

  getChapterVersions(chapterId: number): Promise<ChapterVersion[]>;
  getChapterVersion(id: number): Promise<ChapterVersion | undefined>;
  createChapterVersion(data: InsertChapterVersion): Promise<ChapterVersion>;

  getAudioTracks(projectId: number): Promise<AudioTrack[]>;
  getAudioTracksByChapter(chapterId: number): Promise<AudioTrack[]>;
  findAudioTrack(opts: { projectId: number; scope: string; chapterId: number | null; pageIndex: number | null; voiceId: string }): Promise<AudioTrack | undefined>;
  getProjectsWithAudio(): Promise<number[]>;
  upsertAudioTrack(data: InsertAudioTrack): Promise<AudioTrack>;
  deleteAudioTrack(id: number): Promise<void>;

  getDashboardStats(): Promise<{
    totalProjects: number;
    completedProjects: number;
    totalWords: number;
    totalCost: number;
    avgQuality: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser) {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserPassword(id: string, password: string) {
    await db.update(users).set({ password }).where(eq(users.id, id));
  }

  async getProjects() {
    return db.select().from(projects).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: number) {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject) {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, data: Partial<InsertProject> & { publishedToStore?: boolean }) {
    const [updated] = await db.update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: number) {
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getBookDna(projectId: number) {
    const [dna] = await db.select().from(bookDna).where(eq(bookDna.projectId, projectId));
    return dna;
  }

  async upsertBookDna(data: InsertBookDna) {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(bookDna).where(eq(bookDna.projectId, data.projectId));
      if (existing) {
        const [updated] = await tx.update(bookDna).set(data).where(eq(bookDna.id, existing.id)).returning();
        return updated;
      }
      const [created] = await tx.insert(bookDna).values(data).returning();
      return created;
    });
  }

  async commitOutline(projectId: number, dnaData: InsertBookDna, newChapters: InsertChapter[]) {
    return db.transaction(async (tx) => {
      const [existingDna] = await tx.select().from(bookDna).where(eq(bookDna.projectId, projectId));
      let savedDna: BookDna;
      if (existingDna) {
        const [updatedDna] = await tx.update(bookDna)
          .set(dnaData)
          .where(eq(bookDna.id, existingDna.id))
          .returning();
        savedDna = updatedDna;
      } else {
        const [createdDna] = await tx.insert(bookDna).values(dnaData).returning();
        savedDna = createdDna;
      }

      await tx.delete(chapters).where(eq(chapters.projectId, projectId));
      const createdChapters = newChapters.length > 0
        ? await tx.insert(chapters).values(newChapters).returning()
        : [];

      const [updatedProject] = await tx.update(projects)
        .set({ chapterCount: createdChapters.length, status: "writing" })
        .where(eq(projects.id, projectId))
        .returning();

      if (!updatedProject) throw new Error("Project disappeared while committing outline");
      return { dna: savedDna, chapters: createdChapters, project: updatedProject };
    });
  }

  async getTrendReports(vertical?: string) {
    if (vertical) {
      return db.select().from(trendReports).where(eq(trendReports.vertical, vertical)).orderBy(desc(trendReports.createdAt));
    }
    return db.select().from(trendReports).orderBy(desc(trendReports.createdAt));
  }

  async getTrendReportByProject(projectId: number) {
    const [report] = await db.select().from(trendReports).where(eq(trendReports.projectId, projectId));
    return report;
  }

  async createTrendReport(data: InsertTrendReport) {
    const [created] = await db.insert(trendReports).values(data).returning();
    return created;
  }

  async deleteChaptersByProject(projectId: number) {
    await db.delete(chapters).where(eq(chapters.projectId, projectId));
  }

  async replaceOutlineChapters(projectId: number, newChapters: InsertChapter[]): Promise<Chapter[]> {
    return db.transaction(async (tx) => {
      await tx.delete(chapters).where(eq(chapters.projectId, projectId));
      const created: Chapter[] = [];
      for (const ch of newChapters) {
        const [row] = await tx.insert(chapters).values(ch).returning();
        created.push(row);
      }
      return created;
    });
  }

  async getChapters(projectId: number) {
    return db.select().from(chapters).where(eq(chapters.projectId, projectId)).orderBy(chapters.chapterNumber);
  }

  async getChapter(id: number) {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
    return chapter;
  }

  async createChapter(data: InsertChapter) {
    const [created] = await db.insert(chapters).values(data).returning();
    return created;
  }

  async updateChapter(id: number, data: Partial<InsertChapter>) {
    const [updated] = await db.update(chapters).set({ ...data, updatedAt: new Date() }).where(eq(chapters.id, id)).returning();
    return updated;
  }

  async getRunSteps(projectId: number) {
    return db.select().from(runSteps).where(eq(runSteps.projectId, projectId)).orderBy(desc(runSteps.createdAt));
  }

  async createRunStep(data: InsertRunStep) {
    const [created] = await db.insert(runSteps).values(data).returning();
    return created;
  }

  async updateRunStep(id: number, data: Partial<InsertRunStep>) {
    const [updated] = await db.update(runSteps).set(data).where(eq(runSteps.id, id)).returning();
    return updated;
  }

  async getMarketingAsset(projectId: number) {
    const [asset] = await db.select().from(marketingAssets).where(eq(marketingAssets.projectId, projectId));
    return asset;
  }

  async upsertMarketingAsset(data: InsertMarketingAsset) {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(marketingAssets).where(eq(marketingAssets.projectId, data.projectId));
      if (existing) {
        const [updated] = await tx.update(marketingAssets).set(data).where(eq(marketingAssets.id, existing.id)).returning();
        return updated;
      }
      const [created] = await tx.insert(marketingAssets).values(data).returning();
      return created;
    });
  }

  async getAutopilotConfig() {
    const [config] = await db.select().from(autopilotConfig);
    return config;
  }

  async upsertAutopilotConfig(data: InsertAutopilotConfig) {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(autopilotConfig);
      if (existing) {
        const [updated] = await tx.update(autopilotConfig).set({ ...data, updatedAt: new Date() }).where(eq(autopilotConfig.id, existing.id)).returning();
        return updated;
      }
      const [created] = await tx.insert(autopilotConfig).values(data).returning();
      return created;
    });
  }

  async getAutopilotRuns() {
    return db.select().from(autopilotRuns).orderBy(desc(autopilotRuns.startedAt)).limit(20);
  }

  async createAutopilotRun(data: InsertAutopilotRun) {
    const [created] = await db.insert(autopilotRuns).values(data).returning();
    return created;
  }

  async updateAutopilotRun(id: number, data: Partial<AutopilotRun>) {
    const [updated] = await db.update(autopilotRuns).set(data).where(eq(autopilotRuns.id, id)).returning();
    return updated;
  }

  async getInviteTokens() {
    return db.select().from(inviteTokens).orderBy(desc(inviteTokens.createdAt));
  }

  async getInviteByToken(token: string) {
    const [invite] = await db.select().from(inviteTokens).where(eq(inviteTokens.token, token));
    return invite;
  }

  async createInviteToken(data: InsertInviteToken) {
    const [created] = await db.insert(inviteTokens).values(data).returning();
    return created;
  }

  async deleteInviteToken(id: number) {
    await db.delete(inviteTokens).where(eq(inviteTokens.id, id));
  }

  async incrementInviteViewCount(id: number) {
    await db.update(inviteTokens).set({ viewCount: sql`${inviteTokens.viewCount} + 1` }).where(eq(inviteTokens.id, id));
  }

  async getAppSettings() {
    const [settings] = await db.select().from(appSettings);
    return settings;
  }

  async upsertAppSettings(data: InsertAppSettings) {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select().from(appSettings);
      if (existing) {
        const [updated] = await tx.update(appSettings).set({ ...data, updatedAt: new Date() }).where(eq(appSettings.id, existing.id)).returning();
        return updated;
      }
      const [created] = await tx.insert(appSettings).values(data).returning();
      return created;
    });
  }

  async getChatConversations() {
    return db.select().from(chatConversations).orderBy(desc(chatConversations.updatedAt));
  }

  async getChatConversation(id: number) {
    const [conv] = await db.select().from(chatConversations).where(eq(chatConversations.id, id));
    return conv;
  }

  async createChatConversation(data: InsertChatConversation) {
    const [created] = await db.insert(chatConversations).values(data).returning();
    return created;
  }

  async updateChatConversation(id: number, data: Partial<InsertChatConversation>) {
    const [updated] = await db.update(chatConversations).set({ ...data, updatedAt: new Date() }).where(eq(chatConversations.id, id)).returning();
    return updated;
  }

  async deleteChatConversation(id: number) {
    await db.delete(chatConversations).where(eq(chatConversations.id, id));
  }

  async getChatMessages(conversationId: number) {
    return db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.createdAt);
  }

  async createChatMessage(data: InsertChatMessage) {
    const [created] = await db.insert(chatMessages).values(data).returning();
    return created;
  }

  async getBookRequests() {
    return db.select().from(bookRequests).orderBy(desc(bookRequests.createdAt));
  }

  async createBookRequest(data: InsertBookRequest) {
    const [request] = await db.insert(bookRequests).values(data).returning();
    return request;
  }

  async markBookRequestRead(id: number) {
    await db.update(bookRequests).set({ isRead: true }).where(eq(bookRequests.id, id));
  }

  async deleteBookRequest(id: number) {
    await db.delete(bookRequests).where(eq(bookRequests.id, id));
  }

  async getStorefrontReader(id: number) {
    const [reader] = await db.select().from(storefrontReaders).where(eq(storefrontReaders.id, id));
    return reader;
  }

  async getStorefrontReaderByEmail(email: string) {
    const [reader] = await db.select().from(storefrontReaders).where(eq(storefrontReaders.email, email));
    return reader;
  }

  async createStorefrontReader(data: InsertStorefrontReader) {
    const [created] = await db.insert(storefrontReaders).values(data).returning();
    return created;
  }

  async getSeriesList() {
    return db.select().from(series).orderBy(desc(series.updatedAt));
  }
  async getSeries(id: number) {
    const [row] = await db.select().from(series).where(eq(series.id, id));
    return row;
  }
  async createSeries(data: InsertSeries) {
    const [created] = await db.insert(series).values(data).returning();
    return created;
  }
  async updateSeries(id: number, data: Partial<InsertSeries>) {
    const [updated] = await db.update(series).set({ ...data, updatedAt: new Date() }).where(eq(series.id, id)).returning();
    return updated;
  }
  async deleteSeries(id: number) {
    await db.delete(series).where(eq(series.id, id));
  }

  async getStyleFingerprints() {
    return db.select().from(styleFingerprints).orderBy(desc(styleFingerprints.createdAt));
  }
  async getStyleFingerprint(id: number) {
    const [row] = await db.select().from(styleFingerprints).where(eq(styleFingerprints.id, id));
    return row;
  }
  async createStyleFingerprint(data: InsertStyleFingerprint) {
    const [created] = await db.insert(styleFingerprints).values(data).returning();
    return created;
  }
  async deleteStyleFingerprint(id: number) {
    await db.delete(styleFingerprints).where(eq(styleFingerprints.id, id));
  }

  async getBrandKits() {
    return db.select().from(brandKits).orderBy(desc(brandKits.updatedAt));
  }
  async getBrandKit(id: number) {
    const [row] = await db.select().from(brandKits).where(eq(brandKits.id, id));
    return row;
  }
  async createBrandKit(data: InsertBrandKit) {
    const [created] = await db.insert(brandKits).values(data).returning();
    return created;
  }
  async updateBrandKit(id: number, data: Partial<InsertBrandKit>) {
    const [updated] = await db.update(brandKits).set({ ...data, updatedAt: new Date() }).where(eq(brandKits.id, id)).returning();
    return updated;
  }
  async deleteBrandKit(id: number) {
    await db.delete(brandKits).where(eq(brandKits.id, id));
  }

  async getStoryEntities(opts: { projectId?: number; seriesId?: number }) {
    if (opts.projectId !== undefined) {
      return db.select().from(storyEntities).where(eq(storyEntities.projectId, opts.projectId)).orderBy(storyEntities.name);
    }
    if (opts.seriesId !== undefined) {
      return db.select().from(storyEntities).where(eq(storyEntities.seriesId, opts.seriesId)).orderBy(storyEntities.name);
    }
    return db.select().from(storyEntities).orderBy(storyEntities.name);
  }
  async createStoryEntity(data: InsertStoryEntity) {
    const [created] = await db.insert(storyEntities).values(data).returning();
    return created;
  }
  async updateStoryEntity(id: number, data: Partial<InsertStoryEntity>) {
    const [updated] = await db.update(storyEntities).set({ ...data, updatedAt: new Date() }).where(eq(storyEntities.id, id)).returning();
    return updated;
  }
  async deleteStoryEntity(id: number) {
    await db.delete(storyEntities).where(eq(storyEntities.id, id));
  }

  async getChapterAnalyses(projectId: number, chapterId?: number) {
    if (chapterId !== undefined) {
      return db.select().from(chapterAnalyses)
        .where(and(eq(chapterAnalyses.projectId, projectId), eq(chapterAnalyses.chapterId, chapterId)))
        .orderBy(desc(chapterAnalyses.createdAt));
    }
    return db.select().from(chapterAnalyses).where(eq(chapterAnalyses.projectId, projectId)).orderBy(desc(chapterAnalyses.createdAt));
  }
  async createChapterAnalysis(data: InsertChapterAnalysis) {
    const [created] = await db.insert(chapterAnalyses).values(data).returning();
    return created;
  }

  async getMarketReports(projectId?: number) {
    if (projectId !== undefined) {
      return db.select().from(marketReports).where(eq(marketReports.projectId, projectId)).orderBy(desc(marketReports.createdAt));
    }
    return db.select().from(marketReports).orderBy(desc(marketReports.createdAt));
  }
  async createMarketReport(data: InsertMarketReport) {
    const [created] = await db.insert(marketReports).values(data).returning();
    return created;
  }

  async getRevenueForecasts(projectId: number) {
    return db.select().from(revenueForecasts).where(eq(revenueForecasts.projectId, projectId)).orderBy(desc(revenueForecasts.createdAt));
  }
  async createRevenueForecast(data: InsertRevenueForecast) {
    const [created] = await db.insert(revenueForecasts).values(data).returning();
    return created;
  }

  async getAbTests(projectId: number) {
    return db.select().from(abTests).where(eq(abTests.projectId, projectId)).orderBy(desc(abTests.createdAt));
  }
  async createAbTest(data: InsertAbTest) {
    const [created] = await db.insert(abTests).values(data).returning();
    return created;
  }
  async updateAbTest(id: number, data: Partial<InsertAbTest>) {
    const [updated] = await db.update(abTests).set(data).where(eq(abTests.id, id)).returning();
    return updated;
  }

  async getAnalyticsEvents(projectId?: number) {
    if (projectId !== undefined) {
      return db.select().from(analyticsEvents).where(eq(analyticsEvents.projectId, projectId)).orderBy(desc(analyticsEvents.createdAt));
    }
    return db.select().from(analyticsEvents).orderBy(desc(analyticsEvents.createdAt));
  }
  async createAnalyticsEvent(data: InsertAnalyticsEvent) {
    const [created] = await db.insert(analyticsEvents).values(data).returning();
    return created;
  }

  async getCoverVariants(projectId: number) {
    return db.select().from(coverVariants).where(eq(coverVariants.projectId, projectId)).orderBy(desc(coverVariants.createdAt));
  }
  async createCoverVariant(data: InsertCoverVariant) {
    const [created] = await db.insert(coverVariants).values(data).returning();
    return created;
  }
  async selectCoverVariant(projectId: number, id: number) {
    await db.transaction(async (tx) => {
      await tx.update(coverVariants).set({ isSelected: false }).where(eq(coverVariants.projectId, projectId));
      await tx.update(coverVariants).set({ isSelected: true }).where(eq(coverVariants.id, id));
    });
  }
  async deleteCoverVariant(id: number) {
    await db.delete(coverVariants).where(eq(coverVariants.id, id));
  }

  async getExportJobs(projectId: number) {
    return db.select().from(exportJobs).where(eq(exportJobs.projectId, projectId)).orderBy(desc(exportJobs.createdAt));
  }
  async createExportJob(data: InsertExportJob) {
    const [created] = await db.insert(exportJobs).values(data).returning();
    return created;
  }
  async updateExportJob(id: number, data: Partial<InsertExportJob>) {
    const [updated] = await db.update(exportJobs).set(data).where(eq(exportJobs.id, id)).returning();
    return updated;
  }

  async getMembershipTiers() {
    return db.select().from(membershipTiers).orderBy(membershipTiers.priceUsd);
  }
  async createMembershipTier(data: InsertMembershipTier) {
    const [created] = await db.insert(membershipTiers).values(data).returning();
    return created;
  }
  async updateMembershipTier(id: number, data: Partial<InsertMembershipTier>) {
    const [updated] = await db.update(membershipTiers).set(data).where(eq(membershipTiers.id, id)).returning();
    return updated;
  }

  async getReaderMemberships(readerId: number) {
    return db.select().from(readerMemberships).where(eq(readerMemberships.readerId, readerId)).orderBy(desc(readerMemberships.createdAt));
  }
  async createReaderMembership(data: InsertReaderMembership) {
    const [created] = await db.insert(readerMemberships).values(data).returning();
    return created;
  }
  async updateReaderMembership(id: number, data: Partial<InsertReaderMembership>) {
    const [updated] = await db.update(readerMemberships).set(data).where(eq(readerMemberships.id, id)).returning();
    return updated;
  }

  async getStorefrontOrders() {
    return db.select().from(storefrontOrders).orderBy(desc(storefrontOrders.createdAt));
  }
  async createStorefrontOrder(data: InsertStorefrontOrder) {
    const [created] = await db.insert(storefrontOrders).values(data).returning();
    return created;
  }
  async updateStorefrontOrder(id: number, data: Partial<InsertStorefrontOrder>) {
    const [updated] = await db.update(storefrontOrders).set(data).where(eq(storefrontOrders.id, id)).returning();
    return updated;
  }

  async getReferrals() {
    return db.select().from(referrals).orderBy(desc(referrals.createdAt));
  }
  async getReferralByCode(code: string) {
    const [row] = await db.select().from(referrals).where(eq(referrals.code, code));
    return row;
  }
  async createReferral(data: InsertReferral) {
    const [created] = await db.insert(referrals).values(data).returning();
    return created;
  }
  async updateReferral(id: number, data: Partial<Referral>) {
    const [updated] = await db.update(referrals).set(data).where(eq(referrals.id, id)).returning();
    return updated;
  }
  async incrementReferralClick(id: number) {
    await db.update(referrals).set({ clicks: sql`${referrals.clicks} + 1` }).where(eq(referrals.id, id));
  }
  async deleteReferral(id: number) {
    await db.delete(referrals).where(eq(referrals.id, id));
  }

  async getLaunchSchedules(projectId: number) {
    return db.select().from(launchSchedules).where(eq(launchSchedules.projectId, projectId)).orderBy(desc(launchSchedules.createdAt));
  }
  async createLaunchSchedule(data: InsertLaunchSchedule) {
    const [created] = await db.insert(launchSchedules).values(data).returning();
    return created;
  }
  async updateLaunchSchedule(id: number, data: Partial<InsertLaunchSchedule>) {
    const [updated] = await db.update(launchSchedules).set(data).where(eq(launchSchedules.id, id)).returning();
    return updated;
  }

  async getMediaAssets(projectId: number) {
    return db.select().from(mediaAssets).where(eq(mediaAssets.projectId, projectId)).orderBy(desc(mediaAssets.createdAt));
  }
  async getMediaAsset(id: number) {
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    return asset;
  }
  async createMediaAsset(data: InsertMediaAsset) {
    const [created] = await db.insert(mediaAssets).values(data).returning();
    return created;
  }
  async updateMediaAsset(id: number, data: Partial<InsertMediaAsset>) {
    const [updated] = await db.update(mediaAssets).set(data).where(eq(mediaAssets.id, id)).returning();
    return updated;
  }
  async deleteMediaAsset(id: number) {
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  }

  async getNotifications() {
    return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100);
  }
  async createNotification(data: InsertNotification) {
    const [created] = await db.insert(notifications).values(data).returning();
    return created;
  }
  async markNotificationRead(id: number) {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }
  async markAllNotificationsRead() {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
  }

  async getBookEditions(projectId: number) {
    return db.select().from(bookEditions).where(eq(bookEditions.projectId, projectId)).orderBy(desc(bookEditions.createdAt));
  }
  async getBookEdition(id: number) {
    const [edition] = await db.select().from(bookEditions).where(eq(bookEditions.id, id));
    return edition;
  }
  async createBookEdition(data: InsertBookEdition) {
    const [created] = await db.insert(bookEditions).values(data).returning();
    return created;
  }
  async updateBookEdition(id: number, data: Partial<InsertBookEdition>) {
    const [updated] = await db.update(bookEditions).set(data).where(eq(bookEditions.id, id)).returning();
    return updated;
  }
  async getEditionChapters(editionId: number) {
    return db.select().from(editionChapters).where(eq(editionChapters.editionId, editionId)).orderBy(editionChapters.chapterNumber);
  }
  async getEditionChapter(id: number) {
    const [chapter] = await db.select().from(editionChapters).where(eq(editionChapters.id, id));
    return chapter;
  }
  async createEditionChapter(data: InsertEditionChapter) {
    const [created] = await db.insert(editionChapters).values(data).returning();
    return created;
  }
  async updateEditionChapter(id: number, data: Partial<InsertEditionChapter>) {
    const [updated] = await db.update(editionChapters).set(data).where(eq(editionChapters.id, id)).returning();
    return updated;
  }
  async deleteEditionChapters(editionId: number) {
    await db.delete(editionChapters).where(eq(editionChapters.editionId, editionId));
  }
  async replaceEditionChapters(editionId: number, chapters: Omit<InsertEditionChapter, "editionId">[]) {
    await db.transaction(async (tx) => {
      await tx.delete(editionChapters).where(eq(editionChapters.editionId, editionId));
      if (chapters.length > 0) {
        await tx.insert(editionChapters).values(chapters.map((chapter) => ({ ...chapter, editionId })));
      }
    });
  }

  async getWorkspaceMembers() {
    return db.select().from(workspaceMembers).orderBy(desc(workspaceMembers.createdAt));
  }
  async createWorkspaceMember(data: InsertWorkspaceMember) {
    const [created] = await db.insert(workspaceMembers).values(data).returning();
    return created;
  }
  async updateWorkspaceMember(id: number, data: Partial<InsertWorkspaceMember>) {
    const [updated] = await db.update(workspaceMembers).set(data).where(eq(workspaceMembers.id, id)).returning();
    return updated;
  }
  async deleteWorkspaceMember(id: number) {
    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, id));
  }

  async getChapterComments(chapterId: number) {
    return db.select().from(chapterComments).where(eq(chapterComments.chapterId, chapterId)).orderBy(chapterComments.createdAt);
  }
  async createChapterComment(data: InsertChapterComment) {
    const [created] = await db.insert(chapterComments).values(data).returning();
    return created;
  }
  async updateChapterComment(id: number, data: Partial<ChapterComment>) {
    const [updated] = await db.update(chapterComments).set(data).where(eq(chapterComments.id, id)).returning();
    return updated;
  }
  async deleteChapterComment(id: number) {
    await db.delete(chapterComments).where(eq(chapterComments.id, id));
  }

  async getChapterVersions(chapterId: number) {
    return db.select().from(chapterVersions).where(eq(chapterVersions.chapterId, chapterId)).orderBy(desc(chapterVersions.createdAt));
  }
  async getChapterVersion(id: number) {
    const [row] = await db.select().from(chapterVersions).where(eq(chapterVersions.id, id));
    return row;
  }
  async createChapterVersion(data: InsertChapterVersion) {
    const [created] = await db.insert(chapterVersions).values(data).returning();
    return created;
  }

  async getAudioTracks(projectId: number) {
    return db.select().from(audioTracks).where(eq(audioTracks.projectId, projectId)).orderBy(audioTracks.chapterId, audioTracks.pageIndex);
  }
  async getAudioTracksByChapter(chapterId: number) {
    return db.select().from(audioTracks).where(eq(audioTracks.chapterId, chapterId)).orderBy(audioTracks.pageIndex);
  }
  async findAudioTrack(opts: { projectId: number; scope: string; chapterId: number | null; pageIndex: number | null; voiceId: string }) {
    const conds = [
      eq(audioTracks.projectId, opts.projectId),
      eq(audioTracks.scope, opts.scope),
      eq(audioTracks.voiceId, opts.voiceId),
      opts.chapterId === null ? sql`${audioTracks.chapterId} is null` : eq(audioTracks.chapterId, opts.chapterId),
      opts.pageIndex === null ? sql`${audioTracks.pageIndex} is null` : eq(audioTracks.pageIndex, opts.pageIndex),
    ];
    const [row] = await db.select().from(audioTracks).where(and(...conds));
    return row;
  }
  async getProjectsWithAudio() {
    const rows = await db.selectDistinct({ projectId: audioTracks.projectId }).from(audioTracks);
    return rows.map((r) => r.projectId);
  }
  async upsertAudioTrack(data: InsertAudioTrack) {
    return db.transaction(async (tx) => {
      const conds = [
        eq(audioTracks.projectId, data.projectId),
        eq(audioTracks.scope, data.scope ?? "chapter"),
        eq(audioTracks.voiceId, data.voiceId),
        data.chapterId == null ? sql`${audioTracks.chapterId} is null` : eq(audioTracks.chapterId, data.chapterId),
        data.pageIndex == null ? sql`${audioTracks.pageIndex} is null` : eq(audioTracks.pageIndex, data.pageIndex),
      ];
      const [existing] = await tx.select().from(audioTracks).where(and(...conds));
      if (existing) {
        const [updated] = await tx.update(audioTracks).set(data).where(eq(audioTracks.id, existing.id)).returning();
        return updated;
      }
      const [created] = await tx.insert(audioTracks).values(data).returning();
      return created;
    });
  }
  async deleteAudioTrack(id: number) {
    await db.delete(audioTracks).where(eq(audioTracks.id, id));
  }

  async getStudioProperties(): Promise<StudioProperty[]> {
    return db.select().from(studioProperties).orderBy(desc(studioProperties.updatedAt));
  }

  async getStudioProperty(id: string): Promise<StudioProperty | undefined> {
    const [property] = await db.select().from(studioProperties).where(eq(studioProperties.id, id));
    return property;
  }

  async getStudioPropertyByProject(projectId: number): Promise<StudioProperty | undefined> {
    const rows = await db
      .select({ property: studioProperties })
      .from(propertyProjects)
      .innerJoin(studioProperties, eq(propertyProjects.propertyId, studioProperties.id))
      .where(eq(propertyProjects.projectId, projectId))
      .limit(1);
    return rows[0]?.property;
  }

  async createStudioProperty(data: InsertStudioProperty): Promise<StudioProperty> {
    const [created] = await db.insert(studioProperties).values(data).returning();
    return created;
  }

  async updateStudioProperty(id: string, data: Partial<InsertStudioProperty>): Promise<StudioProperty> {
    const [updated] = await db
      .update(studioProperties)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(studioProperties.id, id))
      .returning();
    return updated;
  }

  async linkProjectToProperty(data: InsertPropertyProject): Promise<PropertyProject> {
    const [linked] = await db
      .insert(propertyProjects)
      .values(data)
      .onConflictDoUpdate({
        target: propertyProjects.projectId,
        set: {
          propertyId: data.propertyId,
          relation: data.relation ?? "book",
          isPrimary: data.isPrimary ?? true,
        },
      })
      .returning();
    return linked;
  }

  async createStudioPropertyWithProjectLink(
    propertyData: InsertStudioProperty,
    linkData: Omit<InsertPropertyProject, "propertyId">,
  ): Promise<StudioProperty> {
    return db.transaction(async (tx) => {
      // Serialize legacy bridge creation per Project. This prevents concurrent
      // first-touch requests from creating orphan/duplicate Properties.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`property-project:${linkData.projectId}`}, 0))`,
      );

      const [existingLink] = await tx
        .select()
        .from(propertyProjects)
        .where(eq(propertyProjects.projectId, linkData.projectId));

      if (existingLink) {
        const [existingProperty] = await tx
          .select()
          .from(studioProperties)
          .where(eq(studioProperties.id, existingLink.propertyId));
        if (existingProperty) return existingProperty;
        throw new Error(`Property ${existingLink.propertyId} linked to Project ${linkData.projectId} was not found.`);
      }

      const [property] = await tx.insert(studioProperties).values(propertyData).returning();
      await tx.insert(propertyProjects).values({
        ...linkData,
        propertyId: property.id,
      }).returning();
      return property;
    });
  }

  async getPropertyProject(projectId: number): Promise<PropertyProject | undefined> {
    const [row] = await db.select().from(propertyProjects).where(eq(propertyProjects.projectId, projectId));
    return row;
  }

  async createCreativeArtifact(data: InsertCreativeArtifact): Promise<CreativeArtifactRow> {
    const [created] = await db.insert(creativeArtifacts).values(data).returning();
    return created;
  }

  async createCreativeArtifactWithAtomicVersion(
    data: Omit<InsertCreativeArtifact, "version"> & { version?: number },
  ): Promise<CreativeArtifactRow> {
    return db.transaction(async (tx) => {
      const streamId = [
        data.propertyId || "none",
        data.projectId ?? "none",
        data.chapterId ?? "none",
        data.type,
      ].join(":");

      const [stream] = await tx
        .insert(artifactStreams)
        .values({
          id: streamId,
          propertyId: data.propertyId ?? null,
          projectId: data.projectId ?? null,
          chapterId: data.chapterId ?? null,
          type: data.type,
          nextVersion: 1,
        })
        .onConflictDoNothing({ target: artifactStreams.id })
        .returning();

      const [lockedStream] = await tx
        .select()
        .from(artifactStreams)
        .where(eq(artifactStreams.id, stream?.id || streamId))
        .for("update");

      if (!lockedStream) {
        throw new Error(`Unable to initialize artifact stream for ${data.type}`);
      }

      const version = lockedStream.nextVersion;
      await tx
        .update(artifactStreams)
        .set({ nextVersion: version + 1, updatedAt: new Date() })
        .where(eq(artifactStreams.id, lockedStream.id));

      const [created] = await tx
        .insert(creativeArtifacts)
        .values({ ...data, version })
        .returning();
      return created;
    });
  }

  async getCreativeArtifacts(opts: { projectId?: number; propertyId?: string; chapterId?: number; state?: string }): Promise<CreativeArtifactRow[]> {
    const conditions = [];
    if (opts.projectId != null) conditions.push(eq(creativeArtifacts.projectId, opts.projectId));
    if (opts.propertyId != null) conditions.push(eq(creativeArtifacts.propertyId, opts.propertyId));
    if (opts.chapterId != null) conditions.push(eq(creativeArtifacts.chapterId, opts.chapterId));
    if (opts.state != null) conditions.push(eq(creativeArtifacts.state, opts.state));

    const query = db.select().from(creativeArtifacts);
    if (conditions.length === 0) return query.orderBy(desc(creativeArtifacts.createdAt));
    return query.where(and(...conditions)).orderBy(desc(creativeArtifacts.createdAt));
  }

  async updateCreativeArtifactState(id: string, state: string): Promise<CreativeArtifactRow | undefined> {
    if (state !== "canonical") {
      const [updated] = await db
        .update(creativeArtifacts)
        .set({ state })
        .where(eq(creativeArtifacts.id, id))
        .returning();
      return updated;
    }

    return db.transaction(async (tx) => {
      const [target] = await tx.select().from(creativeArtifacts).where(eq(creativeArtifacts.id, id));
      if (!target) return undefined;

      const scope = [
        eq(creativeArtifacts.type, target.type),
        eq(creativeArtifacts.state, "canonical"),
        target.projectId == null ? isNull(creativeArtifacts.projectId) : eq(creativeArtifacts.projectId, target.projectId),
        target.chapterId == null ? isNull(creativeArtifacts.chapterId) : eq(creativeArtifacts.chapterId, target.chapterId),
      ];

      await tx.update(creativeArtifacts)
        .set({ state: "superseded" })
        .where(and(...scope));

      const [updated] = await tx.update(creativeArtifacts)
        .set({ state: "canonical" })
        .where(eq(creativeArtifacts.id, id))
        .returning();
      return updated;
    });
  }

  async getContinuitySnapshot(projectId: number): Promise<ContinuitySnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(continuitySnapshots)
      .where(eq(continuitySnapshots.projectId, projectId));
    return snapshot;
  }

  async upsertContinuitySnapshot(data: InsertContinuitySnapshot): Promise<ContinuitySnapshot> {
    const [snapshot] = await db
      .insert(continuitySnapshots)
      .values(data)
      .onConflictDoUpdate({
        target: continuitySnapshots.projectId,
        set: {
          state: data.state,
          lastAcceptedChapterId: data.lastAcceptedChapterId ?? null,
          version: sql<number>`greatest(${continuitySnapshots.version} + 1, excluded.version)`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return snapshot;
  }

  async createConceptDossier(data: InsertConceptDossier): Promise<ConceptDossierRow> {
    const [created] = await db.insert(conceptDossiers).values(data).returning();
    return created;
  }

  async getConceptDossiers(propertyId?: string): Promise<ConceptDossierRow[]> {
    if (propertyId) {
      return db
        .select()
        .from(conceptDossiers)
        .where(eq(conceptDossiers.propertyId, propertyId))
        .orderBy(desc(conceptDossiers.createdAt));
    }
    return db.select().from(conceptDossiers).orderBy(desc(conceptDossiers.createdAt));
  }

  async getConceptDossier(id: string): Promise<ConceptDossierRow | undefined> {
    const [dossier] = await db.select().from(conceptDossiers).where(eq(conceptDossiers.id, id));
    return dossier;
  }

  async updateConceptDossier(id: string, data: Partial<InsertConceptDossier>): Promise<ConceptDossierRow | undefined> {
    const [updated] = await db
      .update(conceptDossiers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conceptDossiers.id, id))
      .returning();
    return updated;
  }

  async createTriadDraw(data: InsertTriadDraw): Promise<TriadDrawRow> {
    const [created] = await db.insert(triadDraws).values(data).returning();
    return created;
  }

  async getTriadDraws(limit = 50): Promise<TriadDrawRow[]> {
    return db.select().from(triadDraws).orderBy(desc(triadDraws.createdAt)).limit(limit);
  }

  async getTriadDraw(id: string): Promise<TriadDrawRow | undefined> {
    const [draw] = await db.select().from(triadDraws).where(eq(triadDraws.id, id));
    return draw;
  }

  async updateTriadDraw(id: string, data: Partial<InsertTriadDraw>): Promise<TriadDrawRow | undefined> {
    const [updated] = await db
      .update(triadDraws)
      .set(data)
      .where(eq(triadDraws.id, id))
      .returning();
    return updated;
  }

  async createConceptSynthesisRun(data: InsertConceptSynthesisRun): Promise<ConceptSynthesisRunRow> {
    const [created] = await db.insert(conceptSynthesisRuns).values(data).returning();
    return created;
  }

  async getConceptSynthesisRun(id: string): Promise<ConceptSynthesisRunRow | undefined> {
    const [run] = await db.select().from(conceptSynthesisRuns).where(eq(conceptSynthesisRuns.id, id));
    return run;
  }

  async getConceptSynthesisRuns(opts: { triadDrawId?: string; propertyId?: string; limit?: number } = {}): Promise<ConceptSynthesisRunRow[]> {
    const conditions = [];
    if (opts.triadDrawId) conditions.push(eq(conceptSynthesisRuns.triadDrawId, opts.triadDrawId));
    if (opts.propertyId) conditions.push(eq(conceptSynthesisRuns.propertyId, opts.propertyId));
    const query = db.select().from(conceptSynthesisRuns);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(conceptSynthesisRuns.createdAt)).limit(opts.limit ?? 25)
      : await query.orderBy(desc(conceptSynthesisRuns.createdAt)).limit(opts.limit ?? 25);
    return rows;
  }

  async updateConceptSynthesisRun(
    id: string,
    data: Partial<InsertConceptSynthesisRun>,
  ): Promise<ConceptSynthesisRunRow | undefined> {
    const [updated] = await db
      .update(conceptSynthesisRuns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conceptSynthesisRuns.id, id))
      .returning();
    return updated;
  }

  async getDashboardStats() {
    const result = await db.select({
      totalProjects: sql<number>`count(*)::int`,
      completedProjects: sql<number>`count(*) filter (where ${projects.status} = 'complete')::int`,
      activeProjects: sql<number>`count(*) filter (where ${projects.status} not in ('complete', 'failed'))::int`,
      totalWords: sql<number>`coalesce(sum(${projects.wordCount}), 0)::int`,
      totalCost: sql<number>`coalesce(sum(${projects.estimatedCost}), 0)::real`,
      costThisMonth: sql<number>`coalesce(sum(${projects.estimatedCost}) filter (where ${projects.createdAt} >= date_trunc('month', now())), 0)::real`,
      avgQuality: sql<number>`coalesce(avg(${projects.qualityScore}) filter (where ${projects.qualityScore} is not null), 0)::real`,
    }).from(projects);
    const row = result[0] || { totalProjects: 0, completedProjects: 0, activeProjects: 0, totalWords: 0, totalCost: 0, costThisMonth: 0, avgQuality: 0 };
    return row;
  }
}

export const storage = new DatabaseStorage();
