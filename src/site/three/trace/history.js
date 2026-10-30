// The résumé as a git history. Experience and education become commits on branches: the main
// lane is Grootan Technologies, each client stream forks off it and merges back, and the degree
// is its own branch that merges in at graduation. Newest first, like `git log --graph`.
//
// Only dates the résumé gives are shown (Jun 2023, May 2024, Q3 2024, 2020–2024); everything else
// is labelled by the stream it belongs to. No three imports: the DOM section reads this too.

export const ROW = 1.12; // world distance between two commits

export const LANES = {
  edu: { name: "edu/sri-krishna", x: -1, z: 0.7, tone: "paper" },
  main: { name: "main", x: 0, z: 0, tone: "phosphor" },
  ibm: { name: "client/ibm-idp", x: 1, z: -0.7, tone: "tape" },
  migros: { name: "client/migros-cip", x: 2, z: 0.7, tone: "signal" },
  shiftpen: { name: "poc/shiftpen", x: 3, z: -0.7, tone: "blue" },
};

const GROOT = "Grootan Technologies, Chennai";
const IBM = "IBM · Identity Provider Platform (IDP) for IBM e-Health";
const MIGROS = "Migros · Consumer Identity Platform";
const SHIFT = "Product PoC · ShiftPen, multi-signer digital e-signing platform";

