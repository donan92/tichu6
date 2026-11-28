"""Plot numeric local-only samples exported by stability-summary.mjs."""

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

source = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/stability-results.json")
out = Path(sys.argv[2] if len(sys.argv) > 2 else "docs/stability-memory.png")
data = json.loads(source.read_text())
runs = [r for r in data["runs"] if r["kind"] == "two-hour churn"]
MIB = 1024 * 1024
colors = {"before": "#64748b", "after": "#087f8c"}
retainers = {
    (r["case"], r["file"]): r
    for r in json.loads(source.with_name("stability-retainers.json").read_text())
}
fig, axes = plt.subplots(4, 2, figsize=(14, 14), layout="constrained")
for run in runs:
    column = int(run["consent"])
    samples = run["serverSamples"]
    first = samples[0]["at"]
    times = [(s["at"] - first) / 60000 for s in samples]
    color = colors[run["variant"]]
    label = "Baseline" if run["variant"] == "before" else "Candidate"
    axes[0, column].plot(
        times,
        [s["memory"]["heapUsed"] / MIB for s in samples],
        color=color,
        alpha=0.7,
        label=f"{label} used",
    )
    axes[0, column].plot(
        times,
        [s["memory"]["heapTotal"] / MIB for s in samples],
        color=color,
        linestyle=":",
        alpha=0.65,
        label=f"{label} total",
    )
    collected = [s for s in samples if s["memory"].get("afterSnapshot")]
    case = (
        ("baseline-" if run["variant"] == "before" else "candidate-")
        + ("on" if run["consent"] else "off")
        + ("-v2" if run["variant"] == "before" else "")
    )
    captured = [
        retainers[
            (case, "heap-" + str(s.get("label") or s["index"]) + ".heapsnapshot")
        ]["shallowBytesTotal"]
        / MIB
        for s in collected
    ]
    axes[1, column].plot(
        [(s["at"] - first) / 60000 for s in collected],
        captured,
        color=color,
        marker="D",
        markersize=5,
        label=label,
    )
    axes[2, column].plot(
        times,
        [
            sum(
                p["rssBytes"]
                for p in s["runtimeProcesses"]
                if p["role"] == "user-workerd"
            )
            / MIB
            for s in samples
        ],
        color=color,
        label=f"{label} user workerd",
    )
    axes[2, column].plot(
        times,
        [sum(p["rssBytes"] for p in s["runtimeProcesses"]) / MIB for s in samples],
        color=color,
        linestyle="--",
        alpha=0.6,
        label=f"{label} all runtime processes",
    )
    axes[3, column].plot(
        times,
        [s["memory"]["backingStorage"] / MIB for s in samples],
        color=color,
        label=f"{label} backing storage",
    )
    axes[3, column].plot(
        times,
        [s["memory"]["embedderHeapUsed"] / MIB for s in samples],
        color=color,
        linestyle=":",
        label=f"{label} embedder heap",
    )
control = data.get("unprofiledControl")
if control and control.get("resources"):
    resources = control["resources"]
    first = resources[0]["at"]
    axes[2, 1].plot(
        [(s["at"] - first) / 60000 for s in resources],
        [
            sum(p["rssBytes"] for p in s["processes"] if p["role"] == "user-workerd")
            / MIB
            for s in resources
        ],
        color="#c46c18",
        linewidth=2,
        label="Candidate, no snapshot (1h control)",
    )
for col in range(2):
    axes[0, col].set_title(f"Recording {'ON' if col else 'OFF'} — 100 users / 20 rooms")
    for row, name in enumerate(
        [
            "V8 heap (MiB)",
            "Captured snapshot node bytes (MiB)",
            "Process RSS (MiB)",
            "Inspector auxiliary memory (MiB)",
        ]
    ):
        ax = axes[row, col]
        ax.set_ylabel(name)
        ax.set_xlabel("Minutes since first server sample")
        ax.grid(alpha=0.2)
        ax.set_ylim(bottom=0)
        ax.legend(fontsize=8, ncol=2)
fig.suptitle(
    "Tichu6 local two-hour stability — independent before/after workloads", fontsize=16
)
fig.text(
    0.5,
    -0.012,
    "Concurrent local runtimes; control ran in final hour; snapshots trigger GC. Workerd external memory is unavailable, not zero. RSS is not billed DO Duration.",
    ha="center",
    fontsize=9,
)
fig.savefig(out, dpi=160, bbox_inches="tight")
print(out)
