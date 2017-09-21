var test = require('tap').test;
var jot = require("../jot");
var lists = require("../jot/lists.js");

test('lists', function(t) {
    // inspect

    t.deepEqual(
        new lists.LIST([]).inspect(),
        "<lists.LIST []>");

    t.deepEqual(
        new lists.LIST([new jot.SET("X")]).inspect(),
        "<lists.LIST [<values.SET \"X\">]>");

    t.deepEqual(
        new lists.LIST([new jot.SET("X"), new jot.SET("Y")]).inspect(),
        "<lists.LIST [<values.SET \"X\">, <values.SET \"Y\">]>");

	// simplify

	t.deepEqual(
		new lists.LIST([]).simplify(),
		new jot.NO_OP());

	t.deepEqual(
		new lists.LIST([ new jot.SET("X"), new jot.SET("Y") ]).simplify(),
		new jot.SET("Y") );

	t.deepEqual(
		new lists.LIST([ new jot.MATH("add", 1), new jot.MATH("add", 2) ]).simplify(),
		new jot.MATH("add", 3) );

	t.deepEqual(
		new lists.LIST([ new jot.MATH("add", 1), new jot.MATH("mult", 2) ]).simplify(),
		new lists.LIST([ new jot.MATH("add", 1), new jot.MATH("mult", 2) ]));

	t.deepEqual(
		new lists.LIST([ new jot.MATH("add", 1), new jot.MATH("mult", 2), new jot.MATH("xor", 1) ]).simplify(),
		new lists.LIST([ new jot.MATH("add", 1), new jot.MATH("mult", 2), new jot.MATH("xor", 1) ]));

    // drilldown

    t.deepEqual(
        new lists.LIST([ new jot.PUT("key1", "value1"), new jot.PUT("key2", "value2") ]).drilldown("key"),
        new jot.NO_OP());
    t.deepEqual(
        new lists.LIST([ new jot.PUT("key1", "value1"), new jot.PUT("key2", "value2") ]).drilldown("key1"),
        new jot.SET("value1"));
    t.deepEqual(
        new lists.LIST([ new jot.APPLY("key1", new jot.MATH("add", 1)), new jot.APPLY("key1", new jot.MATH("mult", 2)) ]).drilldown("key1"),
        new lists.LIST([ new jot.MATH("add", 1), new jot.MATH("mult", 2) ]));

    // compose

    t.deepEqual(
        new lists.LIST([ ])
            .compose(
                new jot.PUT('x', 'y')
            ),
        new jot.PUT('x', 'y')
    )

    t.deepEqual(
        new lists.LIST([ new jot.PUT('x', 'y') ])
            .compose(
                new lists.LIST([ ])
            ),
        new lists.LIST([ new jot.PUT('x', 'y') ])
    )

    t.deepEqual(
        new lists.LIST([ new jot.PUT('x', 'y') ])
            .compose(
                new jot.PUT('x', 'z')
            ),
        new lists.LIST([ new jot.PUT('x', 'y'), new jot.PUT('x', 'z') ])
    )

    t.deepEqual(
        new lists.LIST([ new jot.PUT('x', 'y') ])
            .compose(
                new lists.LIST([ new jot.PUT('x', 'z') ])
            ),
        new lists.LIST([ new jot.PUT('x', 'y'), new jot.PUT('x', 'z') ])
    )

    // (de)serialization

    t.deepEqual(
        new jot.deserialize(
            new lists.LIST([
                new jot.APPLY(
                    'foo', new jot.PUT(
                        'x', 'y'
                    )
                ),
                new jot.APPLY(
                    'bar', new jot.SPLICE(
                        0, 0, [{baz: 'quux'}]
                    )
                )
            ]).serialize()
        ),
        new lists.LIST([
            new jot.APPLY(
                'foo', new jot.PUT(
                    'x', 'y'
                )
            ),
            new jot.APPLY(
                'bar', new jot.SPLICE(
                    0, 0, [{baz: 'quux'}]
                )
            )
        ])
    );

    // rebase
    t.deepEqual( // empty list
        new lists.LIST([ ])
            .rebase(
                new jot.PUT('x', 'y')
            ),
        new jot.NO_OP()
    )

    t.deepEqual( // unrelated changes, unwrapping of the list
        new lists.LIST([ new jot.PUT('x', 'y') ])
            .rebase(
                new jot.PUT('a', 'b')
            ),
        new jot.PUT('x', 'y')
    )

    t.deepEqual( // related changes, unwrapping of list
        new lists.LIST([ new jot.APPLY('x', new jot.SET('y2')) ])
            .rebase(
                new jot.REN('x', 'a')
            ),
        new jot.APPLY('a', new jot.SET('y2'))
    )

    t.deepEqual( // two on one
        new lists.LIST([
            new jot.APPLY('x', new jot.SET('y2')),
            new jot.APPLY('x', new jot.SET('y3'))
        ])
            .rebase(
                new jot.REN('x', 'a')
            ),
        new jot.APPLY('a', new jot.SET('y3'))
    )

    t.deepEqual( // two on two
        new lists.LIST([
            new jot.APPLY('x', new jot.SET('y2')),
            new jot.APPLY('x', new jot.SET('y3'))
        ])
            .rebase(
                new lists.LIST([
                    new jot.REN('x', 'a'),
                    new jot.REN('a', 'b')
                ])
            ),
        new jot.APPLY('b', new jot.SET('y3'))
    )

    t.deepEqual( // two on two - list is unchanged
        new lists.LIST([
            new jot.REN('x', 'a'),
            new jot.REN('a', 'b')
        ])
            .rebase(
                new lists.LIST([
                    new jot.APPLY('x', new jot.SET('y2')),
                    new jot.APPLY('x', new jot.SET('y3'))
                ])
            ),
        new jot.REN('x', 'b')
    )

    t.deepEqual( // conflictless (A)
        new lists.LIST([
            new jot.SET('a')
        ])
            .rebase(
                new lists.LIST([
                    new jot.SET('b')
                ]),
                true
            ),
        new jot.NO_OP()
    )

    t.deepEqual( // conflictless (B)
        new lists.LIST([
            new jot.SET('b')
        ])
            .rebase(
                new lists.LIST([
                    new jot.SET('a')
                ]),
                true
            ),
        new jot.SET('b')
    )

    t.deepEqual( // two on two w/ conflictless (A)
        new lists.LIST([
            new jot.REN('x', 'a'),
            new jot.REN('y', 'b')
        ])
            .rebase(
                new lists.LIST([
                    new jot.REN('x', 'A'),
                    new jot.REN('y', 'B')
                ])
            ),
        null
    );

    t.deepEqual( // two on two w/ conflictless (B)
        new lists.LIST([
            new jot.REN('x', 'A'),
            new jot.REN('y', 'B')
        ])
            .rebase(
                new lists.LIST([
                    new jot.REN('x', 'a'),
                    new jot.REN('y', 'b')
                ])
            ),
        null
    );

    t.end();
});
