"use server";

import {
  getServerUserSession,
  isAuthorized,
} from "@/features/auth/server/actions";
import {
  createStripeCustomer,
  getServerUserSubscriptionById,
  getUserById,
} from "@/features/users/server/actions";
import { stripe, SubPriceMap } from "@/lib/stripe";
import { redirect } from "next/navigation";

import db from "@/drizzle/db";
import { TierType, UserSubscriptionTable, UserTable } from "@/drizzle/schemas";
import { env } from "@/env/server";
import { UserRole } from "@/features/users/server/user-types";
import { logger } from "@/lib/logging/winston";
import { to } from "@/lib/utils/async";
import { headers } from "next/headers";
import Stripe from "stripe";

import { eq, SQL } from "drizzle-orm";

export async function getServerReturnUrl() {
  const headersList = await headers();
  const fullUrl = headersList.get("x-full-url");
  let referer = headersList.get("referer");
  if (!referer || referer === fullUrl) {
    return `${env.NEXTAUTH_URL}/dashboard/`;
  }
  return referer;
}
export async function getReturnUrl(defaulUrl: string) {
  const headersList = await headers();
  let referer = headersList.get("referer");
  if (!referer || referer === "") {
    return `${env.NEXTAUTH_URL}/${defaulUrl}`;
  }
  return referer;
}

export async function createStripeCheckoutSession(tier: TierType) {
  const referer = await getReturnUrl("");
  try {
    const { user } = await isAuthorized(["POSTER", "SOLVER"]);
    if (!SubPriceMap[tier]) throw new Error("Plan not found");
    const stripePriceId = SubPriceMap[tier];

    let customerId = user.stripeCustomerId;
    if (!user.stripeCustomerId) {
      const [newCustomerId, err] = await createStripeCustomer(user);
      if (err) {
        throw new Error("Internal error! Try again");
      }
      customerId = newCustomerId;
    }
    if (user.role === "SOLVER") {
      const [session, error] = await to(
        stripe.billingPortal.sessions.create({
          customer: user.stripeCustomerId!,
          return_url: referer,
        }),
      );
      if (error) {
        logger.error(
          `failed to generate stripe Billing Portal for user ${user.id}. cause ${error.message}`,
          {
            message: error.message,
            cause: error.cause,
          },
        );
        throw new Error("Internal error! Try again");
      }
      redirect(session.url);
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId!,
      success_url: referer,
      cancel_url: referer,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      payment_method_collection: "if_required",
      payment_method_types: ["card"],
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
    });

    if (!session.url) throw new Error("Failed to create checkout session");
    redirect(session.url);
  } catch (error) {
    logger.error("Stripe Checkout Session Failed", { error: error });
    console.error(error);
    throw error;
  }
}

export async function upgradeSolverToPlus(userId: string) {
  const return_url = await getServerReturnUrl();
  const { user } = await isAuthorized(["SOLVER"]);

  const subscription = await getServerUserSubscriptionById(userId);
  if (
    !subscription?.stripeSubscriptionId ||
    !subscription?.stripeSubscriptionItemId
  ) {
    throw new Error("User does not have an active subscription");
  }

  const [session, error] = await to(
    stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId!,
      return_url,
    }),
  );
  if (error) {
    logger.error(
      `failed to generate stripe Billing Portal for user ${userId}. cause ${error.message}`,
      {
        message: error.message,
        cause: error.cause,
      },
    );
    throw new Error("Unable to Create Stripe Session ");
  }
  redirect(session.url);
}

export async function createCancelSession() {
  const referer = await getReturnUrl("");
  const { user } = await isAuthorized(["POSTER", "SOLVER"]);
  logger.info("creating cancel Session for User: " + user.id, {
    userId: user.id,
  });

  const subscription = await getServerUserSubscriptionById(user.id);
  if (!subscription || !subscription.stripeSubscriptionId) return;

  if (!user?.stripeCustomerId || !subscription.stripeSubscriptionId) return;

  let portalSession: Stripe.Response<Stripe.BillingPortal.Session>;
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: referer,
      flow_data: {
        type: "subscription_cancel",
        subscription_cancel: {
          subscription: subscription.stripeSubscriptionId,
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.message?.includes("No such subscription")
    ) {
      console.warn("Subscription does not exist on Stripe.");
      return { error: "already subscriped" };
    }

    console.error("Stripe error:", error);
    return;
  }

  redirect(portalSession.url);
}

export async function CreateUserSubSessionPortal() {
  const { user } = await isAuthorized(["POSTER", "SOLVER"]);
  if (user?.stripeCustomerId == null) return;

  const referer = await getServerReturnUrl();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user?.stripeCustomerId,
    return_url: referer,
  });
  return portalSession.url;
}

export async function updateUserSubscription(
  values: typeof UserSubscriptionTable.$inferInsert,
  role: UserRole,
  id: string,
  stripeCustomerId: string,
) {
  try {
    await db.transaction(async (dx) => {
      await dx
        .update(UserSubscriptionTable)
        .set(values)
        .where(eq(UserSubscriptionTable.userId, id))
        .returning();
      await dx
        .update(UserTable)
        .set({ role: role, stripeCustomerId: stripeCustomerId })
        .where(eq(UserTable.id, id));
    });

    logger.info(`Sucessfully Updated User ${id}'s Subscription`);
  } catch (error) {
    logger.error(
      "unable to update user subscription cause: ",
      (error as Error).message,
      {
        message: (error as Error).message,
        cause: (error as Error).cause,
      },
    );
    throw new Error("unable to update user subscription cause: ", {
      cause: error,
    });
  }
}

export async function CancelUserSubscription(
  where: SQL,
  values: typeof UserSubscriptionTable.$inferInsert,
  id?: string,
) {
  await db.transaction(async (dx) => {
    await dx.update(UserSubscriptionTable).set(values).where(where);

    await dx
      .update(UserTable)
      .set({ role: "POSTER", stripeCustomerId: null })
      .where(eq(UserTable.id, id!));
  });
}

export async function CreateUserSubsciption(
  values: typeof UserSubscriptionTable.$inferInsert,
) {
  await db.insert(UserSubscriptionTable).values(values);
}
