// Performs a merge, i.e. given a directed graph of operations with in-degree
// of 1 or 2, and two nodes 'source' and 'target' on the graph which have a
// common ancestor, compute the operation that applies the changes in source,
// relative to the common ancestor, to target.
//
// In the simplest case of a merge where the source and target share a common
// immediate parent, then the merge is simply the rebase of the source on the
// target. In more complex operation graphs, we find the least common ancestor
// (i.e. the nearest common ancestor) and then rebase around that.

const jot = require("./index.js");

function keys(obj) {
  // Get all of the own-keys of obj including string keys and symbols.
  return Object.keys(obj).concat(Object.getOwnPropertySymbols(obj));
}

function node_name_str(node) {
  if (typeof node === "Symbol" && node.description)
    return node.description;
  return node.toString();
}

exports.merge = function(branch1, branch2, graph) {
  // 'graph' is an object whose keys are identifiers of nodes
  // 'branch1' and 'branch2' are keys in 'graph'
  // The values of 'graph' are objects of the form:
  // {
  //   parents: an array of keys in graph
  //   op: an array of JOT operations, each giving the difference between
  //       the document at this node and the *corresponding* parent
  //   document: the document content at this node, required at least for
  //       root nodes, but can be set on any node
  // }
  // 
  // This method returns an array of two operations: The first merges
  // branch2 into branch1 and the second merges branch1 into branch2.

  // Find the lowest common ancestor(s) of branch1 and branch2.
  var lca = lowest_common_ancestors(branch1, branch2, graph);
  if (lca.length == 0)
    throw "NO_COMMON_ANCESTOR";

 function get_document_content_at(n) {
    // Node n may have a 'document' key set. If not, get the content at its first parent
    // and apply its operations.
    let path = [];
    while (typeof graph[n].document === "undefined") {
      if (!graph[n].parents)
        throw "ROOT_MISSING_DOCUMENT";
      path.unshift(graph[n].op[0]);
      n = graph[n].parents[0];
    }
    let document = graph[n].document;
    path.forEach(op => document = op.apply(document));
    return document;
  }

  /*
  console.log("Merging", branch1, "and", branch2);
  keys(graph).forEach(node =>
    console.log(" ", node, "=>", (graph[node].parents || []).map((p, i) =>
      (p.toString() + " + " + graph[node].op[i].inspect())).join(" X "))
  )
  */

  // If there is more than one common ancestor, then use the git merge
  // "recursive" strategy, which successively merges pairs of common
  // ancestors until there is just one left.
  while (lca.length > 1) {
    // Take the top two ancestors off the stack and compute the operations
    // to merge them.
    let lca1 = lca.pop();
    let lca2 = lca.pop();
    //console.log("Recursive merging...");
    let merge_ops = exports.merge(lca1.node, lca2.node, graph);

    // Form a new virtual node in the graph that represents this merge and put
    // this node back onto the stack. Along with the node, we also store the
    // path through nodes to branch1 and branch2. Of course there is no path
    // from this virtual node to anywhere, so we make one by rebasing the
    // path from one of the ancestor nodes (it doesn't matter which) to the
    // target onto the merge operation from that ancestor to the new node.
    // (Maybe choosing the shortest paths will produce better merges?)
    var node = Symbol(/*node_name_str(lca1.node) + "|" + node_name_str(lca2.node)*/);
    graph[node] = {
      parents: [lca1.node, lca2.node],
      op: merge_ops
    }
    
    let document1 = get_document_content_at(lca1.node);

    /*
    console.log("Rebasing")
    keys(lca1.paths).map(target => console.log(" ", target, lca1.paths[target].inspect()));
    console.log("against the merge commit's first operation");
    console.log("which is at", lca1.node, "document:", document1);
    */
  
    lca.push({
      node: node,
      paths: {
        [branch1]: lca1.paths[branch1].rebase(merge_ops[0], { document: document1 }),
        [branch2]: lca1.paths[branch2].rebase(merge_ops[0], { document: document1 })
      }
    });

    /*
    console.log("Making virtual node (", lca1.node, lca2.node, ") with paths to targets:");
    keys(lca[lca.length-1].paths).map(target => console.log(" ", target, lca[lca.length-1].paths[target].inspect()));
    */
  }

  // Take the one common ancestors.
  lca = lca.pop();

  /*
  console.log("Common ancestor:", lca.node, "Paths to targets:");
  keys(lca.paths).map(target => console.log(" ", target, lca.paths[target].inspect()));
  */

  // Get the JOT operations from the ancestor to branch1 and branch2.
  var branch1_op = lca.paths[branch1];
  var branch2_op = lca.paths[branch2];

  // Get the document content at the common ancestor.
  let document = get_document_content_at(lca.node);
  //console.log("document:", document);

  // Rebase and return the operations that would 1) merge branch2 into branch1
  // and 2) branch1 into branch2.
  let merge = [
    branch2_op.rebase(branch1_op, { document: document }),
    branch1_op.rebase(branch2_op, { document: document })
  ];
  //console.log("Merge:", merge[0].inspect(), merge[1].inspect());
  return merge;
}

