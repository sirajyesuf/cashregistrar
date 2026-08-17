import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi"
import { z } from "zod"
import {
  branchCreateSchema,
  businessUpdateApiSchema,
  createBusinessApiSchema,
  updateBranchSchema,
} from "@/lib/business-schema"
import { productInputSchema } from "@/lib/product-schema"
import { invoiceCreateApiSchema, invoiceInputSchema } from "@/lib/invoice-schema"
import {
  bulkCancelSchema,
  bulkIdsSchema,
  cancelInputSchema,
} from "@/lib/einvoice/operation-schema"

const registry = new OpenAPIRegistry()

registry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "http",
  scheme: "bearer",
  description: "API key created in the dashboard (prefix cr_live_).",
})

registry.registerComponent("schemas", "Error", {
  type: "object",
  properties: { error: { type: "string" } },
})

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function json(schema: any) {
  return { "application/json": { schema } }
}

function errorResponse(description: string) {
  return { description, content: json(ref("Error")) }
}

const unauthorized = errorResponse("Missing or invalid API key")
const notFound = errorResponse("Resource not found")
const badRequest = errorResponse("Invalid request body")
const conflict = errorResponse("Conflict")

function pathParam(name: string, description?: string) {
  return {
    name,
    in: "path" as const,
    required: true,
    schema: { type: "string" as const },
    description,
  }
}

const businessId = pathParam("businessId", "Business id")
const branchId = pathParam("branchId", "Branch id")
const productId = pathParam("productId", "Product id")
const invoiceId = pathParam("invoiceId", "Invoice id")

function jsonBody(schema: z.ZodType) {
  return { content: { "application/json": { schema } } }
}

function okFlag() {
  return {
    description: "OK",
    content: json({
      type: "object",
      properties: { ok: { type: "boolean" } },
    }),
  }
}

// ---------------------------------------------------------------------------
// Entity response schemas (JSON representations; money/dates are strings).
// ---------------------------------------------------------------------------
registry.registerComponent("schemas", "Business", {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    currency: { type: "string" },
    active: { type: "boolean" },
    city: { type: "string" },
    country: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    region: { type: "string" },
    wereda: { type: "string" },
    houseNumber: { type: "string" },
    createdAt: { type: "string" },
  },
})

registry.registerComponent("schemas", "Branch", {
  type: "object",
  properties: {
    id: { type: "string" },
    businessId: { type: "string" },
    name: { type: "string" },
    address: { type: "string" },
    active: { type: "boolean" },
    createdAt: { type: "string" },
  },
})

registry.registerComponent("schemas", "Product", {
  type: "object",
  properties: {
    id: { type: "string" },
    businessId: { type: "string" },
    name: { type: "string" },
    itemCode: { type: "string" },
    unit: { type: "string" },
    sellingPrice: { type: "string" },
    createdAt: { type: "string" },
  },
})

registry.registerComponent("schemas", "InvoiceLine", {
  type: "object",
  properties: {
    id: { type: "string" },
    lineNumber: { type: "integer" },
    description: { type: "string" },
    quantity: { type: "string" },
    unitPrice: { type: "string" },
    total: { type: "string" },
    itemCode: { type: "string" },
    unit: { type: "string" },
  },
})

registry.registerComponent("schemas", "Invoice", {
  type: "object",
  properties: {
    id: { type: "string" },
    number: { type: "string" },
    date: { type: "string" },
    taxCode: { type: "string" },
    taxRate: { type: "string" },
    subtotal: { type: "string" },
    taxAmount: { type: "string" },
    grandTotal: { type: "string" },
    transactionType: { type: "string" },
    buyerLegalName: { type: "string" },
    buyerTin: { type: "string" },
    irn: { type: "string" },
    registrationStatus: { type: "string" },
    businessId: { type: "string" },
    branchId: { type: "string" },
    lines: { type: "array", items: ref("InvoiceLine") },
  },
})

registry.registerComponent("schemas", "InvoiceList", {
  type: "object",
  properties: {
    invoices: { type: "array", items: ref("Invoice") },
    total: { type: "integer" },
    page: { type: "integer" },
    pageSize: { type: "integer" },
    stats: {
      type: "object",
      properties: {
        totalInvoices: { type: "integer" },
        failed: { type: "integer" },
        cancelled: { type: "integer" },
        issuedReceipts: { type: "integer" },
      },
    },
  },
})

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------
registry.registerPath({
  method: "get",
  path: "/api/v1/businesses",
  tags: ["Businesses"],
  summary: "List businesses for the authenticated user",
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { businesses: { type: "array", items: ref("Business") } } }) },
    401: unauthorized,
  },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/businesses",
  tags: ["Businesses"],
  summary: "Create a business (with MOR credentials and a branch)",
  request: { body: jsonBody(createBusinessApiSchema) },
  responses: {
    201: { description: "Created", content: json({ type: "object", properties: { business: ref("Business") } }) },
    400: badRequest,
    401: unauthorized,
    409: conflict,
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/businesses/{businessId}",
  tags: ["Businesses"],
  summary: "Get a business",
  parameters: [businessId],
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { business: ref("Business") } }) },
    401: unauthorized,
    404: notFound,
  },
})

