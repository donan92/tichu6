"""Export numeric retention summaries, never raw heap strings/credentials.

Run with `uv run --project scripts/performance --locked scripts/performance/analyze_heap.py /tmp/.../*.heapsnapshot`.
Snapshots are trusted local test artifacts; output does not contain user values.
"""

import collections
import json
import sys
from pathlib import Path

import networkx as nx


def analyze(file):
    s = json.loads(Path(file).read_text())
    meta = s["snapshot"]["meta"]
    nodes = s["nodes"]
    edges = s["edges"]
    strings = s["strings"]
    nf = meta["node_fields"]
    ef = meta["edge_fields"]
    ns = len(nf)
    es = len(ef)
    n = len(nodes) // ns
    names = [strings[nodes[i * ns + nf.index("name")]] for i in range(n)]
    types = [meta["node_types"][0][nodes[i * ns + nf.index("type")]] for i in range(n)]
    sizes = [nodes[i * ns + nf.index("self_size")] for i in range(n)]
    g = nx.DiGraph()
    g.add_nodes_from(range(n))
    props = {}
    pos = 0
    for i in range(n):
        count = nodes[i * ns + nf.index("edge_count")]
        for j in range(pos, pos + count * es, es):
            etype = meta["edge_types"][0][edges[j + ef.index("type")]]
            target = edges[j + ef.index("to_node")] // ns
            if etype != "weak":
                g.add_edge(i, target)
            if etype == "property":
                props.setdefault(i, {})[
                    strings[edges[j + ef.index("name_or_index")]]
                ] = target
        pos += count * es
    dominators = nx.immediate_dominators(g, 0)
    retained = sizes.copy()
    depth = {0: 0}

    def level(i):
        chain = []
        while i not in depth:
            chain.append(i)
            i = dominators[i]
        d = depth[i]
        for j in reversed(chain):
            d += 1
            depth[j] = d
        return d

    for i in dominators:
        level(i)
    for i in sorted(dominators, key=lambda x: depth[x], reverse=True):
        if i:
            retained[dominators[i]] += retained[i]
    groups = collections.defaultdict(list)
    for i in range(n):
        if types[i] == "object" or (
            types[i] in ["synthetic", "native"] and names[i].startswith("workerd /")
        ):
            groups[names[i]].append(i)
        p = props.get(i, {})
        if "metrics" in p and "expiry" in p:
            groups["MeasuredRoomEngine"].append(i)
        if "metrics" in p and "repository" in p:
            groups["MeasuredLounge"].append(i)
        if names[i] == "RoomRepository":
            for key in ["data", "training", "savedLounge", "savedTraining"]:
                if key in p:
                    groups["repository." + key].append(p[key])
        if names[i] == "RoomRepository" and "data" in p:
            data = props.get(p["data"], {})
            if "activity" in data:
                groups["repository.activity"].append(data["activity"])
            for room in props.get(data.get("rooms"), {}).values():
                state = props.get(room, {}).get("state")
                for key in ["log", "trickHistory", "scoreHistory"]:
                    value = props.get(state, {}).get(key)
                    if value is not None:
                        groups["game." + key].append(value)
        if names[i] == "Snapshots" and "delivered" in p:
            groups["snapshotCache"].append(p["delivered"])
        if names[i] == "GameExecutor" and "decisions" in p:
            groups["botDecisionCache"].append(p["decisions"])
        if "metrics" in p and "last" in p and "expiry" in p:
            groups["engine.last"].append(p["last"])
        if "metrics" in p and "decision" in p:
            groups["engine.decision"].append(p["decision"])
    wanted = [
        "workerd / WebSocket",
        "workerd / TimersUtil",
        "MeasuredRoomEngine",
        "MeasuredLounge",
        "RoomRepository",
        "Snapshots",
        "GameExecutor",
        "WebSocket",
        "WebSocketPair",
        "Alarm",
        "Timeout",
        "Promise",
        "WeakMap",
        "Map",
        "ArrayBuffer",
        "repository.data",
        "repository.activity",
        "game.log",
        "game.trickHistory",
        "game.scoreHistory",
        "repository.training",
        "repository.savedLounge",
        "repository.savedTraining",
        "snapshotCache",
        "botDecisionCache",
        "engine.last",
        "engine.decision",
    ]
    summary = {
        k: {
            "count": len(groups[k]),
            "shallowBytes": sum(sizes[i] for i in groups[k]),
            "dominatedBytesSum": sum(retained[i] for i in groups[k]),
        }
        for k in wanted
    }
    return {
        "case": Path(file).parent.name,
        "file": Path(file).name,
        "nodeCount": n,
        "edgeCount": len(edges) // es,
        "reachableNodes": len(dominators),
        "shallowBytesTotal": sum(sizes),
        "groups": summary,
        "method": "NetworkX immediate dominators from synthetic root; weak edges excluded. Group sums may overlap; ephemeron/native reachability is not exact Chrome DevTools retained size. Raw strings and credentials are not exported.",
    }


if __name__ == "__main__":
    print(json.dumps([analyze(f) for f in sys.argv[1:]], indent=2))
