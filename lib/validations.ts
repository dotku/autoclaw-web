import { z } from "zod";

// ── Shared primitives ──
const email = z.string().email().max(255);
const id = z.number().int().positive();
const shortText = z.string().min(1).max(255);
const longText = z.string().max(5000).optional();
const url = z.string().url().max(500).optional().or(z.literal(""));
const domain = z.string().max(255).optional().nullable();
const locale = z.enum(["en", "zh", "zh-TW", "fr"]).optional();

// ── Projects ──
export const createProjectSchema = z.object({
  action: z.literal("create_project"),
  name: shortText,
  website: url,
  description: longText,
  domain,
});

export const activateAgentSchema = z.object({
  action: z.literal("activate_agent"),
  project_id: id,
  agent_type: z.enum([
    "email_marketing", "seo_content", "lead_prospecting",
    "social_media", "product_manager", "sales_followup",
  ]),
  locale,
});

export const deactivateAgentSchema = z.object({
  action: z.literal("deactivate_agent"),
  agent_id: id,
});

export const resolveBlockerSchema = z.object({
  action: z.literal("resolve_blocker"),
  agent_id: id,
  blocker_index: z.number().int().min(0),
  value: z.string().max(2000).optional(),
});

export const updateAgentConfigSchema = z.object({
  action: z.literal("update_agent_config"),
  agent_id: id,
  config: z.record(z.unknown()),
});

export const updateProjectSchema = z.object({
  action: z.literal("update_project"),
  project_id: id,
  website: url,
  ga_property_id: z.string().max(20).optional().nullable(),
  description: longText,
  domain,
});

export const deleteProjectSchema = z.object({
  action: z.literal("delete_project"),
  project_id: id,
});

export const projectActionSchema = z.discriminatedUnion("action", [
  createProjectSchema,
  activateAgentSchema,
  deactivateAgentSchema,
  resolveBlockerSchema,
  updateAgentConfigSchema,
  updateProjectSchema,
  deleteProjectSchema,
]);

// ── Organizations ──
export const createOrgSchema = z.object({
  action: z.literal("create"),
  name: shortText,
  domain,
});

export const addMemberSchema = z.object({
  action: z.literal("add_member"),
  org_id: id,
  email,
  role: z.enum(["admin", "member"]).optional(),
});

export const removeMemberSchema = z.object({
  action: z.literal("remove_member"),
  org_id: id,
  member_email: email,
});

export const assignProjectSchema = z.object({
  action: z.literal("assign_project"),
  org_id: id,
  project_id: id,
});

export const updateMemberRoleSchema = z.object({
  action: z.literal("update_role"),
  org_id: id,
  member_email: email,
  role: z.enum(["admin", "member"]),
});

export const renameOrgSchema = z.object({
  action: z.literal("rename"),
  org_id: id,
  name: shortText,
});

export const deleteOrgSchema = z.object({
  action: z.literal("delete"),
  org_id: id,
});

export const orgActionSchema = z.discriminatedUnion("action", [
  createOrgSchema,
  addMemberSchema,
  removeMemberSchema,
  assignProjectSchema,
  updateMemberRoleSchema,
  renameOrgSchema,
  deleteOrgSchema,
]);

// ── Team Members ──
export const inviteTeamMemberSchema = z.object({
  email,
  project_id: id,
});

// ── Helper ──
export function parseOrError<T>(schema: z.ZodSchema<T>, data: unknown): { data: T } | { error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { error: msg };
  }
  return { data: result.data };
}
