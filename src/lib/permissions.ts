// Phase 7: Permission & Role Logic
// Capability map for the Knowledge platform.
// Roles: staff < trainer < admin. (`learner` has no staff-console access.)

export type ConsoleRole = "staff" | "trainer" | "admin";

export type Capability =
  // Knowledge Product
  | "knowledge.create"
  | "knowledge.capture"               // record / upload / transcribe
  | "knowledge.editOwn"
  | "knowledge.editAny"
  | "knowledge.submitForReview"
  | "knowledge.review"                // mark review / approve / reject
  | "knowledge.publish"
  | "knowledge.archive"
  | "knowledge.delete"
  // Knowledge Management
  | "km.categorize"
  | "km.manageCollections"
  | "km.linkToTraining"
  // Knowledge Translation
  | "translation.fromOwn"             // staff: own assets only
  | "translation.fromApproved"        // trainer: any approved/published asset
  | "translation.fromAny"             // admin: any asset
  | "translation.publish"
  // Talent
  | "talent.viewOwn"
  | "talent.viewAll"
  | "talent.editMapping"
  // Admin / Settings
  | "roles.manage"
  | "taxonomy.edit"                   // domain/tags/audience/format/tone
  | "users.manage";

const ROLE_CAPS: Record<ConsoleRole, Capability[]> = {
  staff: [
    "knowledge.create",
    "knowledge.capture",
    "knowledge.editOwn",
    "knowledge.submitForReview",
    "translation.fromOwn",
    "talent.viewOwn",
  ],
  trainer: [
    "knowledge.create",
    "knowledge.capture",
    "knowledge.editOwn",
    "knowledge.editAny",
    "knowledge.submitForReview",
    "knowledge.review",
    "km.categorize",
    "km.manageCollections",
    "km.linkToTraining",
    "translation.fromOwn",
    "translation.fromApproved",
    "translation.publish",
    "talent.viewOwn",
    "talent.viewAll",
    "talent.editMapping",
  ],
  admin: [
    "knowledge.create",
    "knowledge.capture",
    "knowledge.editOwn",
    "knowledge.editAny",
    "knowledge.submitForReview",
    "knowledge.review",
    "knowledge.publish",
    "knowledge.archive",
    "knowledge.delete",
    "km.categorize",
    "km.manageCollections",
    "km.linkToTraining",
    "translation.fromOwn",
    "translation.fromApproved",
    "translation.fromAny",
    "translation.publish",
    "talent.viewOwn",
    "talent.viewAll",
    "talent.editMapping",
    "roles.manage",
    "taxonomy.edit",
    "users.manage",
  ],
};

export function highestRole(roles: readonly string[]): ConsoleRole {
  if (roles.includes("superadmin") || roles.includes("admin")) return "admin";
  if (roles.includes("trainer")) return "trainer";
  return "staff";
}

export function can(role: ConsoleRole, cap: Capability): boolean {
  return ROLE_CAPS[role].includes(cap);
}

/**
 * Decide whether a user can edit a given asset.
 * Staff can only edit assets they own; trainer/admin can edit any.
 */
export function canEditAsset(
  role: ConsoleRole,
  ctx: { ownerId?: string | null; currentUserId?: string | null },
): boolean {
  if (can(role, "knowledge.editAny")) return true;
  if (!can(role, "knowledge.editOwn")) return false;
  if (!ctx.ownerId || !ctx.currentUserId) return false;
  return ctx.ownerId === ctx.currentUserId;
}

/**
 * Decide whether a user can translate from a given asset.
 * - staff: only own (any status)
 * - trainer: own OR approved/published
 * - admin: anything
 */
export function canTranslateAsset(
  role: ConsoleRole,
  ctx: { ownerId?: string | null; currentUserId?: string | null; status?: string },
): boolean {
  if (can(role, "translation.fromAny")) return true;
  const isOwn = !!ctx.ownerId && ctx.ownerId === ctx.currentUserId;
  if (isOwn && can(role, "translation.fromOwn")) return true;
  const approved = ctx.status === "published" || ctx.status === "review";
  if (approved && can(role, "translation.fromApproved")) return true;
  return false;
}

export const ROLE_LABEL: Record<ConsoleRole, { en: string; th: string }> = {
  staff: { en: "Staff", th: "เจ้าหน้าที่" },
  trainer: { en: "Trainer", th: "ผู้สอน" },
  admin: { en: "Admin", th: "ผู้ดูแลระบบ" },
};
