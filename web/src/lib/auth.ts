import db from "@/drizzle/db";
import * as schema from "@/drizzle/schemas";
import { env } from "@/env/server";
import { getVerificationEmailBody } from "@/features/auth/register/components/emailVerificationMessage";
import { Notifier } from "@/features/notifications/server/notifier";
import { CreateUserSubsciption } from "@/features/subscriptions/server/action";
import { Time } from "@/lib/utils/utils";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt, captcha } from "better-auth/plugins";
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.UserTable,
      session: schema.SessionTable,
      account: schema.AccountTable,
      verification: schema.VerificationTable,
      jwks: schema.JWKSTable,
    },
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  session: {
    expiresIn: Time.toSec(6 * Time.Hour),
    updateAge: Time.toSec(1 * Time.Hour),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, token, url }) => {
      Notifier().email({
        subject: "Please verify your email address",
        content: getVerificationEmailBody(url),
        receiverEmail: user.email,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 5 * 60,
  },
  socialProviders: {
    github: {
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    },
    google: {
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    },
  },

  plugins: [
    jwt(),
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: env.TURNSTILE_SECRET_KEY,
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await CreateUserSubsciption({ tier: "POSTER", userId: user.id });
          } catch (e) {
            console.error("Failed to create user relations", e);
          }
        },
      },
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "POSTER",
      },
      stripeAccountId: {
        type: "string",
        required: false,
        fieldName: "stripeAccountId",
      },
      stripeCustomerId: {
        type: "string",
        required: false,
        fieldName: "stripeCustomerId",
      },
      metadata: {
        type: "json",
        required: false,
        fieldName: "metadata",
      },
    },
  },
});
