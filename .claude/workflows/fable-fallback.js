export const meta = {
  name: "fable-fallback",
  description:
    "Delegation pipeline for when Opus 5.5 is the main model (Fable out of usage): evidence -> plan -> implement -> coverage-first review -> fix",
  whenToUse:
    "Fable usage is exhausted and the session runs on Opus 5.5 (session effort: medium). Pass the task description as args (a string). Plan-task mode: pass args = { task, planTask: { size, has_test_signal, high_risk, reportDir? } } for a certain task from an approved plan; Evidence and Plan are skipped and task is the spec verbatim.",
  phases: [
    {
      title: "Evidence",
      detail: "haiku-scout gathers code/context (skipped in plan-task mode)",
      model: "haiku",
    },
    {
      title: "Plan",
      detail:
        "The session model (Opus 5.5) diagnoses, sizes the task, and writes an implementation spec at high effort. Skipped in plan-task mode (args.planTask): the plan task text is the spec and args.planTask gives the sizing",
    },
    {
      title: "Implement",
      detail:
        "sonnet55-fixer (S/M with a test signal; opus55-implementer on server failure) or opus55-implementer (L, localStorage data-model, backup envelope, unit conversion, or shared-context work, no test signal) executes the spec",
    },
    {
      title: "Review",
      detail:
        "opus55-reviewer (or -deep for localStorage data-model, backup envelope, unit conversion, or shared-context work) coverage-first review written to review-1.md, then a targeted fix pass on the same implementer agent and a re-review of the fix written to review-2.md",
    },
    {
      title: "Decide",
      detail:
        "An open item from the plan or a stopped implementer: Opus decides, else the Fable advisor, else the run stops for the user",
    },
  ],
};

// Per-stage usage. agent() returns no token usage and Date.now() throws in workflow scripts, so the
// only measure is the budget.spent() difference around each call: output tokens only, from a pool
// shared with the main loop, so it is approximate; the full cost comes from the session transcript
// after the run.
const stage_usage = [];
function spentNow() {
  try {
    return typeof budget !== "undefined" && budget?.spent
      ? budget.spent()
      : null;
  } catch {
    return null;
  }
}
async function trackedAgent(prompt, opts) {
  const before = spentNow();
  try {
    return await agent(prompt, opts);
  } finally {
    const after = spentNow();
    const output_tokens_delta =
      before === null || after === null ? null : after - before;
    const agentType = opts?.agentType ?? "session-model";
    stage_usage.push({
      stage: opts?.label ?? "agent",
      agentType,
      output_tokens_delta,
    });
    log(
      `usage ${opts?.label ?? "agent"} (${agentType}): output_tokens_delta=${output_tokens_delta}`,
    );
  }
}

// Shared prompt rules per CLAUDE.md "Model delegation" and the Feature path escalation gate:
// - no "double-check"/"verify" nags (Opus 5.5 self-verifies; do state the test command)
// - scope discipline, deviation gate, no nested subagents, brief outcome-first report
// The project agent bodies (.claude/agents/*.md) already carry these; RULES is for the plan
// stage, which runs on the plain workflow subagent (session model), not on a project agent.
const RULES = `
Rules: Deliver what was asked, at the scope intended - don't narrow, widen, or transform the task. Finish the whole task; if part is impossible, do the rest and state plainly what's missing. Deviation gate: if anything deviates from what the task, plan, or spec states or assumes, stop and report the deviation and what you were about to do - no sensible defaults. No inline node -e / python -c / tsx -e; write scripts to files. Do the work directly - do not spawn subagents. Report back briefly, outcome first, no padding.`;

// Decision chain (2026-10-05): subagent stops and reports -> the Opus orchestrator decides ->
// if it cannot, it consults the Fable advisor (session started with `claude --advisor fable`) ->
// if the advisor is missing, unavailable, declines, or says it is the user's call, the run stops
// for the user. Subagents never call the advisor themselves (rule in every .claude/agents body).
const MAX_DECISIONS = 2;

const DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["outcome", "decided_by", "ruling", "question_for_user"],
  properties: {
    outcome: { enum: ["ruled", "ask_user"] },
    decided_by: { enum: ["opus", "fable-advisor", "none"] },
    ruling: { type: "string" },
    question_for_user: { type: "string" },
  },
};

// Runs on the session model (Opus 5.5), the orchestrator role, at high effort. Returns
// { outcome: 'ask_user', ... } when the agent fails, so a failure never becomes a ruling.
async function decide(openItem, source, context) {
  let d = null;
  try {
    d = await trackedAgent(
      `You are the orchestrator for this run. The ${source} stopped on an open item and needs a decision.

Task: ${task}

${context}

Open item: ${openItem}

Decide in this order:
1. Decide it yourself when the answer follows from the spec, the code, ARCHITECTURE.md, docs/DATA-MODEL.md, or docs/ and the item is not spec intent or a user-visible trade-off. Set decided_by to "opus".
2. Otherwise consult the advisor tool with the open item, the options, and your evidence. If it gives a clear ruling, set decided_by to "fable-advisor" and put its ruling and its reason in ruling.
3. If the advisor tool is missing, unavailable, declines, or says the user must decide, set outcome to "ask_user", decided_by to "none", and write question_for_user: the open item, the options, and your recommendation.

When outcome is "ruled", question_for_user is an empty string; when it is "ask_user", ruling is an empty string. Do not change any files. Do not spawn subagents. Report briefly.`,
      {
        label: `decide:${source}`,
        phase: "Decide",
        effort: "high",
        schema: DECISION_SCHEMA,
      },
    );
  } catch (e) {
    log(`decide threw: ${e?.message ?? e}`);
  }
  return (
    d ?? {
      outcome: "ask_user",
      decided_by: "none",
      ruling: "",
      question_for_user: `Decision stage failed. Open item from the ${source}: ${openItem}`,
    }
  );
}

const rulings = [];

// Same split as the CLAUDE.md delegation table. Dispatch is by agentType (the .claude/agents
// bodies pin model + effort: sonnet55-fixer = Sonnet 5.5 medium, opus55-implementer = Opus 5.5 medium),
// never by a bare model alias - the CLAUDE.md rule since 2026-09-03, Opus 5.5 rows since 2026-09-23,
// sonnet55-fixer since 2026-09-29. `fallback` is the agent for a server failure only (agent() returned
// null or threw), never for bad work: review findings go through the fix pass as usual. Only the
// Sonnet row has a fallback (opus55-implementer; the Opus 5 and Sonnet 5 agents were not ported here).
function implementerFor(sizing) {
  const small = sizing?.size === "S" || sizing?.size === "M";
  const testable = sizing?.has_test_signal === true;
  const risky = sizing?.high_risk === true;
  return small && testable && !risky
    ? { agentType: "sonnet55-fixer", fallback: "opus55-implementer" }
    : { agentType: "opus55-implementer", fallback: null };
}

// Runs one implementer stage. On a server failure the same prompt goes to the fallback agent.
// Returns the text and the agent type that produced it, so the fix pass stays on that agent.
// agent() also returns null when the user skips the agent mid-run; that falls back too.
async function runImplementer(impl, prompt, stage) {
  const tries = [...new Set([impl.agentType, impl.fallback].filter(Boolean))];
  for (const agentType of tries) {
    let out = null;
    try {
      out = await trackedAgent(prompt, {
        label: `${stage}:${agentType}`,
        phase: stage === "implement" ? "Implement" : "Review",
        agentType,
        schema: IMPL_SCHEMA,
      });
    } catch (e) {
      log(`${agentType} threw: ${e?.message ?? e}`);
    }
    if (out !== null && out !== undefined) return { out, agentType };
    const next = tries[tries.indexOf(agentType) + 1];
    log(
      next
        ? `${agentType} failed (server) - retrying on ${next}`
        : `${agentType} failed (server)`,
    );
  }
  return { out: null, agentType: tries[tries.length - 1] };
}

