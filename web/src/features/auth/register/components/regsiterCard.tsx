import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import SocialButtons from "../../components/socialButtons";
import { ContinueSeperatorBtn } from "../../login/components/LoginCard";
import {
  registerFormSchema,
  registerInferedTypes,
} from "../../server/auth-types";
import FormError from "./loginFormError";
import FormSuccess from "./loginFormSuccess";
import { Turnstile } from "@marsidev/react-turnstile";
import { env } from "@/env/client";
import { Dispatch, SetStateAction } from "react";

type registerCardProps = {
  myformController: UseFormReturn<registerInferedTypes>;
  submitHandler: (values: z.infer<typeof registerFormSchema>) => Promise<void>;
  isPending: boolean;
  error: string;
  success: string;
  setCaptchaToken: Dispatch<SetStateAction<string | null>>;
  captchaToken: string | null;
};

export default function RegisterCard({
  myformController,
  submitHandler,
  isPending,
  error,
  success,
  captchaToken,
  setCaptchaToken,
}: registerCardProps) {
  return (
    <Card className="flex gap-4 w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Get started</CardTitle>
        <CardDescription>Create your account in minutes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...myformController}>
          <form
            onSubmit={myformController.handleSubmit(submitHandler)}
            className="flex flex-col  gap-2 "
          >
            <FormField
              control={myformController.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Your name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={myformController.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="jonh@gmail.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={myformController.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="******" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormError message={error} />
            <FormSuccess message={success} />
            <Button
              className="px-28 py-6 mt-4"
              variant={"default"}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : "Register"}
            </Button>
          </form>
        </Form>
        <ContinueSeperatorBtn />
        <div className="flex gap-4 mb-4 w-full items-center mt-5">
          <SocialButtons captchaToken={captchaToken} />
        </div>
        <div className="flex justify-center">
          <Turnstile
            siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            onSuccess={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />
        </div>
      </CardContent>
      <CardFooter className="flex place-content-center text-foreground">
        <p className="text-sm  ">
          {"Have an account? "}
          <Link className="font-semibold " href={"/login"}>
            Sign In Now
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
