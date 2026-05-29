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
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  getBookDna(projectId: number): Promise<BookDna | undefined>;
  upsertBookDna(data: InsertBookDna): Promise<BookDna>;

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

  async updateProject(id: number, data: Partial<InsertProject>) {
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
