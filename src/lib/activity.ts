import "server-only";
import { prisma } from "./prisma";

type ActivityType =
  | "PROJECT_CREATED"
  | "TASK_CREATED"
  | "TASK_MOVED"
  | "TASK_COMPLETED"
  | "TASK_DELETED"
  | "COMMENT_ADDED"
  | "MEMBER_ADDED";

/** Records an activity-feed entry. Never throws into the caller's request. */
export async function logActivity(input: {
  workspaceId: string;
  actorId: string;
  type: ActivityType;
  message: string;
  projectId?: string | null;
}) {
  try {
    await prisma.activity.create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        type: input.type,
        message: input.message,
        projectId: input.projectId ?? null,
      },
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
