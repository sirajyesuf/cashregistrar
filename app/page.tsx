import Link from "next/link"
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  FileCheck2,
  LayoutDashboard,
  QrCode,
  RotateCcw,
  Settings,
  ShieldCheck,
} from "lucide-react"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import { getSessionUser } from "@/lib/auth/user"

const FEATURES = [
  {
    icon: FileCheck2,
    title: "Simple invoices",
    text: "Make invoices for businesses or individual customers, ready for the government.",
  },
  {
    icon: ShieldCheck,
    title: "Automatic official numbers",
    text: "With one click, your invoice is sent to the government and gets an official number.",
  },
  {
    icon: QrCode,
    title: "Receipts customers can trust",
    text: "Give customers a receipt with a QR code they can scan to check it is official.",
  },
  {
    icon: RotateCcw,
    title: "Check or cancel invoices",
    text: "See if an invoice is official, and cancel it if you made a mistake.",
  },
  {
    icon: Banknote,
    title: "Taxes calculated for you",
    text: "The tax and total are worked out automatically for every item.",
  },
  {
    icon: Settings,
    title: "Your business details",
    text: "Save your business details once and they will appear on every invoice.",
  },
]

const STEPS = [
  {
    n: "1",
    title: "Fill in the invoice",
    text: "Add the items and the customer&apos;s details.",
  },
  {
    n: "2",
    title: "Send it to the government",
    text: "One click sends the invoice and gets an official number.",
  },
  {
    n: "3",
    title: "Give the receipt",
    text: "Take the payment and give your customer a receipt with a QR code.",
  },
]

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
        CR
      </span>
      <span className="text-sm font-semibold tracking-tight">
        CashRegistrar
      </span>
    </span>
  )
}

function MockInvoice() {
  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <p className="text-sm font-semibold">INVOICE</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            INV-0042
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="size-3" />
          Registered
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {[
          ["Phone", "2 × 1,000.00"],
          ["Service fee", "1 × 500.00"],
        ].map(([item, price]) => (
          <div key={item} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{item}</span>
            <span className="tabular-nums">{price}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">2,500.00</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Tax (15%)</span>
          <span className="tabular-nums">375.00</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">2,875.00</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-lg border bg-muted/40 p-3">
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Sales receipt</p>
          <p className="mt-0.5 font-mono">REC000000000000004</p>
        </div>
        <span className="flex size-11 items-center justify-center rounded-md border bg-white text-muted-foreground dark:bg-background">
          <QrCode className="size-6" />
        </span>
      </div>
    </div>
  )
}

export default async function LandingPage() {
  const isAuthenticated = Boolean(await getSessionUser())
  const actionHref = isAuthenticated ? "/dashboard" : "/login"
  const actionLabel = isAuthenticated ? "Dashboard" : "Sign in"

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link href="/" aria-label="CashRegistrar home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a
              href="#features"
              className="transition-colors hover:text-foreground"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="transition-colors hover:text-foreground"
            >
              How it works
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Link href={actionHref}>
              <Button size="sm">
                {actionLabel}
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">
                Simple, official invoices.
              </h1>
              <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground sm:mx-0 sm:text-lg">
                Create an invoice, send it to the government, and give your
                customer a receipt — all in one place.
              </p>
              {!isAuthenticated && (
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <Link href="/login">
                    <Button size="lg">
                      Sign in
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            <div className="hidden justify-center lg:flex lg:justify-end">
              <MockInvoice />
            </div>
          </div>
        </section>

        <section id="features" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight">
                Everything you need to make official invoices
              </h2>
              <p className="mt-3 text-muted-foreground">
                Handles the government paperwork so you can focus on selling.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border bg-card p-5"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg border bg-muted/50">
                    <feature.icon className="size-4" />
                  </span>
                  <h3 className="mt-3 font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {feature.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight">
                Three simple steps
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n} className="rounded-xl border bg-card p-5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {step.n}
                  </span>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border bg-muted/40 p-8 text-center">
              <h3 className="text-2xl font-bold tracking-tight">
                Ready to start?
              </h3>
              <p className="max-w-md text-muted-foreground">
                Add your business details and make your first official invoice
                in minutes.
              </p>
              <Link href={actionHref}>
                <Button size="lg">
                  {actionLabel}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Link href="/" aria-label="CashRegistrar home">
            <Logo />
          </Link>
          <p>
            <LayoutDashboard className="mr-1 inline size-3.5" />
            CashRegistrar — simple, official invoices for your business.
          </p>
        </div>
      </footer>
    </div>
  )
}