const IMPL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["report", "deviation"],
  properties: {
    report: { type: "string" },
    deviation: { type: "string" },
  },
};
const DEVIATION_ASK = `Put your report in report. If the deviation gate stops you, put the deviation and what you were about to do in deviation and stop there; otherwise set deviation to an empty string.`;

// Runs an implementer stage and routes a deviation stop through decide(). A ruling re-dispatches
// a fresh implementer (workflow agents cannot be resumed) with the ruling and the partial work.
// Returns { out, agentType, stopped } where stopped is the question for the user, or null.
async function runWithDecisions(impl, prompt, stage, context) {
  let p = prompt;
  for (let round = 0; ; round++) {
    const res = await runImplementer(impl, p, stage);
    if (res.out === null || !res.out.deviation)
      return { ...res, stopped: null };
    log(`${res.agentType} stopped on a deviation: ${res.out.deviation}`);
    if (round >= MAX_DECISIONS) {
      return {
        ...res,
        stopped: `Deviation limit (${MAX_DECISIONS}) reached. Last deviation: ${res.out.deviation}`,
      };
    }
    const d = await decide(
      res.out.deviation,
      `${stage} agent (${res.agentType})`,
      context,
    );
    rulings.push({ stage, item: res.out.deviation, ...d });
    if (d.outcome !== "ruled") return { ...res, stopped: d.question_for_user };
    log(`ruled by ${d.decided_by}: ${d.ruling}`);
    p = `${prompt}

An earlier run of this stage stopped on this deviation: ${res.out.deviation}
Its report: ${res.out.report}
Decision (${d.decided_by}): ${d.ruling}
That run's partial work is in the working tree. Continue from it under this decision.`;
  }
}

// Reviewer split per CLAUDE.md Feature path step 5: -deep for localStorage data-model, backup envelope, unit conversion, or shared-context work.
function reviewerFor(sizing) {
  return sizing?.high_risk === true
    ? "opus55-reviewer-deep"
    : "opus55-reviewer";
}

// args is either a task string (full pipeline) or an object { task, planTask?, reportDir? }.
// planTask = { size, has_test_signal, high_risk, reportDir? } selects plan-task mode: a certain task
// from an approved plan, so Evidence and Plan are skipped and the task text is the spec verbatim.
const isObjectArgs = args !== null && typeof args === "object";
const planTask = isObjectArgs && args.planTask ? args.planTask : null;
const task =
  typeof args === "string"
    ? args
    : isObjectArgs && typeof args.task === "string"
      ? args.task
      : JSON.stringify(args);
if (!task || task === "undefined") {
  return {
    error: "No task provided. Re-run with args = a task description string.",
  };
}
const reportDir = isObjectArgs
  ? (planTask?.reportDir ?? args.reportDir ?? null)
  : null;

