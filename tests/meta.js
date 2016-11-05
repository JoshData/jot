var test = require('tap').test;
var jot = require("../jot");
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var objs = require("../jot/objects.js");
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

    t.end();
});
