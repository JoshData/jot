var test = require('tap').test;
var jot = require("../jot");
var meta = require("../jot/meta.js");

test('meta', function(t) {
	// simplify

	t.deepEqual(
		new meta.LIST([]).simplify(),
		jot.NO_OP());

	t.deepEqual(
		new meta.LIST([ jot.SET("W", "X"), jot.SET("X", "Y") ]).simplify(),
		jot.SET("W", "Y") );

	t.deepEqual(
		new meta.LIST([ jot.MATH("add", 1), jot.MATH("add", 2) ]).simplify(),
		jot.MATH("add", 3) );

	t.deepEqual(
		new meta.LIST([ jot.MATH("add", 1), jot.MATH("mult", 2) ]).simplify(),
		new meta.LIST([ jot.MATH("add", 1), jot.MATH("mult", 2) ]));

	t.deepEqual(
		new meta.LIST([ jot.MATH("add", 1), jot.MATH("mult", 2), jot.MATH("xor", 1) ]).simplify(),
		new meta.LIST([ jot.MATH("add", 1), jot.MATH("mult", 2), jot.MATH("xor", 1) ]));

    // compose

    t.deepEqual(
        new meta.LIST([ ])
            .compose(
                jot.PUT('x', 'y')
            ),
        jot.PUT('x', 'y')
    )

    t.deepEqual(
        new meta.LIST([ jot.PUT('x', 'y') ])
            .compose(
                new meta.LIST([ ])
            ),
        new meta.LIST([ jot.PUT('x', 'y') ])
    )

    t.deepEqual(
        new meta.LIST([ jot.PUT('x', 'y') ])
            .compose(
                jot.PUT('x', 'z')
            ),
        new meta.LIST([ jot.PUT('x', 'y'), jot.PUT('x', 'z') ])
    )

    t.deepEqual(
        new meta.LIST([ jot.PUT('x', 'y') ])
            .compose(
                new meta.LIST([ jot.PUT('x', 'z') ])
            ),
        new meta.LIST([ jot.PUT('x', 'y'), jot.PUT('x', 'z') ])
    )

    // (de)serialization

    t.deepEqual(
        jot.deserialize(
            new meta.LIST([
                jot.APPLY(
                    'foo', jot.PUT(
                        'x', 'y'
                    )
                ),
                jot.APPLY(
                    'bar', jot.INS(
                        0, [{baz: 'quux'}]
                    )
                )
            ]).serialize()
        ),
        new meta.LIST([
            jot.APPLY(
                'foo', jot.PUT(
                    'x', 'y'
                )
            ),
            jot.APPLY(
                'bar', jot.INS(
                    0, [{baz: 'quux'}]
                )
            )
        ])
    );

    // rebase
    t.deepEqual( // empty list
        new meta.LIST([ ])
            .rebase(
                jot.PUT('x', 'y')
            ),
        jot.NO_OP()
    )

    t.deepEqual( // unrelated changes, unwrapping of the list
        new meta.LIST([ jot.PUT('x', 'y') ])
            .rebase(
                jot.PUT('a', 'b')
            ),
        jot.PUT('x', 'y')
    )

    t.deepEqual( // related changes, unwrapping of list
        new meta.LIST([ jot.APPLY('x', jot.SET('y1', 'y2')) ])
            .rebase(
                jot.REN('x', 'a')
            ),
        jot.APPLY('a', jot.SET('y1', 'y2'))
    )

    t.deepEqual( // two on one
        new meta.LIST([
            jot.APPLY('x', jot.SET('y1', 'y2')),
            jot.APPLY('x', jot.SET('y2', 'y3'))
        ])
            .rebase(
                jot.REN('x', 'a')
            ),
        jot.APPLY('a', jot.SET('y1', 'y3'))
    )

    t.deepEqual( // two on two
        new meta.LIST([
            jot.APPLY('x', jot.SET('y1', 'y2')),
            jot.APPLY('x', jot.SET('y2', 'y3'))
        ])
            .rebase(
                new meta.LIST([
                    jot.REN('x', 'a'),
                    jot.REN('a', 'b')
                ])
            ),
        jot.APPLY('b', jot.SET('y1', 'y3'))
    )

    t.deepEqual( // two on two - list is unchanged
        new meta.LIST([
            jot.REN('x', 'a'),
            jot.REN('a', 'b')
        ])
            .rebase(
                new meta.LIST([
                    jot.APPLY('x', jot.SET('y1', 'y2')),
                    jot.APPLY('x', jot.SET('y2', 'y3'))
                ])
            ),
        new meta.LIST([
            jot.REN('x', 'a'),
            jot.REN('a', 'b')
        ])
    )

    t.deepEqual( // conflictless (A)
        new meta.LIST([
            jot.SET('x', 'a')
        ])
            .rebase(
                new meta.LIST([
                    jot.SET('x', 'b')
                ]),
                true
            ),
        jot.NO_OP()
    )

    t.deepEqual( // conflictless (B)
        new meta.LIST([
            jot.SET('x', 'b')
        ])
            .rebase(
                new meta.LIST([
                    jot.SET('x', 'a')
                ]),
                true
            ),
        jot.SET('a', 'b')
    )

    t.deepEqual( // two on two w/ conflictless (A)
        new meta.LIST([
            jot.REN('x', 'a'),
            jot.REN('y', 'b')
        ])
            .rebase(
                new meta.LIST([
                    jot.REN('x', 'A'),
                    jot.REN('y', 'B')
                ]),
                true
            ),
        jot.NO_OP()
    );

    t.deepEqual( // two on two w/ conflictless (B)
        new meta.LIST([
            jot.REN('x', 'A'),
            jot.REN('y', 'B')
        ])
            .rebase(
                new meta.LIST([
                    jot.REN('x', 'a'),
                    jot.REN('y', 'b')
                ]),
                true
            ),
        new meta.LIST([
            jot.REN('a', 'A'),
            jot.REN('b', 'B')
        ])
    );

    t.end();
});