let evidence = null;
let plan;
if (planTask) {
  // A plan task is certain by definition (the controller uses this mode only for certain tasks),
  // so uncertain_item is empty and the decision chain is not entered before Implement.
  plan = {
    size: planTask.size,
    has_test_signal: planTask.has_test_signal,
    high_risk: planTask.high_risk,
    uncertain_item: "",
    spec: task,
  };
  log("Plan-task mode: Evidence and Plan skipped; the task text is the spec");
} else {
  phase("Evidence");
  evidence = await trackedAgent(
    `You are gathering evidence only - do not change any files. Task under investigation: ${task}
Find and summarize everything an implementer needs: relevant files with paths and line numbers, how the current code works, related tests, and any project conventions that apply (check CLAUDE.md and docs/). Use grep and file reads. Return a compact structured summary.`,
    { label: "evidence", phase: "Evidence", agentType: "haiku-scout" },
  );

  phase("Plan");
  // No agentType here on purpose: this is the Fable role (diagnose, size, write the spec), so it
  // runs on the session model (Opus 5.5) and is the one stage pinned to high effort.
  plan = await trackedAgent(
    `Task: ${task}

Evidence gathered by a scout agent:
${evidence}

Diagnose the root cause (if a bug) or design the change (if a feature). Produce a self-contained implementation spec: exact files to touch, the precise changes, edge cases, and the exact test command that proves it works. The test command is \`npx vitest run <the test file(s)>\` for the files the spec names; never the full npm run check gate, which the controller runs once before the PR. Do NOT implement anything. Keep the spec tight - a competent agent should be able to execute it without asking questions.

Also size the task per CLAUDE.md "Execution part sizing": S (one source file plus its test, known change, no shared state), M (2-4 files in one subsystem, one test file proves it), L (5+ files, more than one view, or a localStorage key or stored shape, the backup envelope, unit conversion, or AppContext shared state). State whether a test command proves the change (has_test_signal) and whether it touches a localStorage key or stored shape, the backup envelope (export/import), kg/lb unit conversion, or AppContext shared state (high_risk).

Then check certainty (same section). The task is certain only if all six hold: (1) the spec states the exact behavior; (2) the files are named; (3) the ground truth it needs (spec section, docs/DATA-MODEL.md key, ARCHITECTURE.md section) is already written down; (4) a named test proves it; (5) it uses a mechanism the code already has; (6) no user-visible choice is left open. If any item fails, set uncertain_item to the item number and what is open; otherwise set it to an empty string. Do not settle an open item here and do not call the advisor tool - the Decide stage settles it.${RULES}`,
    {
      label: "plan",
      phase: "Plan",
      effort: "high",
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "size",
          "has_test_signal",
          "high_risk",
          "uncertain_item",
          "spec",
        ],
        properties: {
          size: { enum: ["S", "M", "L"] },
          has_test_signal: { type: "boolean" },
          high_risk: { type: "boolean" },
          uncertain_item: { type: "string" },
          spec: { type: "string" },
        },
      },
    },
  );
}

// An open item goes through the decision chain before any code changes. A ruling is appended to
// the spec; a stop for the user returns before Implement, and the session writes a handoff.
let spec = plan?.spec ?? plan;
if (plan?.uncertain_item) {
  log(`Uncertain: ${plan.uncertain_item} - deciding before Implement`);
  const d = await decide(
    plan.uncertain_item,
    "plan stage",
    `Evidence:\n${evidence}\n\nDraft spec:\n${spec}`,
  );
  rulings.push({ stage: "plan", item: plan.uncertain_item, ...d });
  if (d.outcome !== "ruled") {
    return {
      plan,
      rulings,
      stage_usage,
      stopped: `Task is uncertain and needs the user: ${d.question_for_user}`,
    };
  }
  log(`ruled by ${d.decided_by}: ${d.ruling}`);
  spec = `${spec}\n\nRuling on the open item "${plan.uncertain_item}" (${d.decided_by}): ${d.ruling}`;
}
const specContext = `Spec:\n${spec}`;

phase("Implement");
const implementer = implementerFor(plan);
const reviewer = reviewerFor(plan);
log(
  `size=${plan?.size} test_signal=${plan?.has_test_signal} risky=${plan?.high_risk} -> ${implementer.agentType}, review by ${reviewer}`,
);
const {
  out: implOut,
  agentType: implementedBy,
  stopped: implStopped,
} = await runWithDecisions(
  implementer,
  `Execute this implementation spec exactly. Full spec follows - you have everything you need; do not re-investigate beyond reading the named files.

${spec}

Write the code, add or update tests as the spec says, and run the stated test command. Report: what changed (files + one line each), test results verbatim, the mutation-check result, and anything from the spec you could not do. ${DEVIATION_ASK}`,
  "implement",
  specContext,
);
if (implOut === null) {
  return {
    plan,
    rulings,
    stage_usage,
    error: `Implementation failed (server failure) on ${[implementer.agentType, implementer.fallback].filter(Boolean).join(" and ")}.`,
  };
}
if (implStopped) {
  return {
    plan,
    rulings,
    stage_usage,
    implementation: implOut.report,
    stopped: `Implementation needs the user: ${implStopped}`,
  };
}
const implementation = implOut.report;

