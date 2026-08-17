import { invoiceInputSchema } from "@/lib/invoice-schema"

export const invoiceInternalCreateSchema = invoiceInputSchema
export const invoiceInternalUpdateSchema = invoiceInputSchema

export type InvoiceInternalCreateInput = typeof invoiceInternalCreateSchema.type
export type InvoiceInternalUpdateInput = typeof invoiceInternalUpdateSchema.type