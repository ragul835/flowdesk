import "server-only";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";

/** Thrown for authorization failures; carries an HTTP status for the route handler. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const ROLE_RANK: Record<Role, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

/** Returns the user's membership in a workspace, or throws 403. */
export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  minRole: Role = "MEMBER"
) {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) throw new HttpError(403, "You are not a member of this workspace.");
  if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw new HttpError(403, `Requires ${minRole} role or higher.`);
  }
  return membership;
}

/** Verifies the user can access a project (via workspace membership). Returns project + role. */
export async function requireProjectAccess(
  userId: string,
  projectId: string,
  minRole: Role = "MEMBER"
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new HttpError(404, "Project not found.");
  const membership = await requireWorkspaceRole(userId, project.workspaceId, minRole);
  return { project, role: membership.role };
}

/** All workspace IDs the user belongs to. */
export async function userWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
}

const ROLE_RANK_EXPORT: Record<Role, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

export function roleRank(role: Role): number {
  return ROLE_RANK_EXPORT[role];
}

/** The workspace where the user has the highest role (their "home" workspace). */
export async function primaryWorkspace(userId: string) {
  const memberships = await prisma.membership.findMany({ where: { userId } });
  if (memberships.length === 0) throw new HttpError(400, "No workspace found.");
  memberships.sort((a, b) => ROLE_RANK_EXPORT[b.role] - ROLE_RANK_EXPORT[a.role]);
  return memberships[0];
}