function lowest_common_ancestors(a, b, graph) {
  // Find the lowest common ancestors of a and b (i.e. an
  // ancestor of both that is not the ancestor of another common
  // ancestor). There may be more than one equally-near ancestors.
  //
  // For each such ancestor, return the path(s) to a and b. There
  // may be multiple paths to each of a and b.
  //
  // We do this by traversing the graph starting first at a and then at b.
  let reach_paths = { };
  let descendants = { };
  let queue = [ // node  paths to a & b  descendant nodes
                 [ a,    { [a]: [[]] },  {} ],
                 [ b,    { [b]: [[]] },  {} ]];
  while (queue.length > 0) {
    // Pop an item from the queue.
    let [node, paths, descs] = queue.shift();
    if (!graph.hasOwnProperty(node)) throw "Invalid node: " + node;
    
    // Update its reach_paths flags.
    if (!reach_paths.hasOwnProperty(node)) reach_paths[node] = { };
    keys(paths).forEach(target => {
      if (!reach_paths[node].hasOwnProperty(target)) reach_paths[node][target] = [ ];
      paths[target].forEach(path =>
        reach_paths[node][target].push(path))
    });

    // Update its descendants.
    if (!descendants.hasOwnProperty(node)) descendants[node] = { };
    Object.assign(descendants[node], descs);

    // Queue its parents, passing the reachability paths and descendants.
    // Add this node to the descendants and path. To the path, add the
    // index too.
    let de = { [node]: true };
    Object.assign(de, descs);
    (graph[node].parents || []).forEach((p, i) => {
      let pa = { };
      keys(paths).forEach(pkey => {
        pa[pkey] = paths[pkey].map(path => [[node, i]].concat(path));
      })

      queue.push([p, pa, de])
    });
  }

  // Take the common ancetors.
  var common_ancestors = keys(reach_paths).filter(
    n => reach_paths[n].hasOwnProperty(a) && reach_paths[n].hasOwnProperty(b)
  );

  // Remove the common ancestors that have common ancestors as descendants.
  function object_contains_any(obj, elems) {
    for (let i = 0; i < elems.length; i++)
      if (obj.hasOwnProperty(elems[i]))
        return true;
    return false;
  }
  var lowest_common_ancestors = common_ancestors.filter(
    n => !object_contains_any(descendants[n], common_ancestors)
  );

  // Return the lowest common ancestors and, for each, return an
  // object that holds the node id plus the operations from the
  // ancestor to the target nodes a and b. Each item on the computed
  // path is a node ID and the index of the incoming edge to the node
  // on the path. For simple nodes, the edge index is always zero. For
  // merges, there are multiple parents, and we need to get the operation
  // that represents the change from the *corresponding* parent.
  function get_paths_op(n) {
    let paths = { };
    keys(reach_paths[n]).forEach(target => {
      // There may be multiple paths from the ancestor to the target, but
      // we only need one. Take the first one. Maybe taking the shortest
      // will make better diffs in very complex scenarios?
      let path = reach_paths[n][target][0];
      paths[target] = new jot.LIST(path.map(path_item => graph[path_item[0]].op[path_item[1]])).simplify();
    });
    return paths;
  }
  return lowest_common_ancestors.map(n => { return {
    'node': n,
    'paths': get_paths_op(n)
  }});
}

exports.Revision = class {
  constructor(ops, parents, document) {
    this.ops = ops;
    this.parents = parents || [];
    this.document = document;
    this.id = Symbol(/*Math.floor(Math.random() * 10000)*/);
  }

  add_to_graph(graph) {
    // Add the parents.
    this.parents.forEach(p => p.add_to_graph(graph));

    // Add this node.
    graph[this.id] = {
      parents: this.parents.map(p => p.id),
      op: this.ops,
      document: this.document
    };
  }
}

exports.Document = class {
  constructor(name) {
    this.name = name || "";
    this.history = [new exports.Revision(null, null, null, "singularity")];
    this.commit_count = 0;
    this.branch_count = 0;
  }

  commit(op) {
    if (!(op instanceof jot.Operation)) {
      // If 'op' is not an operation, it is document content. Do a diff
      // against the last content to make an operation.
      op = jot.diff(this.content(), op);
    }

    let rev = new exports.Revision(
      [op],
      [this.head()],
      op.apply(this.content()),
      (this.name||"") + "+" + (++this.commit_count)
    );
    this.history.push(rev);
    this.branch_count = 0;
    return rev;
  }
  
  branch(name) {
    let br = new exports.Document(
        (this.name ? (this.name + "_") : "")
      + (name || (++this.branch_count)));
    br.history = [].concat(this.history); // shallow clone
    return br;
  }

  head() {
    return this.history[this.history.length-1];
  }

  content() {
    return this.head().document;
  }

  merge(b) {
    // Form a graph of the complete known history of the two branches.
    let graph = { };
    this.head().add_to_graph(graph);
    b.head().add_to_graph(graph);

    // Perform the merge. Two operations are returned. The first merges
    // b into this, and the second merges this into b.
    let op = exports.merge(this.head().id, b.head().id, graph);

    // Make a commit on this branch that merges b into this.
    let rev = this.commit(op[0])

    // Add the second parent and the second merge operation.
    rev.parents.push(b.head());
    rev.ops.push(op[1]);
    return rev;
  }
};