const FINDINGS_ITEMS = {
  type: "object",
  additionalProperties: false,
  required: ["file", "defect", "failure_scenario", "confidence", "severity"],
  properties: {
    file: { type: "string" },
    line: { type: "integer" },
    defect: { type: "string" },
    failure_scenario: { type: "string" },
    confidence: { enum: ["high", "medium", "low"] },
    severity: { enum: ["high", "medium", "low"] },
  },
};
// report_path: the file the reviewer wrote. reviewed_head: `git rev-parse HEAD` when the review
// began, so the re-review can diff only the fix commit(s) from there.
const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tests_pass", "findings", "report_path", "reviewed_head"],
  properties: {
    tests_pass: { type: "boolean" },
    test_output_summary: { type: "string" },
    report_path: { type: "string" },
    reviewed_head: { type: "string" },
    findings: { type: "array", items: FINDINGS_ITEMS },
  },
};

// Where review-1.md goes. Date.now() and new Date() throw in workflow scripts, so without a
// reportDir from args the reviewer resolves today's date itself with `date +%F`.
const review1Where = reportDir
  ? `Write your full review (every finding, the test result) to the file ${reportDir.replace(/\/+$/, "")}/review-1.md before returning, creating the directory if needed, and set report_path to that path.`
  : `Run \`date +%F\` in the working directory, then write your full review (every finding, the test result) to the file .superpowers/sdd/<that date>-workflow/review-1.md before returning, creating the directory if needed, and set report_path to the path you wrote.`;

phase("Review");
const review = await trackedAgent(
  `Review the changes just made for this task: ${task}

Implementer's report:
${implementation}

First record \`git rev-parse HEAD\` in reviewed_head. Run git diff to see the actual changes. Review standard (CLAUDE.md "Review dispatch standard"): verify claims against primary sources (the design spec under docs/superpowers/specs/, ARCHITECTURE.md, docs/DATA-MODEL.md, docs/TESTING.md, CONTRIBUTING.md, the tests), never against the implementer's report. Re-derive load-bearing work a different way and diff the results. Mutation-check every load-bearing guard: delete or invert it, confirm the tests fail, then revert; a test that still passes with the guard removed is a finding. Hunt the stale-read race (a value read before an await and used after it must be re-read after the await). Check the hard invariants in CLAUDE.md (weights stored in kg, no direct localStorage, useConfirm for destructive actions, no new libraries or CSS files). Report EVERY issue you find, including ones you are uncertain about or consider low-severity - do not filter for importance or confidence; a downstream step will do that. For each finding give: file:line, the defect, a concrete failure scenario, your confidence (high/medium/low), and estimated severity. Also confirm whether the tests actually pass by running the focused test file(s) in the foreground. Do not fix anything; revert any mutation-check edit before finishing.

Report file: ${review1Where}`,
  {
    label: `review:${reviewer}`,
    phase: "Review",
    agentType: reviewer,
    schema: REVIEW_SCHEMA,
  },
);

// Filter downstream (the reviewer was told not to): fix only credible, consequential findings.
const toFix = (review?.findings || []).filter(
  (f) => f.severity !== "low" && f.confidence !== "low",
);

