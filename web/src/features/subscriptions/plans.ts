import { TierType } from "@/drizzle/schemas";

export type Plan = {
  name: string;
  price: string;
  priceInCents: number;
  features: string[];
  teir: TierType;
};

export const plansDep: Plan[] = [
  {
    name: "Poster",
    price: "RM0",
    priceInCents: 0,
    features: [
      "Unlimited task postings",
      "AI-powered task categorization",
      "AI-generated pricing suggestions",
      "View solver profiles & reviews",
      "Real-time notification system",
    ],
    teir: "POSTER",
  },
  {
    name: "Solver",
    price: "RM15",
    priceInCents: 1500,
    features: [
      "Access to all posted tasks",
      "Earn money by completing tasks",
      "Reputation-based ranking system",
      "Advertise mentoring services",
      "Task filtering and smart recommendations",
      "Priority support & verification badge",
    ],
    teir: "SOLVER",
  },
];

export const plans: Plan[] = [
  {
    name: "Poster",
    price: "RM0",
    priceInCents: 0,
    features: [
      "Unlimited task postings",
      "Unlimited file uploads per task",
      "AI-powered task categorization",
      "AI-generated pricing suggestions",
      "Secure Escrow payment protection",
    ],
    teir: "POSTER",
  },
  {
    name: "Solver",
    price: "RM15",
    priceInCents: 1500,
    features: [
      "Access to all posted tasks",
      "Earn money by completing tasks",
      "Unlimited solution file uploads",
      "Secure Escrow payment protection",
    ],
    teir: "SOLVER",
  },
  {
    name: "Solver++ (Mentor)",
    price: "RM20",
    priceInCents: 2000,
    features: [
      "All Solver features included",
      "Host paid mentorship sessions",
      "Real-time video calls And Messaging",
      "High-quality screen sharing",
      "Set custom hourly mentoring rates",
      "Secure Escrow payment protection",
    ],
    teir: "SOLVER++",
  },
];
