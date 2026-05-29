import { getUncachableStripeClient } from "./stripeClient";
import { storage } from "./storage";
import type { Project, MembershipTier } from "@shared/schema";

const USD = "usd";

/**
 * Finds (or creates) a one-time Stripe Price matching a book's current priceUsd.
 * Products are keyed by metadata.lexoraProjectId so repeated checkouts reuse the
 * same product/price instead of creating duplicates.
 */
export async function getOrCreateBookPriceId(project: Project): Promise<string> {
  const amount = Math.round((project.priceUsd || 0) * 100);
  if (amount <= 0) throw new Error("This book is not for sale");

  const stripe = await getUncachableStripeClient();

  let productId: string | undefined;
  const search = await stripe.products.search({
    query: `metadata['lexoraProjectId']:'${project.id}'`,
  });
  if (search.data.length > 0) {
    productId = search.data[0].id;
  } else {
    const product = await stripe.products.create({
      name: project.title,
      metadata: { lexoraProjectId: String(project.id), kind: "book" },
    });
    productId = product.id;
  }

  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const existing = prices.data.find(
    (p) => p.unit_amount === amount && p.currency === USD && !p.recurring,
  );
  if (existing) return existing.id;

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency: USD,
  });
  return price.id;
}

/**
 * Finds (or creates) a recurring monthly Stripe Price for a membership tier and
 * persists the resulting price id on the tier row.
 */
export async function syncTierStripePrice(tier: MembershipTier): Promise<string> {
  const amount = Math.round((tier.priceUsd || 0) * 100);
  if (amount <= 0) throw new Error("Tier price must be greater than zero");

  const stripe = await getUncachableStripeClient();

  let productId: string | undefined;
  const search = await stripe.products.search({
    query: `metadata['lexoraTierId']:'${tier.id}'`,
  });
  if (search.data.length > 0) {
    productId = search.data[0].id;
  } else {
    const product = await stripe.products.create({
      name: `Membership: ${tier.name}`,
      metadata: { lexoraTierId: String(tier.id), kind: "membership" },
    });
    productId = product.id;
  }

  const prices = await stripe.prices.list({ product: productId, active: true, limit: 100 });
  const existing = prices.data.find(
    (p) => p.unit_amount === amount && p.currency === USD && p.recurring?.interval === "month",
  );
  const priceId = existing
    ? existing.id
    : (
        await stripe.prices.create({
          product: productId,
          unit_amount: amount,
          currency: USD,
          recurring: { interval: "month" },
        })
      ).id;

  if (tier.stripePriceId !== priceId) {
    await storage.updateMembershipTier(tier.id, { stripePriceId: priceId });
  }
  return priceId;
}

export async function createBookCheckout(opts: {
  projects: Project[];
  readerId: number | null;
  token: string;
  baseUrl: string;
}): Promise<string> {
  const stripe = await getUncachableStripeClient();
  const lineItems: { price: string; quantity: number }[] = [];
  for (const p of opts.projects) {
    const priceId = await getOrCreateBookPriceId(p);
    lineItems.push({ price: priceId, quantity: 1 });
  }
  const type = opts.projects.length > 1 ? "bundle" : "book";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    success_url: `${opts.baseUrl}/store/${opts.token}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.baseUrl}/store/${opts.token}?checkout=cancel`,
    metadata: {
      type,
      readerId: opts.readerId ? String(opts.readerId) : "",
      projectIds: opts.projects.map((p) => p.id).join(","),
      inviteToken: opts.token,
    },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createMembershipCheckout(opts: {
  tier: MembershipTier;
  priceId: string;
  readerId: number;
  token: string;
  baseUrl: string;
}): Promise<string> {
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: opts.priceId, quantity: 1 }],
    success_url: `${opts.baseUrl}/store/${opts.token}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.baseUrl}/store/${opts.token}?checkout=cancel`,
    metadata: {
      type: "membership",
      readerId: String(opts.readerId),
      tierId: String(opts.tier.id),
      inviteToken: opts.token,
    },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/**
 * Verifies a completed Checkout Session with Stripe and records the resulting
 * order or membership. Idempotent: re-running for the same session is a no-op.
 */
export async function verifyAndFulfillSession(
  sessionId: string,
): Promise<{ status: string; type: string | null }> {
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const md = (session.metadata || {}) as Record<string, string>;
  const type = md.type || null;
  // Only treat funds as settled when Stripe confirms payment. `session.status`
  // can be "complete" while payment is still processing (async payment methods),
  // so we must gate on payment_status, never on session.status alone.
  const paid =
    session.payment_status === "paid" ||
    session.payment_status === "no_payment_required";
  if (!paid) return { status: session.payment_status || "pending", type };

  if (type === "book" || type === "bundle") {
    const readerId = md.readerId ? parseInt(md.readerId, 10) : null;
    const projectIds = (md.projectIds || "")
      .split(",")
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n) && n > 0);
    const orders = await storage.getStorefrontOrders();
    const already = orders.some((o) => o.stripeSessionId === sessionId);
    if (!already) {
      const perBook = projectIds.length > 0 ? (session.amount_total || 0) / 100 / projectIds.length : 0;
      for (const pid of projectIds) {
        await storage.createStorefrontOrder({
          readerId,
          projectId: pid,
          inviteToken: md.inviteToken || null,
          amount: perBook,
          currency: session.currency || USD,
          stripeSessionId: sessionId,
          status: "complete",
          metadata: { type },
        });
      }
    }
  } else if (type === "membership") {
    const readerId = md.readerId ? parseInt(md.readerId, 10) : null;
    const tierId = md.tierId ? parseInt(md.tierId, 10) : null;
    const subId = (session.subscription as string) || null;
    if (readerId) {
      const memberships = await storage.getReaderMemberships(readerId);
      const already = subId && memberships.some((m) => m.stripeSubscriptionId === subId);
      if (!already) {
        // Fallback to ~31 days so a failed subscription lookup never grants
        // perpetual access (access check treats null period end as indefinite).
        let currentPeriodEnd: Date = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
        let subActive = !subId; // free/no-sub cases already passed the paid gate
        if (subId) {
          try {
            const sub: any = await stripe.subscriptions.retrieve(subId);
            if (sub?.current_period_end) currentPeriodEnd = new Date(sub.current_period_end * 1000);
            subActive = sub?.status === "active" || sub?.status === "trialing";
          } catch {
            /* non-fatal: keep the bounded fallback period */
          }
        }
        // Don't grant entitlement unless the subscription is genuinely active.
        if (!subActive) return { status: "pending", type };
        await storage.createReaderMembership({
          readerId,
          tierId,
          status: "active",
          stripeSubscriptionId: subId,
          currentPeriodEnd,
        });
      }
    }
  }
  return { status: "complete", type };
}

/**
 * Whether a reader may read the full content of a book. Free books (priceUsd<=0)
 * are open to any logged-in reader. Paid books require a completed order for that
 * book or an active membership (all-access).
 */
export async function readerHasBookAccess(
  readerId: number | null,
  project: Project,
): Promise<boolean> {
  if ((project.priceUsd || 0) <= 0) return true;
  if (!readerId) return false;

  const memberships = await storage.getReaderMemberships(readerId);
  const activeMember = memberships.some(
    (m) =>
      m.status === "active" &&
      (!m.currentPeriodEnd || m.currentPeriodEnd.getTime() > Date.now()),
  );
  if (activeMember) return true;

  const orders = await storage.getStorefrontOrders();
  return orders.some(
    (o) => o.readerId === readerId && o.projectId === project.id && o.status === "complete",
  );
}
