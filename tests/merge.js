const test = require('tap').test;
const jot = require('../jot')
const merge = require("../jot/merge.js");

test('merge', function(t) {
  t.deepEqual(
    merge.merge(
      'source',
      'target',
      {
        source: { parents: ['root'], op: [new jot.SET('Hello')] },
        target: { parents: ['root'], op: [new jot.SET('World')] },
        root: { document: null },
      }
    )[1],
    new jot.NO_OP()
  );

  t.deepEqual(
    merge.merge(
      'source',
      'target',
      {
        source: { parents: ['root'], op: [new jot.SET('World')] },
        target: { parents: ['root'], op: [new jot.SET('Hello')] },
        root: { document: null },
      }
    )[1],
    new jot.SET("World")
  );

  t.deepEqual(
    merge.merge(
      'source',
      'target',
      {
        source: { parents: ['a'], op: [new jot.MATH('add', 1)] },
        target: { parents: ['a'], op: [new jot.MATH('add', 2)] },
        a: { parents: ['root'], op: [new jot.MATH('add', 3)] },
        root: { document: 0 },
      }
    )[1],
    new jot.MATH('add', 1)
  );

  t.deepEqual(
    merge.merge(
      'source',
      'target',
      {
        source: { parents: ['a'], op: [new jot.SPLICE(0, 5, "Goodbye")] },
        target: { parents: ['a'], op: [new jot.SPLICE(12, 5, "universe")] },
        a: { parents: ['root'], op: [new jot.SPLICE(6, 0, "cruel ")] },
        root: { document: "Hello world." },
      }
    )[1],
    new jot.SPLICE(0, 5, "Goodbye")
  );


  t.deepEqual(
    merge.merge(
      'source',
      'target',
      {
        source: { parents: ['a'], op: [new jot.SPLICE(12, 5, "universe")] },
        target: { parents: ['a'], op: [new jot.SPLICE(0, 5, "Goodbye")] },
        a: { parents: ['root'], op: [new jot.SPLICE(6, 0, "cruel ")] },
        root: { document: "Hello world." },
      }
    )[1],
    new jot.SPLICE(14, 5, "universe")
  );

  t.deepEqual(
    merge.merge(
      'source',
      'target',
      {
        target: { parents: ['a', 'source'], op: [new jot.SPLICE(8, 5, "universe"), new jot.SPLICE(0, 5, "Goodbye")] },
        source: { parents: ['root'], op: [new jot.SPLICE(6, 5, "universe")] },
        a: { parents: ['root'], op: [new jot.SPLICE(0, 5, "Goodbye")] },
        root: { document: "Hello world." },
      }
    )[1],
    new jot.NO_OP()
  );

  t.deepEqual(
    merge.merge(
      'source',
      'target',
      {
        target: { parents: ['a', 'b'], op: [new jot.SPLICE(8, 5, "universe"), new jot.SPLICE(0, 5, "Goodbye")] },
        source: { parents: ['b'], op: [new jot.SPLICE(14, 1, "!")] },
        b: { parents: ['root'], op: [new jot.SPLICE(6, 5, "universe")] },
        a: { parents: ['root'], op: [new jot.SPLICE(0, 5, "Goodbye")] },
        root: { document: "Hello world." },
      }
    )[1],
    new jot.SPLICE(16, 1, "!")
  );


  function test_merge(branch_a, branch_b, expected_content) {
    // Merge branch_b into branch_a. Merges aren't necessarily symmetric
    // in complex multi-common-ancestor scenarios, so we don't check
    // that merging bran_a into branch_b.
    branch_a.merge(branch_b);
    t.deepEqual(branch_a.content(), expected_content);
  }

  {
    let root = new merge.Document();

    let a = root.branch();
    a.commit("Hello world.");

    let b = root.branch();
    b.commit("Goodbye world.");
    
    test_merge(a, b, "Hello world.")
  }

  {
    let root = new merge.Document();
    root.commit("Hello world.");

    let a = root.branch();
    a.commit("Hello cruel world.");

    let b = root.branch();
    b.commit("Goodbye world.");
    b.commit("Goodbye world of mine.");
    
    test_merge(a, b, "Goodbye cruel world of mine.")
    test_merge(a, b, "Goodbye cruel world of mine.") // testing that repeat does nothing

    b.commit("Goodbye love of yesterday.");
    test_merge(a, b, "Goodbye cruel love of yesterday.")
    test_merge(b, a, "Goodbye cruel love of yesterday.")
    test_merge(a, b, "Goodbye cruel love of yesterday.")

    a.commit("Farewall, my love of chocolate.");
    b.commit("He said, 'Goodbye cruel love of yesterday,' before leaving.");
    test_merge(a, b, "He said, 'Farewall, my love of chocolate,' before leaving.")
  }


  {
    // This is the "When is merge recursive needed?" example
    // in http://blog.plasticscm.com/2011/09/merge-recursive-strategy.html.

    let a = new merge.Document();
    
    a.commit("10");

    let b = a.branch();

    a.commit("10 11")
    let a11 = a.branch();
    a.commit("10 11 13")
    b.commit("10 12")
    let b12 = b.branch();
    b.commit("10 12 14")

    test_merge(a, b12, "10 11 13 12");
    test_merge(b, a11, "10 11 12 14");

    //test_merge(a, b, "10 11 12 14 13");
  }

  {
    // This is the "Why merge recursive is better: a step by step example"
    // in http://blog.plasticscm.com/2011/09/merge-recursive-strategy.html.

    let a = new merge.Document();
    
    a.commit("bcd");

    let b = a.branch();
    b.commit("bcde");
    b.commit("bcdE");

    a.commit("bCd");

    let c = a.branch();
    c.commit("abCd");

    a.commit("bcd");

    test_merge(c, b, "abCdE");
    test_merge(a, b, "bcdE");
    test_merge(c, a, "abcdE");
  }

  t.end();
});
