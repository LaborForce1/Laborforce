import type { UserTag } from "@laborforce/shared";

export const roleCards: Array<{ tag: UserTag; title: string; body: string }> = [
  {
    tag: "employee",
    title: "Employee",
    body: "Build a verified Proof Wall, browse jobs, and bid on Quick Cash work."
  },
  {
    tag: "employer",
    title: "Employer",
    body: "Post deposit-backed jobs, search verified workers, and manage CRM follow-ups."
  },
  {
    tag: "customer",
    title: "Customer",
    body: "Post urgent tasks, compare bids, and release escrow when work is complete."
  }
];

export const mobileFeed = {
  jobs: [
    {
      title: "Lead HVAC Installer",
      meta: "Williamsburg • $38-$52/hr • Surge"
    }
  ],
  quickCash: [
    {
      title: "Replace ceiling fan",
      meta: "East Village • $175-$260 • Escrow ready"
    }
  ],
  messages: [
    {
      title: "Northside HVAC",
      meta: "Can you start Monday on the retrofit?"
    }
  ]
};

