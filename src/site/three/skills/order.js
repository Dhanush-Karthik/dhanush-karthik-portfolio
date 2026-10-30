// The order of the stack, top of the cabinet to the bottom: the edge (networking) first, then the
// platform it runs on, the data, the code, and the practices around it. Categories are ranked by
// name; anything unrecognised keeps its CMS position after the frameworks.
const RANK = [
  [/network|dns|proxy|balanc|cdn|edge|gateway/i, 0],
  [/kube|k8s|orchestr|container|docker|cloud|infra|devops|platform|deploy|ci.?cd/i, 1],
  [/databas|data|storage|cache|queue|messag|stream/i, 2],
  [/language/i, 3],
  [/framework|librar|runtime/i, 4],
  [/auth|secur|iam|identity|tool|build|test|version/i, 5],
  [/architect|design|pattern|practice|principle/i, 6],
];
const UNKNOWN = 4.5;

export function stackOrder(skills = []) {
  const rank = (s) => {
    const hit = RANK.find(([re]) => re.test(String(s.category || "")));
    return hit ? hit[1] : UNKNOWN;
  };
  return skills
    .map((s, at) => ({ s, at, r: rank(s) }))
    .sort((a, b) => a.r - b.r || a.at - b.at)
    .map((x) => x.s);
}
