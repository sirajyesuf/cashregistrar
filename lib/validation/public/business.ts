import {
  branchCreateSchema,
  businessUpdateApiSchema,
  createBusinessApiSchema,
  updateBranchSchema,
} from "@/lib/business-schema"

export const businessPublicCreateSchema = createBusinessApiSchema
export const businessPublicUpdateSchema = businessUpdateApiSchema
export const branchPublicCreateSchema = branchCreateSchema
export const branchPublicUpdateSchema = updateBranchSchema

export type BusinessPublicCreateInput = typeof businessPublicCreateSchema.type
export type BusinessPublicUpdateInput = typeof businessPublicUpdateSchema.type
export type BranchPublicCreateInput = typeof branchPublicCreateSchema.type
export type BranchPublicUpdateInput = typeof branchPublicUpdateSchema.type