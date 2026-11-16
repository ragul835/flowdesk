import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name is too short").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const createProjectSchema = z.object({
  name: z.string().min(2, "Project name is too short").max(80),
  description: z.string().max(500).optional().default(""),
  workspaceId: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).optional(),
});

const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const dueDate = z
  .string()
  .datetime()
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const createTaskSchema = z.object({
  projectId: z.string(),
  columnId: z.string(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().default(""),
  priority: priorityEnum.optional().default("MEDIUM"),
  assigneeId: z.string().nullable().optional(),
  dueDate: dueDate,
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  columnId: z.string().optional(),
  order: z.number().int().optional(),
  priority: priorityEnum.optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: dueDate,
});

export const createCommentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(2000),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color");

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name is too short").max(80).optional(),
  title: z.string().max(80).optional(),
  avatarColor: hexColor.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const forgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const resetSchema = z.object({
  token: z.string().min(10, "Invalid reset token"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const roleEnum = z.enum(["OWNER", "ADMIN", "MEMBER"]);

export const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().min(2).max(80).optional(),
  role: roleEnum.optional().default("MEMBER"),
});

export const updateRoleSchema = z.object({
  role: roleEnum,
});
