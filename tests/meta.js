var test = require('tap').test;
var jot = require("../jot");
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var objs = require("../jot/objects.js");
var meta = require("../jot/meta.js");

test('meta', function(t) {
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
