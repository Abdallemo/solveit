"use client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubscribeButton } from "@/features/subscriptions/components/SubscribeButton";
import { Plan, plans } from "@/features/subscriptions/plans";
import {
  createCancelSession,
  createStripeCheckoutSession,
} from "@/features/subscriptions/server/action";
import { getServerUserSubscriptionById } from "@/features/users/server/actions";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
export default function Pricing() {
  const { user, state } = useCurrentUser();
  const { mutateAsync: cancelSubscriptionSession, isPending: isCanceling } =
    useMutation({
      mutationFn: createCancelSession,
    });
  const { mutateAsync: createSubscription, isPending: isCreating } =
    useMutation({
      mutationFn: createStripeCheckoutSession,
    });
  const { data: userSubscription } = useQuery({
    queryKey: [user?.id],
    queryFn: async () => {
      return (await getServerUserSubscriptionById(user?.id)) || null;
    },
  });
  const switchSubs = async (plan: Plan) => {
    try {
      if (plan.teir === "POSTER") {
        await cancelSubscriptionSession();
      } else {
        await createSubscription(plan.teir);
      }
    } catch (e) {}
  };

  return (
    <section id="pricing" className="py-24 md:py-32 ">
      <div className="container max-w-screen-xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card
                className={`relative h-full flex flex-col ${plan.teir === "SOLVER" ? "border-primary shadow-lg" : ""}`}
              >
                {plan.teir === "SOLVER" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-8">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <form
                    className="w-full"
                    action={async () => switchSubs(plan)}
                  >
                    <SubscribeButton
                      tier={plan.teir}
                      currentTier={userSubscription?.tier}
                    />
                  </form>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingSkeleton() {
  return (
    <section id="pricing" className="py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex justify-center mb-12">
          <div className="h-9 w-64 rounded-lg bg-muted shimmer-wave" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <Card key={index} className="flex flex-col justify-between h-full">
              <CardHeader>
                <div className="h-8 w-32 rounded-lg bg-muted shimmer-wave" />

                <div className="flex items-baseline gap-2 mt-2">
                  <div className="h-9 w-20 rounded-lg bg-muted shimmer-wave" />
                  <div className="h-5 w-16 rounded-lg bg-muted shimmer-wave" />
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2 mt-4">
                  {plan.features.map((_, i) => (
                    <li key={i} className="flex items-center">
                      <div className="h-5 w-5 rounded bg-muted shimmer-wave mr-2" />
                      <div className="h-5 flex-1 rounded-lg bg-muted shimmer-wave" />
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="mt-auto">
                <div className="w-full h-10 rounded-md bg-muted shimmer-wave" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
