import { PrismaClient, Priority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_COLUMNS = ["Backlog", "To Do", "In Progress", "Done"];

/** Days from today as a Date (negative = past/overdue). */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

type TaskSpec = {
  title: string;
  column: string;
  priority: Priority;
  assignee: string | null; // key into users map
  due?: number; // days from now
  comments?: { author: string; body: string }[];
};

async function main() {
  console.log("🌱 Seeding FlowDesk...");

  await prisma.activity.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.column.deleteMany();
  await prisma.project.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 10);

  const users = {
    ada: await prisma.user.create({
      data: { name: "Ada Lovelace", email: "ada@flowdesk.dev", passwordHash, avatarColor: "#4f46e5", title: "Head of Product" },
    }),
    linus: await prisma.user.create({
      data: { name: "Linus Rivera", email: "linus@flowdesk.dev", passwordHash, avatarColor: "#0ea5e9", title: "Engineering Lead" },
    }),
    grace: await prisma.user.create({
      data: { name: "Grace Kim", email: "grace@flowdesk.dev", passwordHash, avatarColor: "#10b981", title: "Product Designer" },
    }),
    mateo: await prisma.user.create({
      data: { name: "Mateo Alvarez", email: "mateo@flowdesk.dev", passwordHash, avatarColor: "#f59e0b", title: "Full-Stack Engineer" },
    }),
    priya: await prisma.user.create({
      data: { name: "Priya Nair", email: "priya@flowdesk.dev", passwordHash, avatarColor: "#ec4899", title: "Frontend Engineer" },
    }),
  };

  const workspace = await prisma.workspace.create({
    data: {
      name: "Northwind Labs",
      memberships: {
        create: [
          { userId: users.ada.id, role: "OWNER" },
          { userId: users.linus.id, role: "ADMIN" },
          { userId: users.grace.id, role: "MEMBER" },
          { userId: users.mateo.id, role: "MEMBER" },
          { userId: users.priya.id, role: "MEMBER" },
        ],
      },
    },
  });

  async function createProject(
    name: string,
    description: string,
    tasks: TaskSpec[]
  ) {
    const project = await prisma.project.create({
      data: {
        name,
        description,
        workspaceId: workspace.id,
        columns: { create: DEFAULT_COLUMNS.map((n, i) => ({ name: n, order: i })) },
      },
      include: { columns: true },
    });
    const colId = (n: string) => project.columns.find((c) => c.name === n)!.id;

    let order = 0;
    for (const t of tasks) {
      const task = await prisma.task.create({
        data: {
          title: t.title,
          priority: t.priority,
          order: order++,
          dueDate: t.due !== undefined ? daysFromNow(t.due) : null,
          projectId: project.id,
          columnId: colId(t.column),
          assigneeId: t.assignee ? (users as Record<string, { id: string }>)[t.assignee].id : null,
        },
      });
      if (t.comments?.length) {
        for (const c of t.comments) {
          await prisma.comment.create({
            data: {
              body: c.body,
              taskId: task.id,
              authorId: (users as Record<string, { id: string }>)[c.author].id,
            },
          });
        }
      }
    }
    return project;
  }

  const website = await createProject(
    "Website Redesign",
    "Marketing site refresh with a new brand system and headless CMS.",
    [
      { title: "Audit current analytics & funnels", column: "Backlog", priority: "LOW", assignee: "grace", due: 6 },
      { title: "Migrate legacy blog content", column: "Backlog", priority: "LOW", assignee: null },
      {
        title: "Define brand color tokens",
        column: "To Do",
        priority: "MEDIUM",
        assignee: "ada",
        due: 3,
        comments: [
          { author: "linus", body: "Let's align these with the mobile palette so we only maintain one source of truth." },
          { author: "ada", body: "Agreed — I'll export them as CSS variables and Figma tokens." },
        ],
      },
      { title: "Set up headless CMS (Sanity)", column: "To Do", priority: "HIGH", assignee: "linus", due: 5 },
      {
        title: "Design new homepage hero",
        column: "In Progress",
        priority: "HIGH",
        assignee: "linus",
        due: -1,
        comments: [{ author: "ada", body: "Hero copy is approved by marketing, you're clear to finalize." }],
      },
      { title: "Build responsive navbar", column: "In Progress", priority: "MEDIUM", assignee: "grace", due: 2 },
      { title: "Launch staging environment", column: "Done", priority: "MEDIUM", assignee: "ada" },
    ]
  );

  const mobile = await createProject(
    "Mobile App v2",
    "React Native rewrite with offline sync and push notifications.",
    [
      {
        title: "Spike: offline-first data layer",
        column: "In Progress",
        priority: "URGENT",
        assignee: "linus",
        due: -2,
        comments: [
          { author: "mateo", body: "WatermelonDB is looking promising for the sync layer." },
          { author: "linus", body: "Good find. I'll prototype a conflict-resolution strategy this week." },
        ],
      },
      { title: "Push notification service", column: "To Do", priority: "HIGH", assignee: "ada", due: 7 },
      { title: "Onboarding screens", column: "To Do", priority: "MEDIUM", assignee: "grace", due: 9 },
      { title: "Biometric login", column: "Backlog", priority: "MEDIUM", assignee: "priya" },
      { title: "Crash reporting integration", column: "Done", priority: "LOW", assignee: "linus" },
    ]
  );

  const portal = await createProject(
    "Customer Portal",
    "Self-service billing, usage dashboards, and support tickets for customers.",
    [
      { title: "Stripe billing integration", column: "In Progress", priority: "HIGH", assignee: "mateo", due: 4 },
      {
        title: "Usage analytics dashboard",
        column: "To Do",
        priority: "MEDIUM",
        assignee: "priya",
        due: 10,
        comments: [{ author: "ada", body: "Let's reuse the chart components from the internal dashboard." }],
      },
      { title: "Role-based team invitations", column: "To Do", priority: "HIGH", assignee: "mateo", due: 8 },
      { title: "Support ticket inbox", column: "Backlog", priority: "MEDIUM", assignee: null },
      { title: "SSO (SAML) support", column: "Backlog", priority: "LOW", assignee: "priya" },
      { title: "Account settings & profile", column: "Done", priority: "MEDIUM", assignee: "grace" },
    ]
  );

  // Seed a realistic activity feed (most recent first when displayed).
  const feed: { actor: string; type: string; message: string; project: string | null; minsAgo: number }[] = [
    { actor: "ada", type: "PROJECT_CREATED", message: "Ada Lovelace created project “Customer Portal”", project: portal.id, minsAgo: 2880 },
    { actor: "mateo", type: "TASK_CREATED", message: "Mateo Alvarez created task “Stripe billing integration” in Customer Portal", project: portal.id, minsAgo: 2000 },
    { actor: "linus", type: "COMMENT_ADDED", message: "Linus Rivera commented on “Spike: offline-first data layer”", project: mobile.id, minsAgo: 600 },
    { actor: "grace", type: "TASK_MOVED", message: "Grace Kim moved “Build responsive navbar” to In Progress", project: website.id, minsAgo: 240 },
    { actor: "ada", type: "COMMENT_ADDED", message: "Ada Lovelace commented on “Define brand color tokens”", project: website.id, minsAgo: 90 },
    { actor: "linus", type: "TASK_COMPLETED", message: "Linus Rivera completed “Crash reporting integration”", project: mobile.id, minsAgo: 45 },
    { actor: "priya", type: "MEMBER_ADDED", message: "Ada Lovelace added Priya Nair to the workspace", project: null, minsAgo: 20 },
  ];
  for (const f of feed) {
    await prisma.activity.create({
      data: {
        workspaceId: workspace.id,
        actorId: (users as Record<string, { id: string }>)[f.actor].id,
        type: f.type,
        message: f.message,
        projectId: f.project,
        createdAt: new Date(Date.now() - f.minsAgo * 60000),
      },
    });
  }

  console.log("✅ Seed complete.");
  console.log("\nSample team accounts (password for all: password123):");
  console.log("  • ada@flowdesk.dev    (Owner)");
  console.log("  • linus@flowdesk.dev  (Admin)");
  console.log("  • grace@flowdesk.dev  (Member)");
  console.log("  • mateo@flowdesk.dev  (Member)");
  console.log("  • priya@flowdesk.dev  (Member)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