// Oldest first, the order they were written in. `at` is where each stream's commits sit in time.
const COMMITS = [
  { id: "e0", lane: "edu", kind: "root", group: "edu", parents: [], when: "2020", where: "Sri Krishna College of Technology · Coimbatore, India",
    subject: "init: B.E. Computer Science & Engineering",
    body: "Enrolled at Sri Krishna College of Technology, Coimbatore, India. Bachelor of Engineering in Computer Science and Engineering.",
    tech: [], refs: [] },
  { id: "m0", lane: "main", kind: "root", group: "work", parents: [], when: "Jun 2023", where: GROOT,
    subject: "init: Junior Software Engineer – Intern",
    body: "Joined Grootan Technologies in Chennai as a Junior Software Engineer – Intern. June 2023 – May 2024.",
    tech: [], refs: [] },
  { id: "m1", lane: "main", kind: "commit", group: "work", parents: ["m0"], when: "Intern · 2023 – 24", where: GROOT,
    subject: "feat(keycloak): JSON-based partial tenant import",
    body: "Built a JSON-based partial tenant import for Keycloak, enabling repeatable setup of clients, users, roles, and authentication flows across environments.",
    tech: ["Keycloak"], refs: [] },
  { id: "m2", lane: "main", kind: "commit", group: "work", parents: ["m1"], when: "Intern · 2023 – 24", where: GROOT,
    subject: "chore(keycloak): migrate 22 → 24",
    body: "Supported the Keycloak 22 to 24 migration by resolving compatibility issues and bugs.",
    tech: ["Keycloak"], refs: [] },
  { id: "m3", lane: "main", kind: "commit", group: "work", parents: ["m2"], when: "Intern · 2023 – 24", where: GROOT,
    subject: "perf(auth): WebSockets replace polling",
    body: "Replaced legacy polling with WebSockets in a web-to-app authentication flow, coordinating the changes across components without breaking existing clients.",
    tech: ["WebSockets"], refs: [] },
  { id: "em", lane: "main", kind: "merge", group: "edu", parents: ["m3", "e0"], when: "2020 – 2024", where: "Sri Krishna College of Technology · Coimbatore, India",
    subject: "Merge branch 'edu/sri-krishna'",
    body: "Graduated with a Bachelor of Engineering in Computer Science and Engineering from Sri Krishna College of Technology, Coimbatore, India. CGPA: 8.85.",
    tech: [], refs: ["CGPA 8.85"] },
  { id: "p", lane: "main", kind: "tag", group: "work", parents: ["em"], when: "May 2024", where: GROOT,
    subject: "release: Software Engineer",
    body: "Software Engineer at Grootan Technologies, Chennai, from May 2024. Client work on the IBM e-Health identity platform, the Migros consumer identity platform, and the ShiftPen e-signing product PoC.",
    tech: [], refs: ["Software Engineer"] },

  { id: "i1", lane: "ibm", kind: "commit", group: "work", parents: ["p"], when: "May 2024 – Present", where: IBM,
    subject: "feat(idp): own 3 of 8 production microservices",
    body: "Develop and maintain 3 of 8 production Java microservices supporting secure identity verification, authentication, device management, and usage tracking for IBM e-health applications, built with Spring Boot and Quarkus and serving tens of thousands of users.",
    tech: ["Java", "Spring Boot", "Quarkus", "Microservices"], refs: [] },
  { id: "i2", lane: "ibm", kind: "commit", group: "work", parents: ["i1"], when: "May 2024 – Present", where: IBM,
    subject: "feat(api): 50+ client-facing REST APIs",
    body: "Designed and implemented 50+ client-facing REST APIs for device management, identity history, usage tracking, and IDP access, including the Quarkus-based device management architecture.",
    tech: ["REST APIs", "Quarkus"], refs: [] },
  { id: "g1", lane: "migros", kind: "commit", group: "work", parents: ["p"], when: "Q3 2024", where: MIGROS,
    subject: "perf(auth): 1s polling → Server-Sent Events",
    body: "Redesigned real-time authentication event delivery from 1-second client polling to Server-Sent Events served directly from the IdP, cutting event delivery latency to near-immediate.",
    tech: ["SSE"], refs: [] },
  { id: "g2", lane: "migros", kind: "commit", group: "work", parents: ["g1"], when: "Q3 2024", where: MIGROS,
    subject: "refactor(flow): 4 components → 2",
    body: "Reduced the flow from 4 components to 2, removing the intermediary failure points from the previous socket.io-based setup.",
    tech: ["SSE"], refs: [] },
  { id: "i3", lane: "ibm", kind: "commit", group: "work", parents: ["i2"], when: "May 2024 – Present", where: IBM,
    subject: "feat(security): end-to-end mTLS",
    body: "Implemented end-to-end mTLS for owned microservices, integrating PKI-issued certificates, IBM Secrets Manager, Kubernetes External Secrets, and Java keystores/truststores and HTTP clients to secure automated service-to-service communication across environments.",
    tech: ["mTLS", "PKI", "Kubernetes", "Java"], refs: [] },
  { id: "g3", lane: "migros", kind: "commit", group: "work", parents: ["g2"], when: "Q3 2024", where: MIGROS,
    subject: "feat(events): Infinispan as distributed pub/sub",
    body: "Redesigned the cluster-wide event propagation architecture using Infinispan as a distributed pub/sub layer, owning the architecture and flow design.",
    tech: ["Infinispan"], refs: [] },
  { id: "g4", lane: "migros", kind: "commit", group: "work", parents: ["g3"], when: "Q3 2024", where: MIGROS,
    subject: "feat(activation): omnichannel activation flow",
    body: "Implemented an omnichannel activation flow, supporting mobile push notifications, activation codes, and manual-letter verification.",
    tech: [], refs: [] },
  { id: "gm", lane: "main", kind: "merge", group: "work", parents: ["p", "g4"], when: "Q3 2024", where: MIGROS,
    subject: "Merge branch 'client/migros-cip'",
    body: "GROOT OF THE QUARTER – Q3 2024. Recognized for driving the SSE-based authentication redesign, reducing the latency and system size by two components.",
    tech: ["SSE"], refs: ["Groot of the Quarter · Q3 2024"], award: true },
  { id: "i4", lane: "ibm", kind: "commit", group: "work", parents: ["i3"], when: "May 2024 – Present", where: IBM,
    subject: "docs(adr): decision records for IBM architects",
    body: "Write and present Architecture Decision Records to IBM architects, evaluating backend design alternatives and documenting technical trade-offs for implementation decisions.",
    tech: [], refs: [] },
  { id: "i5", lane: "ibm", kind: "commit", group: "work", parents: ["i4"], when: "May 2024 – Present", where: IBM,
    subject: "fix(mtls): production certificate failure",
    body: "Diagnosed a production mTLS failure affecting service-to-service communication by tracing OpenTelemetry, Prometheus and application logs, identified a certificate configuration issue, and coordinated certificate rotation to restore connectivity.",
    tech: ["mTLS", "OpenTelemetry", "Prometheus", "PKI"], refs: [] },
  { id: "s1", lane: "shiftpen", kind: "commit", group: "work", parents: ["gm"], when: "Product PoC", where: SHIFT,
    subject: "feat(sign): provider-agnostic e-signature core",
    body: "Designed and implemented a provider-agnostic e-signature architecture, decoupling the core signing workflow from third-party APIs and enabling multiple providers to integrate through a common interface.",
    tech: ["Java", "Spring Boot"], refs: [] },
  { id: "s2", lane: "shiftpen", kind: "commit", group: "work", parents: ["s1"], when: "Product PoC", where: SHIFT,
    subject: "feat(workflow): multi-signer signing on Flowable",
    body: "Built the core multi-signer document signing workflow on Java, Spring Boot, and Flowable, coordinating multiple signers and the interactions with external signing providers.",
    tech: ["Java", "Spring Boot", "Flowable"], refs: [] },
  { id: "s3", lane: "shiftpen", kind: "commit", group: "work", parents: ["s2"], when: "Product PoC", where: SHIFT,
    subject: "feat(auth): OTP re-authentication on expiry",
    body: "Implemented OTP-based signer re-authentication on session expiry, ensuring signer identity is re-verified before continuing the signing flow.",
    tech: [], refs: [] },
  { id: "s4", lane: "shiftpen", kind: "commit", group: "work", parents: ["s3"], when: "Product PoC", where: SHIFT,
    subject: "release: backend shipped 4 weeks early",
    body: "Delivered the backend ahead of a 4-week deadline in a 3-engineer team, enabling stakeholder demos and first-client onboarding across workflow, provider integration, secure signing, and document lifecycle management.",
    tech: [], refs: [] },
  { id: "sm", lane: "main", kind: "merge", group: "work", parents: ["gm", "s4"], when: "Product PoC", where: SHIFT,
    subject: "Merge branch 'poc/shiftpen'",
    body: "ShiftPen, a multi-signer digital e-signing platform: provider-agnostic signing core, Flowable workflow, OTP re-authentication, delivered in a 3-engineer team.",
    tech: ["Flowable"], refs: [] },
  { id: "i6", lane: "ibm", kind: "commit", group: "work", parents: ["i5"], when: "May 2024 – Present", where: IBM,
    subject: "chore(k8s): Kubernetes & Helm changes",
    body: "Manage Kubernetes and Helm changes across the services including deployment manifests, configuration, secrets, and pod/log troubleshooting.",
    tech: ["Kubernetes", "Helm"], refs: [] },
  { id: "i7", lane: "ibm", kind: "commit", group: "work", parents: ["i6"], when: "May 2024 – Present", where: IBM,
    subject: "ci: own the GitHub Actions workflow",
    body: "Own the GitHub Actions CI/CD workflow, PR validation, Sonar checks, Helm chart and image publishing, scheduled smoke tests with Slack notifications.",
    tech: ["GitHub Actions", "Helm", "Docker"], refs: [] },
  { id: "i8", lane: "ibm", kind: "commit", group: "work", parents: ["i7"], when: "May 2024 – Present", where: IBM,
    subject: "mentor: onboard two interns in 2 months",
    body: "Led the 2-month technical onboarding of two interns, defining milestones, assigning tasks, conducting code reviews, and guiding them to independently take project tickets.",
    tech: [], refs: [] },
  { id: "h", lane: "main", kind: "head", group: "work", parents: ["sm", "i8"], when: "May 2024 – Present", where: GROOT,
    subject: "HEAD: Java Backend Engineer",
    body: "Java Backend Engineer with 2+ years building enterprise identity and authentication systems using Java, Spring Boot, Quarkus, and microservices. Specialize in IAM and security engineering with Keycloak, OAuth 2.0, and mTLS/PKI, with production ownership on Kubernetes-based healthcare platforms.",
    tech: ["Java", "Spring Boot", "Quarkus", "Keycloak", "OAuth 2.0", "mTLS", "Kubernetes"], refs: ["HEAD -> main"] },
];

