var test = require('tap').test;
var jot = require("../jot");
var meta = require("../jot/meta.js");

test('meta', function(t) {
    // compose
    t.deepEqual(
        new meta.LIST([ ])
            .compose(
                new jot.PUT('x', 'y')
            ),
        new jot.PUT('x', 'y')
    )
    t.deepEqual(
        new meta.LIST([ new jot.PUT('x', 'y') ])
            .compose(
                new meta.LIST([ ])
            ),
        new meta.LIST([ new jot.PUT('x', 'y') ])
    )
    t.deepEqual(
        new meta.LIST([ new jot.PUT('x', 'y') ])
            .compose(
                new jot.PUT('x', 'z')
            ),
        new meta.LIST([ new jot.PUT('x', 'y'), new jot.PUT('x', 'z') ])
    )
    t.deepEqual(
        new meta.LIST([ new jot.PUT('x', 'y') ])
            .compose(
                new meta.LIST([ new jot.PUT('x', 'z') ])
            ),
        new meta.LIST([ new jot.PUT('x', 'y'), new jot.PUT('x', 'z') ])
    )


    // (de)serialization
    t.deepEqual(
        jot.deserialize(
            new meta.LIST([
                new jot.OBJECT_APPLY(
                    'foo', new jot.PUT(
                        'x', 'y'
                    )
                ),
                new jot.ARRAY_APPLY(
                    'bar', new jot.INS(
                        0, [{baz: 'quux'}]
                    )
                )
            ]).serialize()
        ),
        new meta.LIST([
            new jot.OBJECT_APPLY(
                'foo', new jot.PUT(
                    'x', 'y'
                )
            ),
            new jot.ARRAY_APPLY(
                'bar', new jot.INS(
                    0, [{baz: 'quux'}]
                )
            )
        ])
    );

    // rebase
    t.deepEqual( // empty list
        new meta.LIST([ ])
            .rebase(
                new jot.PUT('x', 'y')
            ),
        new jot.NO_OP()
    )
    t.deepEqual( // unrelated changes, unwrapping of the list
        new meta.LIST([ new jot.PUT('x', 'y') ])
            .rebase(
                new jot.PUT('a', 'b')
            ),
        new jot.PUT('x', 'y')
    )
    t.deepEqual( // related changes, unwrapping of list
        new meta.LIST([ new jot.OBJECT_APPLY('x', new jot.SET('y1', 'y2')) ])
            .rebase(
                new jot.REN('x', 'a')
            ),
        new jot.OBJECT_APPLY('a', new jot.SET('y1', 'y2'))
    )
    t.deepEqual( // two on one
        new meta.LIST([
            new jot.OBJECT_APPLY('x', new jot.SET('y1', 'y2')),
            new jot.OBJECT_APPLY('x', new jot.SET('y2', 'y3'))
        ])
            .rebase(
                new jot.REN('x', 'a')
            ),
        new meta.LIST([
            new jot.OBJECT_APPLY('a', new jot.SET('y1', 'y2')),
            new jot.OBJECT_APPLY('a', new jot.SET('y2', 'y3'))
        ])
    )
    t.deepEqual( // two on two
        new meta.LIST([
            new jot.OBJECT_APPLY('x', new jot.SET('y1', 'y2')),
            new jot.OBJECT_APPLY('x', new jot.SET('y2', 'y3'))
        ])
            .rebase(
                new meta.LIST([
                    new jot.REN('x', 'a'),
                    new jot.REN('a', 'b')
                ])
            ),
        new meta.LIST([
            new jot.OBJECT_APPLY('b', new jot.SET('y1', 'y2')),
            new jot.OBJECT_APPLY('b', new jot.SET('y2', 'y3'))
        ])
    )
    t.deepEqual( // two on two - list is unchanged
        new meta.LIST([
            new jot.REN('x', 'a'),
            new jot.REN('a', 'b')
        ])
            .rebase(
                new meta.LIST([
                    new jot.OBJECT_APPLY('x', new jot.SET('y1', 'y2')),
                    new jot.OBJECT_APPLY('x', new jot.SET('y2', 'y3'))
                ])
            ),
        new meta.LIST([
            new jot.REN('x', 'a'),
            new jot.REN('a', 'b')
        ])
    )
    t.deepEqual( // conflictless (A)
        new meta.LIST([
            new jot.SET('x', 'a')
        ])
            .rebase(
                new meta.LIST([
                    new jot.SET('x', 'b')
                ]),
                true
            ),
        new jot.NO_OP()
    )
    t.deepEqual( // conflictless (B)
        new meta.LIST([
            new jot.SET('x', 'b')
        ])
            .rebase(
                new meta.LIST([
                    new jot.SET('x', 'a')
                ]),
                true
            ),
        new jot.SET('a', 'b')
    )
    t.deepEqual( // two on two w/ conflictless (A)
        new meta.LIST([
            new jot.REN('x', 'a'),
            new jot.REN('y', 'b')
        ])
            .rebase(
                new meta.LIST([
                    new jot.REN('x', 'A'),
                    new jot.REN('y', 'B')
                ]),
                true
            ),
        new jot.NO_OP()
    );
    t.deepEqual( // two on two w/ conflictless (B)
        new meta.LIST([
            new jot.REN('x', 'A'),
            new jot.REN('y', 'B')
        ])
            .rebase(
                new meta.LIST([
                    new jot.REN('x', 'a'),
                    new jot.REN('y', 'b')
                ]),
                true
            ),
        new meta.LIST([
            new jot.REN('a', 'A'),
            new jot.REN('b', 'B')
        ])
    );

    t.end();
});
