"use client"

import dynamic from "next/dynamic"
import "swagger-ui-react/swagger-ui.css"

// swagger-ui (bundled by swagger-ui-react) still uses legacy
// `UNSAFE_componentWillReceiveProps` lifecycles in several components
// (`ModelCollapse`, `ParameterRow`, …), which React flags under strict mode
// in dev. They are benign and upstream-owned, so we filter just those
// warnings on this page instead of hiding unrelated warnings.
if (typeof window !== "undefined") {
  const originalError = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    const message = args.map(String).join(" ")
    if (
      message.includes("UNSAFE_componentWillReceiveProps") &&
      (message.includes("ModelCollapse") || message.includes("ParameterRow"))
    ) {
      return
    }
    originalError(...args)
  }
}

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => <p>Loading API documentation…</p>,
})

export default function ApiDocsPage() {
  return (
    <div style={{ height: "100vh" }}>
      <SwaggerUI url="/api/v1/openapi" />
    </div>
  )
}