function hashOf(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(7, "0").slice(0, 7);
}

export const STATS = [
  { value: "2+", label: "years" },
  { value: "50+", label: "REST APIs" },
  { value: "3/8", label: "services owned" },
  { value: "8.85", label: "CGPA" },
];

// Newest first. Each node knows its row (the y of the graph), its lane, and its edges.
export function buildHistory() {
  const N = COMMITS.length;
  const byId = new Map();
  const nodes = COMMITS.slice().reverse().map((c, i) => {
    const lane = LANES[c.lane];
    const node = { ...c, i, hash: hashOf(`${c.id}${c.subject}${c.when}`), branch: lane.name, x: lane.x, y: -i * ROW, z: lane.z };
    byId.set(c.id, node);
    return node;
  });

  // One edge per parent link, from the newer commit (child) down to its parent.
  const edges = [];
  nodes.forEach((child) => {
    child.parents.forEach((pid, k) => {
      const parent = byId.get(pid);
      const cross = parent.lane !== child.lane;
      // a merge curves away from the child right away; a fork curves into its parent at the bottom
      const bend = cross && k > 0 ? "top" : cross ? "bottom" : "none";
      // the colour of an edge is the branch lane's, never plain main
      const tone = LANES[cross ? (child.lane === "main" ? parent.lane : child.lane) : child.lane].tone;
      edges.push({ id: edges.length, from: child.i, to: parent.i, bend, tone, lane: cross ? (child.lane === "main" ? parent.lane : child.lane) : child.lane });
    });
  });

  const techCount = new Map();
  nodes.forEach((n) => n.tech.forEach((t) => techCount.set(t, (techCount.get(t) || 0) + 1)));
  const techs = [...techCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);

  // The newest commit of each lane carries its branch label.
  const tips = {};
  nodes.forEach((n) => { if (!(n.lane in tips)) tips[n.lane] = n.i; });

  return { nodes, edges, techs, tips, N, eduRow: nodes.find((n) => n.id === "em").i };
}

export const HISTORY = buildHistory();