registry.registerPath({
  method: "patch",
  path: "/api/v1/businesses/{businessId}",
  tags: ["Businesses"],
  summary: "Update a business",
  parameters: [businessId],
  request: { body: jsonBody(businessUpdateApiSchema) },
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { business: ref("Business") } }) },
    400: badRequest,
    401: unauthorized,
    403: errorResponse("Owner access required"),
    404: notFound,
  },
})

registry.registerPath({
  method: "delete",
  path: "/api/v1/businesses/{businessId}",
  tags: ["Businesses"],
  summary: "Deactivate a business",
  parameters: [businessId],
  responses: {
    200: okFlag(),
    401: unauthorized,
    403: errorResponse("Owner access required"),
    404: notFound,
  },
})

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------
registry.registerPath({
  method: "get",
  path: "/api/v1/businesses/{businessId}/branches",
  tags: ["Branches"],
  summary: "List branches for a business",
  parameters: [businessId],
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { branches: { type: "array", items: ref("Branch") } } }) },
    401: unauthorized,
    404: notFound,
  },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/businesses/{businessId}/branches",
  tags: ["Branches"],
  summary: "Create a branch",
  parameters: [businessId],
  request: { body: jsonBody(branchCreateSchema) },
  responses: {
    201: { description: "Created", content: json({ type: "object", properties: { branch: ref("Branch") } }) },
    400: badRequest,
    401: unauthorized,
    403: errorResponse("Owner access required"),
    404: notFound,
    409: conflict,
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/businesses/{businessId}/branches/{branchId}",
  tags: ["Branches"],
  summary: "Get a branch",
  parameters: [businessId, branchId],
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { branch: ref("Branch") } }) },
    401: unauthorized,
    404: notFound,
  },
})

registry.registerPath({
  method: "patch",
  path: "/api/v1/businesses/{businessId}/branches/{branchId}",
  tags: ["Branches"],
  summary: "Update a branch",
  parameters: [businessId, branchId],
  request: { body: jsonBody(updateBranchSchema) },
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { branch: ref("Branch") } }) },
    400: badRequest,
    401: unauthorized,
    403: errorResponse("Management access required"),
    404: notFound,
  },
})

registry.registerPath({
  method: "delete",
  path: "/api/v1/businesses/{businessId}/branches/{branchId}",
  tags: ["Branches"],
  summary: "Deactivate a branch",
  parameters: [businessId, branchId],
  responses: {
    200: okFlag(),
    401: unauthorized,
    403: errorResponse("Owner access required"),
    404: notFound,
  },
})

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
registry.registerPath({
  method: "get",
  path: "/api/v1/businesses/{businessId}/products",
  tags: ["Products"],
  summary: "List products for a business",
  parameters: [
    businessId,
    { name: "q", in: "query", required: false, schema: { type: "string" }, description: "Name filter" },
  ],
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { products: { type: "array", items: ref("Product") } } }) },
    401: unauthorized,
    404: notFound,
  },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/businesses/{businessId}/products",
  tags: ["Products"],
  summary: "Create a product",
  parameters: [businessId],
  request: { body: jsonBody(productInputSchema) },
  responses: {
    201: { description: "Created", content: json({ type: "object", properties: { product: ref("Product") } }) },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/businesses/{businessId}/products/{productId}",
  tags: ["Products"],
  summary: "Get a product",
  parameters: [businessId, productId],
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { product: ref("Product") } }) },
    401: unauthorized,
    404: notFound,
  },
})

registry.registerPath({
  method: "put",
  path: "/api/v1/businesses/{businessId}/products/{productId}",
  tags: ["Products"],
  summary: "Update a product",
  parameters: [businessId, productId],
  request: { body: jsonBody(productInputSchema) },
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { product: ref("Product") } }) },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
})

