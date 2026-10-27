// The portfolio + résumé at /work (unlisted; owner's call 2026-10-26). One source for the page
// and the PDF résumé, so the two never disagree. Only facts the owner gave or that the code shows.

export type ProjectState = "live" | "in-use" | "testing" | "lab";

export type Project = {
  id: string;
  name: string;
  /** One line: what it is, for someone who has never seen it. */
  line: string;
  state: ProjectState;
  href?: string;
  problem: string;
  built: readonly string[];
  stack: readonly string[];
  /** A screenshot under /media/work/. Private tools are shown with made-up data only. */
  shot?: { src: string; alt: string; w: number; h: number; note?: string };
  /** Real numbers, read from the project's own database on `asOf`. Never typed from memory. */
  stats?: { asOf: string; items: readonly { value: string; label: string }[] };
};

export const STATE_LABEL: Record<ProjectState, string> = {
  live: "Live",
  "in-use": "In daily use",
  testing: "Built, in testing",
  lab: "Prototype",
};

export const PROJECTS: readonly Project[] = [
  {
    id: "camphawk",
    name: "CampHawk",
    line: "Campsite cancellation alerts. When a booked-up campground opens up, you hear about it within seconds.",
    state: "live",
    href: "https://camphawk.app",
    problem: "Popular campgrounds book out months ahead, and cancellations get snapped up in minutes by whoever happens to be refreshing the page.",
    built: [
      "A service that watches the campgrounds you pick, for the nights you want, across Recreation.gov, ReserveCalifornia, ReserveAmerica and a dozen state park systems, and alerts you by text, push or email within seconds.",
      "Auto-Cart on Recreation.gov: puts the opened site in your cart, with a plain-English panel on exactly what it will and won't do.",
      "The product end to end: naming, plans, a 14-round redesign with a full design hand-off, and every failure and empty state.",
      "A self-running agent setup on a small Windows server, with written operating rules, permission tiers, scheduled runs and cost logging.",
    ],
    stack: ["Next.js", "TypeScript", "Vercel", "Postgres (Supabase)", "Text and push alerts", "Claude Code"],
    // Counted in CampHawk's database on 2026-10-26 (campgrounds, campsites, sent notifications, users).
    stats: {
      asOf: "October 2026",
      items: [
        { value: "8,000+", label: "campgrounds covered" },
        { value: "159,000+", label: "campsites tracked" },
        { value: "15", label: "booking systems" },
        { value: "2,000+", label: "alerts sent" },
        { value: "70+", label: "users since launch in June 2026" },
      ],
    },
  },
  {
    id: "morning-mail",
    name: "Morning Mail",
    line: "One morning report for three inboxes: what needs a reply, what's a bill, what's junk.",
    state: "in-use",
    problem: "Important email was getting buried across a Gmail and two Yahoo accounts.",
    built: [
      "Pulls a Gmail account (Google Apps Script) and two Yahoo accounts (IMAP) every morning on a schedule.",
      "Code rules sort first; an AI read (Google Gemini) summarizes each email and catches what the rules miss. The rules always win, so the AI can't bury a security alert.",
      "Every junk call says why, with one-tap Always trash and Not junk that become new rules and move the mail.",
    ],
    stack: ["Next.js", "Postgres (Supabase)", "Apps Script", "IMAP", "Gemini API", "Vercel Cron"],
    shot: { src: "/media/work/mail.webp", alt: "Morning Mail's report for the day: a Needs you list with an urgent call-time change, a power bill and a camping question, then a Security section with a new sign-in alert.", w: 1600, h: 1580, note: "Shown with made-up emails." },
  },
  {
    id: "money",
    name: "Household money tracker",
    line: "Spending, income and recurring bills for a two-person household, synced from the bank daily.",
    state: "in-use",
    problem: "Two people, a personal and a joint account, and no one place that showed where the money went.",
    built: [
      "Read-only daily bank sync (SimpleFIN) with 90-day backfill, categories, and rules you set once.",
      "Spots transfers between your own accounts so moving money never looks like spending.",
      "An Income tab that reads pay stubs and W-2s with AI and lines them up with the work calendar.",
    ],
    stack: ["Next.js", "Postgres (Supabase)", "SimpleFIN", "AI document reading", "Vercel Cron"],
    shot: { src: "/media/work/money.webp", alt: "The money tracker for September: money in, money out and net, a 12-month bar chart, spending by category and the two accounts.", w: 1600, h: 1393, note: "Shown with made-up accounts and transactions." },
  },
  {
    id: "vectorworks",
    name: "Vectorworks connector",
    line: "Lets an AI assistant draw in, measure and check a Vectorworks rigging plot, the way a head rigger works a show.",
    state: "testing",
    problem: "Rigging plots live in Vectorworks, and checking points, loads and bridles by hand is slow and easy to get wrong.",
    built: [
      "An MCP server that gives Claude tools to draw, measure, read Spotlight data and work a show: datum, departments, venue limits, point loads, bridles, mark-out, revisions.",
      "A live web panel that talks to Vectorworks on the same computer, never through the internet.",
      "Tested end to end against a strict stand-in for Vectorworks; first run on a real copy is next.",
    ],
    stack: ["Python", "MCP", "Vectorworks scripting", "Next.js"],
    shot: { src: "/media/work/vectorworks.webp", alt: "The Vectorworks panel connected to a rigging file: a plan view with two trusses and numbered lighting positions, layer filters and selection tools.", w: 1600, h: 1173, note: "Connected to a stand-in for Vectorworks with a sample rigging file." },
  },
  {
    id: "site-maps",
    name: "Campground site maps",
    line: "Clickable campsite maps for CampHawk, drawn from public survey data instead of hand-traced pictures.",
    state: "lab",
    problem: "Booking sites show campsites as flat pictures, often schematic and off by tens of meters.",
    built: [
      "Maps drawn from Recreation.gov's open campsite coordinates, with roads matched from whichever public source the sites fit best.",
      "A review queue with a tracing tool, so a person can fix a road from the aerial photo in a minute.",
      "Researched California State Parks' own campsite data and asked for permission before using it.",
    ],
    stack: ["Node scripts", "Open data (RIDB, OpenStreetMap)", "SVG", "Next.js"],
    shot: { src: "/media/work/map.webp", alt: "Site map of Upper Pines campground in Yosemite: roads, numbered campsites, restrooms and the Merced River, with open site 117 picked and its details beside the map.", w: 1600, h: 1226, note: "Upper Pines, Yosemite. Sites from Recreation.gov's open data; availability is an example." },
  },
];

