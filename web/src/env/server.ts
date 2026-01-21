import { createEnv } from "@t3-oss/env-nextjs";

import { z } from "zod";
let isLogged = false;
export const env = createEnv({
  emptyStringAsUndefined: true,
  server: {
    AUTH_GITHUB_ID: z.string({ required_error: "AUTH_GITHUB_ID is missing" }),
    STRIPE_SECRET_KEY: z.string({
      required_error: "STRIPE_SECRET_KEY is missing",
    }),
    AUTH_SECRET: z.string({ required_error: "AUTH_SECRET is missing" }),
    AUTH_GITHUB_SECRET: z.string({
      required_error: "AUTH_GITHUB_SECRET is missing",
    }),
    DATABASE_URL: z.string({ required_error: "DATABASE_URL is missing" }),
    AUTH_GOOGLE_ID: z.string({ required_error: "AUTH_GOOGLE_ID is missing" }),
    AUTH_GOOGLE_SECRET: z.string({
      required_error: "AUTH_GOOGLE_SECRET is missing",
    }),
    NEXTAUTH_URL: z.string({ required_error: "NEXTAUTH_URL is missing" }),
    STRIPE_SOLVER_PRICE_ID: z.string({
      required_error: "STRIPE_SOLVER_PRICE_ID is missing",
    }),
    STRIPE_WEBHOOK_SECRET: z.string({
      required_error: "STRIPE_WEBHOOK_SECRET is missing",
    }),
    GMAIL_APP_PASSWORD: z.string({
      required_error: "GMAIL_APP_PASSWORD is missing",
    }),
    GMAIL_APP_EMAIL: z.string({ required_error: "GMAIL_APP_EMAIL is missing" }),
    GO_API_URL: z.string({ required_error: "GO_API_URL is missing" }),
    STRIPE_SOLVER_PLUS_PRICE_ID: z.string({
      required_error: "STRIPE_SOLVER_PLUS_PRICE_ID is missing",
    }),
    PRODUCTION_URL: z.string({ required_error: "PRODUCTION_URL is missing" }),
    Turn_Token_ID: z.string({ required_error: "Turn_Token_ID is missing" }),
    Turn_API_Token: z.string({ required_error: "Turn_API_Token is missing" }),
    REDIS_URL: z.string({ required_error: "REDIS_URL is missing" }),
    STRIPE_CONNECT_WEBHOOK_SECRET: z.string({
      required_error: "STRIPE_CONNECT_WEBHOOK_SECRET is missing",
    }),
    TURNSTILE_SECRET_KEY: z.string({
      required_error: "TURNSTILE_SECRET_KEY is missing",
    }),
    STRIPE_TEST_MODE: z
      .string({ required_error: "STRIPE_TEST_MODE is missing" })
      .transform((val) => {
        const lowerVal = val.toLowerCase();
        return lowerVal === "true" || lowerVal === "1";
      }),
    NEXT_PORT: z
      .string({ required_error: "NEXT_PORT is missing" })
      .transform((val) => Number(val)),
  },
  onValidationError: (issues) => {
    if (!isLogged) {
      isLogged = true;
      console.error("Invalid environment variables:");
      issues.forEach((issue) => {
        if (issue && issue.path) {
          console.error(`  ${issue.path.join(".")}: ${issue.message}`);
        }
      });
      process.exit(1);
    }
    process.exit(1);
  },
  experimental__runtimeEnv: process.env,
});