registry.registerPath({
  method: "delete",
  path: "/api/v1/businesses/{businessId}/products/{productId}",
  tags: ["Products"],
  summary: "Delete a product",
  parameters: [businessId, productId],
  responses: {
    200: okFlag(),
    401: unauthorized,
    404: notFound,
  },
})

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
registry.registerPath({
  method: "get",
  path: "/api/v1/businesses/{businessId}/invoices",
  tags: ["Invoices"],
  summary: "List invoices (paginated)",
  parameters: [
    businessId,
    { name: "page", in: "query", required: false, schema: { type: "integer" } },
    { name: "pageSize", in: "query", required: false, schema: { type: "integer" } },
    { name: "branchId", in: "query", required: false, schema: { type: "string" }, description: "Restrict to a branch" },
  ],
  responses: {
    200: { description: "OK", content: json(ref("InvoiceList")) },
    401: unauthorized,
    404: notFound,
  },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/businesses/{businessId}/invoices",
  tags: ["Invoices"],
  summary: "Create an invoice",
  parameters: [
    businessId,
    { name: "Idempotency-Key", in: "header", required: false, schema: { type: "string" }, description: "Optional idempotency key" },
  ],
  request: { body: jsonBody(invoiceCreateApiSchema) },
  responses: {
    201: { description: "Created", content: json({ type: "object", properties: { invoice: ref("Invoice") } }) },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
})

registry.registerPath({
  method: "get",
  path: "/api/v1/businesses/{businessId}/invoices/{invoiceId}",
  tags: ["Invoices"],
  summary: "Get an invoice",
  parameters: [businessId, invoiceId],
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { invoice: ref("Invoice") } }) },
    401: unauthorized,
    404: notFound,
  },
})

registry.registerPath({
  method: "put",
  path: "/api/v1/businesses/{businessId}/invoices/{invoiceId}",
  tags: ["Invoices"],
  summary: "Update an invoice (rejects registered invoices)",
  parameters: [businessId, invoiceId],
  request: { body: jsonBody(invoiceInputSchema) },
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { invoice: ref("Invoice") } }) },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
})

registry.registerPath({
  method: "delete",
  path: "/api/v1/businesses/{businessId}/invoices/{invoiceId}",
  tags: ["Invoices"],
  summary: "Delete an invoice",
  parameters: [businessId, invoiceId],
  responses: {
    200: okFlag(),
    401: unauthorized,
    404: notFound,
    409: conflict,
  },
})

// ---------------------------------------------------------------------------
// Invoice lifecycle (EIMS)
// ---------------------------------------------------------------------------
registry.registerPath({
  method: "post",
  path: "/api/v1/businesses/{businessId}/invoices/{invoiceId}/register",
  tags: ["Invoices"],
  summary: "Register an invoice with EIMS",
  parameters: [businessId, invoiceId],
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { ok: { type: "boolean" }, irn: { type: "string" } } }) },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    429: errorResponse("EIMS rate limit"),
    502: errorResponse("EIMS credentials error"),
  },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/businesses/{businessId}/invoices/{invoiceId}/cancel",
  tags: ["Invoices"],
  summary: "Cancel a registered invoice on EIMS",
  parameters: [businessId, invoiceId],
  request: { body: jsonBody(cancelInputSchema) },
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { ok: { type: "boolean" }, cancelledAt: { type: "string" } } }) },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
    502: errorResponse("EIMS credentials error"),
  },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/businesses/{businessId}/invoices/{invoiceId}/receipt",
  tags: ["Invoices"],
  summary: "Issue a sales receipt on EIMS",
  parameters: [businessId, invoiceId],
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { ok: { type: "boolean" }, rrn: { type: "string" }, qr: { type: "string" }, status: { type: "string" } } }) },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    502: errorResponse("EIMS credentials error"),
  },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/businesses/{businessId}/invoices/bulk-register",
  tags: ["Invoices"],
  summary: "Bulk-register invoices with EIMS",
  parameters: [businessId],
  request: { body: jsonBody(bulkIdsSchema) },
  responses: {
    202: { description: "Accepted", content: json({ type: "object", properties: { ok: { type: "boolean" }, operationId: { type: "string" }, conversationId: { type: "string" }, count: { type: "integer" } } }) },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    429: errorResponse("EIMS rate limit"),
    502: errorResponse("EIMS credentials error"),
  },
})

registry.registerPath({
  method: "post",
  path: "/api/v1/businesses/{businessId}/invoices/bulk-cancel",
  tags: ["Invoices"],
  summary: "Bulk-cancel invoices on EIMS",
  parameters: [businessId],
  request: { body: jsonBody(bulkCancelSchema) },
  responses: {
    200: { description: "OK", content: json({ type: "object", properties: { ok: { type: "boolean" }, operationId: { type: "string" }, count: { type: "integer" }, succeeded: { type: "integer" }, failed: { type: "integer" } } }) },
    400: badRequest,
    401: unauthorized,
    404: notFound,
    409: conflict,
    502: errorResponse("EIMS credentials error"),
  },
})

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
)

export function getOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions)
  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Cash Registrar API",
      version: "1.0.0",
      description:
        "Public API for managing businesses, branches, products, and invoices. Authenticate with `Authorization: Bearer <api_key>`.",
    },
    servers: [{ url: baseUrl }],
    security: [{ ApiKeyAuth: [] }],
  })
}
