export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Role = "OWNER" | "ADMIN" | "MEMBER";

export type UserBadge = {
  id: string;
  name: string;
  avatarColor: string;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
  title: string;
};

export type TaskDTO = {
  id: string;
  title: string;
  description: string;
  order: number;
  priority: Priority;
  dueDate: string | null;
  columnId: string;
  assignee: UserBadge | null;
  commentCount: number;
};

export type CommentDTO = {
  id: string;
  body: string;
  createdAt: string;
  author: UserBadge;
};

export type ActivityItem = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  projectId: string | null;
  actor: UserBadge;
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  title: string;
};

export type ColumnDTO = {
  id: string;
  name: string;
  order: number;
  tasks: TaskDTO[];
};

export type ProjectDetail = {
  id: string;
  name: string;
  description: string;
  role: Role;
  columns: ColumnDTO[];
  members: Member[];
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  workspaceName: string;
  taskCount: number;
  doneCount: number;
};

export type Analytics = {
  totalProjects: number;
  totalTasks: number;
  completionRate: number;
  byPriority: { priority: Priority; count: number }[];
  byAssignee: { name: string; count: number }[];
  byColumn: { name: string; count: number }[];
};
