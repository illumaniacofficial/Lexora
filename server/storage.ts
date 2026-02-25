import { db } from "./db";
import {
  users, projects, bookDna, trendReports, chapters, runSteps, marketingAssets, autopilotConfig,
  type User, type InsertUser, type Project, type InsertProject, type BookDna, type InsertBookDna,
  type TrendReport, type InsertTrendReport, type Chapter, type InsertChapter,
  type RunStep, type InsertRunStep, type MarketingAsset, type InsertMarketingAsset,
  type AutopilotConfig, type InsertAutopilotConfig,
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
    const existing = await this.getBookDna(data.projectId);
    if (existing) {
      const [updated] = await db.update(bookDna).set(data).where(eq(bookDna.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(bookDna).values(data).returning();
    return created;
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
    const existing = await this.getMarketingAsset(data.projectId);
    if (existing) {
      const [updated] = await db.update(marketingAssets).set(data).where(eq(marketingAssets.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(marketingAssets).values(data).returning();
    return created;
  }

  async getAutopilotConfig() {
    const [config] = await db.select().from(autopilotConfig);
    return config;
  }

  async upsertAutopilotConfig(data: InsertAutopilotConfig) {
    const existing = await this.getAutopilotConfig();
    if (existing) {
      const [updated] = await db.update(autopilotConfig).set({ ...data, updatedAt: new Date() }).where(eq(autopilotConfig.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(autopilotConfig).values(data).returning();
    return created;
  }

  async getDashboardStats() {
    const allProjects = await db.select().from(projects);
    const totalProjects = allProjects.length;
    const completedProjects = allProjects.filter(p => p.status === "complete").length;
    const totalWords = allProjects.reduce((sum, p) => sum + p.wordCount, 0);
    const totalCost = allProjects.reduce((sum, p) => sum + p.estimatedCost, 0);
    const scoredProjects = allProjects.filter(p => p.qualityScore !== null);
    const avgQuality = scoredProjects.length > 0
      ? scoredProjects.reduce((sum, p) => sum + (p.qualityScore || 0), 0) / scoredProjects.length
      : 0;
    return { totalProjects, completedProjects, totalWords, totalCost, avgQuality };
  }
}

export const storage = new DatabaseStorage();
