import {
  branchCreateSchema,
  businessUpdateApiSchema,
  createBusinessApiSchema,
  updateBranchSchema,
} from "@/lib/business-schema"

export const businessInternalCreateSchema = createBusinessApiSchema
export const businessInternalUpdateSchema = businessUpdateApiSchema
export const branchInternalCreateSchema = branchCreateSchema
export const branchInternalUpdateSchema = updateBranchSchema

export type BusinessInternalCreateInput = typeof businessInternalCreateSchema.type
export type BusinessInternalUpdateInput = typeof businessInternalUpdateSchema.type
export type BranchInternalCreateInput = typeof branchInternalCreateSchema.type
export type BranchInternalUpdateInput = typeof branchInternalUpdateSchema.type