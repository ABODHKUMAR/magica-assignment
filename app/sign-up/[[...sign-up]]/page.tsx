import { SignUp } from "@clerk/nextjs";

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvasbg">
      {hasClerk ? (
        <SignUp />
      ) : (
        <div className="w-[360px] rounded-xl border border-gray-200 bg-white p-6 shadow-node">
          <h1 className="text-lg font-semibold">Sign up</h1>
          <p className="mt-2 text-sm text-gray-500">
            Clerk is not configured. Running in local demo mode.
          </p>
          <a
            href="/dashboard"
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            Continue to dashboard
          </a>
        </div>
      )}
    </main>
  );
}