/** How the owner works: the honest pitch. He directs AI tools and makes the calls; he's learning to read code. */
export const HOW_I_WORK: readonly { title: string; body: string }[] = [
  { title: "I direct the build", body: "I write the brief, break the work into steps and steer AI coding tools, mainly Claude Code, through it. I make the product, design and trade-off calls." },
  { title: "I check the real thing", body: "Nothing is done because the code compiled. I test it in a browser at phone and desktop sizes, against real data, and send it back when it's wrong." },
  { title: "I write the rules down", body: "Each project has written rules and notes, so the next session, or the next person, picks up where the last one stopped." },
  { title: "I'm learning to read code", body: "I'm working through a code-reading course I built for myself, so I can review what the tools write, not just whether it works." },
];

export type Job = { title: string; org: string; years?: string; lines: readonly string[] };

/** Filled from the owner's answers. Empty lists hide their section. */
export const RESUME = {
  name: "Tyler Flores",
  email: "TylerFlores1992@gmail.com",
  region: "Los Angeles area",
  headline: "I build working software with AI coding tools: products, automations and internal tools.",
  pdf: "/work/tyler-flores-resume.pdf",
  experience: [
    {
      title: "Key rigging grip, best boy rigging grip, rigging grip",
      org: "IATSE Local 80 · film and television",
      years: "11 years",
      lines: [
        "Key rigging grip: plan and run the rig with the key grip and gaffer, lead the crew, and own safety on every lift and hang.",
        "Best boy rigging grip: crew calls, gear orders, schedules and timecards; keep the rig on time and on budget.",
        "Rigging grip: build and strike truss, chain-motor points, overhead frames, diffusion and blackouts ahead of the shooting crew.",
      ],
    },
  ] as readonly Job[],
  certs: [] as readonly string[],
  skills: [
    { group: "Building with AI", items: ["Claude Code", "Writing specs and briefs", "Breaking work into steps", "Reviewing output against the brief"] },
    { group: "Shipping", items: ["Next.js on Vercel", "Postgres (Supabase)", "Scheduled jobs (cron)", "Deploys and rollbacks", "Browser testing"] },
    { group: "Automation", items: ["Google Apps Script", "Email (IMAP)", "Bank data (SimpleFIN)", "AI APIs (Gemini)", "MCP connectors"] },
    { group: "On set", items: ["Rig planning and load math", "Two-leg bridle calculations", "Leading a crew", "Safety on every lift and hang"] },
    { group: "Product", items: ["Naming and plans", "UX for error and empty states", "Accessibility (color-blind safe)", "Design hand-offs"] },
  ],
} as const;