// One fix pass on the same implementer agent type. Workflow agents cannot be resumed, so the
// CLAUDE.md "resume the implementer for rounds 1-3" rule does not apply here; a second round,
// if the controller wants one, is a fresh run of this workflow with the open findings as args.
let fixReport = null;
let fixRan = false;
if (!review?.tests_pass || toFix.length > 0) {
  log(`${toFix.length} finding(s) to fix; tests_pass=${review?.tests_pass}`);
  const fixImpl = { agentType: implementedBy, fallback: implementer.fallback };
  let fixOut, fixStopped;
  ({ out: fixOut, stopped: fixStopped } = await runWithDecisions(
    fixImpl,
    `Fix these confirmed issues in the changes for: ${task}

${!review?.tests_pass ? `Tests are FAILING. Test output summary: ${review?.test_output_summary || "unknown"} - make them pass first.\n` : ""}Findings to fix:
${JSON.stringify(toFix, null, 2)}

Fix only these items - nothing else. Run the stated test command and report results verbatim. ${DEVIATION_ASK}`,
    "fix",
    specContext,
  ));
  fixReport = fixOut?.report ?? null;
  fixRan = fixOut !== null && fixOut !== undefined;
  if (fixStopped) {
    return {
      plan,
      rulings,
      stage_usage,
      implementedBy,
      implementation,
      review,
      review_report_path: review?.report_path ?? null,
      fixReport,
      stopped: `Fix pass needs the user: ${fixStopped}`,
    };
  }
  if (!fixRan) log("Fix pass failed (server) - no re-review");
} else {
  log("Review clean and tests pass - no fix pass needed");
}

// Re-review of the fix commit(s) only, by the same reviewer agent type, after a fix pass ran.
// No second fix pass: its non-low findings go to deferred_findings for the controller.
let rereview = null;
let rereviewReportPath = null;
if (fixRan) {
  const review1Path = review?.report_path || "";
  const dir = review1Path.includes("/")
    ? review1Path.slice(0, review1Path.lastIndexOf("/"))
    : reportDir
      ? reportDir.replace(/\/+$/, "")
      : null;
  const review2Where = dir
    ? `Write your full re-review to the file ${dir}/review-2.md before returning and set report_path to that path.`
    : `Run \`date +%F\` in the working directory, then write your full re-review to the file .superpowers/sdd/<that date>-workflow/review-2.md before returning, and set report_path to the path you wrote.`;
  const base = review?.reviewed_head || "";
  rereview = await trackedAgent(
    `Re-review the fix pass for this task: ${task}

Review only the fix: run \`git diff ${base || "<the commit the first review covered>"}\` (from the commit the first review covered to HEAD and the working tree). Check it against the findings it was asked to fix, listed below, and report anything new the fix introduced. Do not re-review the original implementation beyond what the fix touched.

Findings the fix pass was asked to fix:
${JSON.stringify(toFix, null, 2)}
${!review?.tests_pass ? `\nThe first review also found failing tests: ${review?.test_output_summary || "unknown"}\n` : ""}
Fix pass report:
${fixReport}

Same review standard as the first review (CLAUDE.md "Review dispatch standard"): verify against primary sources, mutation-check every guard the fix adds or changes, hunt the stale-read race. For each finding still open or newly introduced give: file:line, the defect, a concrete failure scenario, your confidence (high/medium/low), and estimated severity. Report every issue; do not filter. Run the focused test file(s) in the foreground and set tests_pass. Set reviewed_head to \`git rev-parse HEAD\`. Do not fix anything; revert any mutation-check edit before finishing.

Report file: ${review2Where}`,
    {
      label: `rereview:${reviewer}`,
      phase: "Review",
      agentType: reviewer,
      schema: REVIEW_SCHEMA,
    },
  );
  rereviewReportPath = rereview?.report_path ?? null;
}

return {
  plan,
  implementedBy,
  implementation,
  review,
  review_report_path: review?.report_path ?? null,
  deferred_findings: [
    ...(review?.findings || []).filter((f) => !toFix.includes(f)),
    ...(rereview?.findings || []).filter((f) => f.severity !== "low"),
  ],
  fixReport,
  rereview,
  rereview_report_path: rereviewReportPath,
  rulings,
  stage_usage,
};
