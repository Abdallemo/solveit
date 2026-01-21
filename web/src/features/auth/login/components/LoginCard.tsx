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
import FormError from "../../register/components/loginFormError";
import FormSuccess from "../../register/components/loginFormSuccess";
import { loginFormSchema, loginInferedTypes } from "../../server/auth-types";
import { Turnstile } from "@marsidev/react-turnstile";
import { Dispatch, SetStateAction } from "react";
import { env } from "@/env/client";
type LoginCardProps = {
  myformController: UseFormReturn<loginInferedTypes>;
  submitHandler: (values: z.infer<typeof loginFormSchema>) => Promise<void>;
  isPending: boolean;
  error: string;
  success: string;
  setCaptchaToken: Dispatch<SetStateAction<string | null>>;
  captchaToken: string | null;
};

export default function LoginCard({
  myformController,
  submitHandler,
  isPending,
  error,
  success,
  setCaptchaToken,
  captchaToken,
}: LoginCardProps) {
  return (
    <Card className="flex gap-4 w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
        <CardDescription>
          Enter your credentials to access your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...myformController}>
          <form
            onSubmit={myformController.handleSubmit(submitHandler)}
            className="flex flex-col  gap-4 "
          >
            <FormField
              control={myformController.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="jonh@gmail.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {
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
            }
            <FormError message={error} />
            <FormSuccess message={success} />
            <Button
              className="px-28 py-6 mt-4"
              variant={"default"}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" /> : "Login"}
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
          {"Don't have an account? "}
          <Link className="font-semibold " href={"/register"}>
            Sign Up Now
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export function ContinueSeperatorBtn() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">
          Or continue with
        </span>
      </div>
    </div>
  );
}
