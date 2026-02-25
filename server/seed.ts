import { db } from "./db";
import { projects, bookDna, trendReports, chapters, marketingAssets } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  try {
    const existing = await db.select().from(projects);
    if (existing.length > 0) return;

    const [p1] = await db.insert(projects).values({
      title: "The Wealth Architecture: Build Passive Income in 90 Days",
      vertical: "money",
      targetLanguage: "english",
      status: "complete",
      greenlightScore: 8.7,
      qualityScore: 8.9,
      totalTokens: 42000,
      estimatedCost: 0.126,
      wordCount: 32400,
      chapterCount: 10,
    }).returning();

    await db.insert(bookDna).values({
      projectId: p1.id,
      corePromise: "Transform your financial life by building three streams of passive income in 90 days without quitting your job.",
      readerAvatar: "Ambitious 30-45 year old professional earning $60-120k, frustrated with living paycheck to paycheck, wants financial freedom but has limited time and is skeptical of 'get rich quick' schemes.",
      toneRules: "Direct, data-driven, no-fluff. Use ROI framing. Avoid jargon. Write like a knowledgeable friend who happens to be a financial expert. Balance aspiration with practical reality.",
      transformationArc: "From paycheck-to-paycheck anxiety → Understanding passive income fundamentals → First income stream launched → Second stream generating returns → Third stream systematized → Financial freedom roadmap complete.",
      frameworkSummary: "The 3-Stream Velocity System: Digital assets (30 days) → Dividend income (60 days) → Real estate syndication (90 days). Each stream compounds the others.",
    });

    await db.insert(chapters).values([
      { projectId: p1.id, chapterNumber: 1, title: "The Passive Income Lie They Don't Tell You", blueprint: "Debunks common myths, establishes credibility, presents the 3-Stream framework", content: "Most passive income advice is wrong. Not maliciously—just hopelessly optimistic without the mechanics...", wordCount: 3200, qualityScore: 9.1, status: "complete" },
      { projectId: p1.id, chapterNumber: 2, title: "Your Financial DNA: The Wealth Assessment", blueprint: "Self-assessment tools, risk tolerance calculator, time audit", content: "Before building wealth, you need to understand your starting conditions...", wordCount: 2800, qualityScore: 8.7, status: "complete" },
      { projectId: p1.id, chapterNumber: 3, title: "Stream One: The Digital Asset Engine (Days 1-30)", blueprint: "Step-by-step digital product creation, pricing strategy, platform selection", content: "Digital assets are the fastest path to passive income because the marginal cost of delivery is near zero...", wordCount: 3600, qualityScore: 9.0, status: "complete" },
    ]);

    await db.insert(marketingAssets).values({
      projectId: p1.id,
      shortBlurb: "Build three streams of passive income in 90 days without quitting your job. The Wealth Architecture delivers a proven, step-by-step system used by 10,000+ readers to escape financial dependency.",
      hooks: [
        "What if you could replace your salary without replacing your job?",
        "The 90-day passive income roadmap that financial advisors don't want you to see",
        "I built $5,000/month in passive income while keeping my 9-5. Here's exactly how.",
      ],
      adAngles: [
        "Pain-point angle: 'Still trading time for money in 2025?'",
        "Social proof angle: '10,000 readers already on their way to financial freedom'",
      ],
      pricingMatrix: { ebook: "$12.99", paperback: "$19.99", hardcover: "$29.99", audiobook: "$24.99", bundle: "$44.99" },
      authorBio: "A former corporate consultant who escaped the 9-5 grind by building three passive income streams. Now helps ambitious professionals build wealth systems that work while they sleep.",
    });

    const [p2] = await db.insert(projects).values({
      title: "Atomic Fitness: The 12-Minute Morning That Changes Everything",
      vertical: "fitness",
      targetLanguage: "english",
      status: "writing",
      greenlightScore: 9.1,
      qualityScore: 8.4,
      totalTokens: 28000,
      estimatedCost: 0.084,
      wordCount: 18200,
      chapterCount: 8,
    }).returning();

    await db.insert(bookDna).values({
      projectId: p2.id,
      corePromise: "Achieve your ideal body and lifelong fitness in just 12 minutes each morning using habit-stacking science and progressive movement protocols.",
      readerAvatar: "Busy professional or parent aged 28-50, wants to get fit but struggles to find time. Tried and failed multiple gym programs. Skeptical but hopeful.",
      toneRules: "Energetic but realistic. Science-backed but accessible. Use progressive frameworks. Include safety notes. Celebrate small wins. Avoid shame language.",
      transformationArc: "From sedentary and overwhelmed → Morning routine established → First physical results visible → Habit locked in → Lifestyle transformation complete",
      frameworkSummary: "The 12-Minute Morning Protocol: 4-minute mobility (Phase 1) + 4-minute strength (Phase 2) + 4-minute cardio burst (Phase 3). Progressive overload built in.",
    });

    const [p3] = await db.insert(projects).values({
      title: "The Mindful Leader: How Inner Peace Creates Outer Excellence",
      vertical: "mindset",
      targetLanguage: "english",
      status: "draft",
      greenlightScore: 7.8,
      totalTokens: 0,
      estimatedCost: 0,
      wordCount: 0,
      chapterCount: 0,
    }).returning();

    await db.insert(trendReports).values([
      {
        vertical: "money",
        demandScore: 9.2,
        competitionScore: 7.1,
        greenlightScore: 8.7,
        painPoints: [
          "Living paycheck to paycheck despite earning good income",
          "No clear path to financial independence",
          "Overwhelmed by investment options",
          "Fear of market volatility destroying savings",
          "Can't afford to quit job to pursue wealth building",
        ],
        titleAngles: [
          "The 90-Day Passive Income Blueprint",
          "Wealth Without Wall Street: The Alternative Investor's Playbook",
          "From Zero to $5K/Month: The Realistic Passive Income Guide",
        ],
        nicheTopics: [
          "AI-powered investing for beginners",
          "Real estate syndication with $10K",
          "Digital product income stacking",
        ],
        keywords: ["passive income 2025", "financial freedom", "side income streams", "investing for beginners"],
        summary: "The money and personal finance vertical shows exceptional demand with readers seeking realistic, actionable paths to financial freedom. Competition is high but tilted toward generic advice, leaving room for specific, system-based approaches.",
      },
      {
        vertical: "fitness",
        demandScore: 8.9,
        competitionScore: 8.2,
        greenlightScore: 9.1,
        painPoints: [
          "No time to exercise with busy schedule",
          "Gym memberships go unused",
          "Confusing and contradictory fitness advice",
          "Motivation drops after first 2 weeks",
          "Injury fears from intense programs",
        ],
        titleAngles: [
          "The 12-Minute Body: Maximum Results, Minimum Time",
          "Fit by Default: The Lazy Person's Complete Fitness System",
          "Morning Machine: The Science of Effortless Fitness Habits",
        ],
        nicheTopics: [
          "Micro-workout science for busy professionals",
          "Habit-stacking for fitness adherence",
          "Middle age fitness without injury",
        ],
        keywords: ["quick workout", "busy professional fitness", "morning exercise", "habit fitness"],
        summary: "Fitness books targeting time-constrained adults show massive demand with high greenlight potential. The niche around micro-workouts and habit-based fitness is emerging with lower competition than traditional fitness.",
      },
    ]);

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Seeding error:", error);
  }
}
