var test = require('tap').test;
var jot = require("../jot");
var lists = require("../jot/lists.js");

test('lists', function(t) {
    // inspect

    t.deepEqual(
        new lists.LIST([]).inspect(),
        "<lists.LIST []>");

    t.deepEqual(
        new lists.LIST([jot.SET("X")]).inspect(),
        "<lists.LIST [<values.SET \"X\">]>");

    t.deepEqual(
        new lists.LIST([jot.SET("X"), jot.SET("Y")]).inspect(),
        "<lists.LIST [<values.SET \"X\">, <values.SET \"Y\">]>");

	// simplify

	t.deepEqual(
		new lists.LIST([]).simplify(),
		jot.NO_OP());

	t.deepEqual(
		new lists.LIST([ jot.SET("X"), jot.SET("Y") ]).simplify(),
		jot.SET("Y") );

	t.deepEqual(
		new lists.LIST([ jot.MATH("add", 1), jot.MATH("add", 2) ]).simplify(),
		jot.MATH("add", 3) );

	t.deepEqual(
		new lists.LIST([ jot.MATH("add", 1), jot.MATH("mult", 2) ]).simplify(),
		new lists.LIST([ jot.MATH("add", 1), jot.MATH("mult", 2) ]));

	t.deepEqual(
		new lists.LIST([ jot.MATH("add", 1), jot.MATH("mult", 2), jot.MATH("xor", 1) ]).simplify(),
		new lists.LIST([ jot.MATH("add", 1), jot.MATH("mult", 2), jot.MATH("xor", 1) ]));

    // compose

    t.deepEqual(
        new lists.LIST([ ])
            .compose(
                jot.PUT('x', 'y')
            ),
        jot.PUT('x', 'y')
    )

    t.deepEqual(
        new lists.LIST([ jot.PUT('x', 'y') ])
            .compose(
                new lists.LIST([ ])
            ),
        new lists.LIST([ jot.PUT('x', 'y') ])
    )

    t.deepEqual(
        new lists.LIST([ jot.PUT('x', 'y') ])
            .compose(
                jot.PUT('x', 'z')
            ),
        new lists.LIST([ jot.PUT('x', 'y'), jot.PUT('x', 'z') ])
    )

    t.deepEqual(
        new lists.LIST([ jot.PUT('x', 'y') ])
            .compose(
                new lists.LIST([ jot.PUT('x', 'z') ])
            ),
        new lists.LIST([ jot.PUT('x', 'y'), jot.PUT('x', 'z') ])
    )

    // (de)serialization

    t.deepEqual(
        jot.deserialize(
            new lists.LIST([
                jot.APPLY(
                    'foo', jot.PUT(
                        'x', 'y'
                    )
                ),
                jot.APPLY(
                    'bar', jot.SPLICE(
                        0, 0, [{baz: 'quux'}]
                    )
                )
            ]).serialize()
        ),
        new lists.LIST([
            jot.APPLY(
                'foo', jot.PUT(
                    'x', 'y'
                )
            ),
            jot.APPLY(
                'bar', jot.SPLICE(
                    0, 0, [{baz: 'quux'}]
                )
            )
        ])
    );

    // rebase
    t.deepEqual( // empty list
        new lists.LIST([ ])
            .rebase(
                jot.PUT('x', 'y')
            ),
        jot.NO_OP()
    )

    t.deepEqual( // unrelated changes, unwrapping of the list
        new lists.LIST([ jot.PUT('x', 'y') ])
            .rebase(
                jot.PUT('a', 'b')
            ),
        jot.PUT('x', 'y')
    )

    t.deepEqual( // related changes, unwrapping of list
        new lists.LIST([ jot.APPLY('x', jot.SET('y2')) ])
            .rebase(
                jot.REN('x', 'a')
            ),
        jot.APPLY('a', jot.SET('y2'))
    )

    t.deepEqual( // two on one
        new lists.LIST([
            jot.APPLY('x', jot.SET('y2')),
            jot.APPLY('x', jot.SET('y3'))
        ])
            .rebase(
                jot.REN('x', 'a')
            ),
        jot.APPLY('a', jot.SET('y3'))
    )

    t.deepEqual( // two on two
        new lists.LIST([
            jot.APPLY('x', jot.SET('y2')),
            jot.APPLY('x', jot.SET('y3'))
        ])
            .rebase(
                new lists.LIST([
                    jot.REN('x', 'a'),
                    jot.REN('a', 'b')
                ])
            ),
        jot.APPLY('b', jot.SET('y3'))
    )

    t.deepEqual( // two on two - list is unchanged
        new lists.LIST([
            jot.REN('x', 'a'),
            jot.REN('a', 'b')
        ])
            .rebase(
                new lists.LIST([
                    jot.APPLY('x', jot.SET('y2')),
                    jot.APPLY('x', jot.SET('y3'))
                ])
            ),
        jot.REN('x', 'b')
    )

    t.deepEqual( // conflictless (A)
        new lists.LIST([
            jot.SET('a')
        ])
            .rebase(
                new lists.LIST([
                    jot.SET('b')
                ]),
                true
            ),
        jot.NO_OP()
    )

    t.deepEqual( // conflictless (B)
        new lists.LIST([
            jot.SET('b')
        ])
            .rebase(
                new lists.LIST([
                    jot.SET('a')
                ]),
                true
            ),
        jot.SET('b')
    )

    t.deepEqual( // two on two w/ conflictless (A)
        new lists.LIST([
            jot.REN('x', 'a'),
            jot.REN('y', 'b')
        ])
            .rebase(
                new lists.LIST([
                    jot.REN('x', 'A'),
                    jot.REN('y', 'B')
                ])
            ),
        null
    );

    t.deepEqual( // two on two w/ conflictless (B)
        new lists.LIST([
            jot.REN('x', 'A'),
            jot.REN('y', 'B')
        ])
            .rebase(
                new lists.LIST([
                    jot.REN('x', 'a'),
                    jot.REN('y', 'b')
                ])
            ),
        null
    );

    t.end();
});
