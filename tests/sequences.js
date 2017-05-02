var test = require('tap').test;
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var jot = require("../jot");

test('sequences', function(t) {

// inspect
t.equal(
	new seqs.SPLICE(0, 1, "4").inspect(),
	'<sequences.PATCH +0x1 "4">');
t.equal(
	new seqs.MOVE(0, 2, 5).inspect(),
	'<sequences.MOVE @0x2 => @5>');
t.equal(
	new seqs.APPLY(0, new values.SET(2)).inspect(),
	'<sequences.PATCH +0 <values.SET 2>>');
t.equal(
	new seqs.APPLY({ 0: new values.SET(2), 4: new values.SET(10) }).inspect(),
	'<sequences.PATCH +0 <values.SET 2>, +3 <values.SET 10>>');
t.equal(
	new seqs.MAP(new values.MATH('add', 1)).inspect(),
	'<sequences.MAP <values.MATH add:1>>');

// serialization

t.deepEqual(
	jot.opFromJSON(new seqs.SPLICE(0, 1, "4").toJSON()),
	new seqs.SPLICE(0, 1, "4"));
t.deepEqual(
	jot.opFromJSON(new seqs.MOVE(0, 2, 5).toJSON()),
	new seqs.MOVE(0, 2, 5));
t.deepEqual(
	jot.opFromJSON(new seqs.APPLY(0, new values.SET(2)).toJSON()),
	new seqs.APPLY(0, new values.SET(2)));
t.deepEqual(
	jot.opFromJSON(new seqs.APPLY({ 0: new values.SET(2), 4: new values.SET(10) }).toJSON()),
	new seqs.APPLY({ 0: new values.SET(2), 4: new values.SET(10) }));
t.deepEqual(
	jot.opFromJSON(new seqs.MAP(new values.MATH('add', 1)).toJSON()),
	new seqs.MAP(new values.MATH('add', 1)));

// apply

t.equal(
	new seqs.SPLICE(0, 1, "4").apply("123"),
	"423");
t.equal(
	new seqs.SPLICE(0, 1, "").apply("123"),
	"23");
t.equal(
	new seqs.SPLICE(0, 1, "44").apply("123"),
	"4423");
t.equal(
	new seqs.SPLICE(3, 0, "44").apply("123"),
	"12344");

t.equal(
	new seqs.MOVE(0, 1, 3).apply("123"),
	"231");
t.equal(
	new seqs.MOVE(2, 1, 0).apply("123"),
	"312");

t.deepEqual(
	new seqs.APPLY(0, new values.SET(4)).apply([1, 2, 3]),
	[4, 2, 3]);
t.deepEqual(
	new seqs.APPLY(1, new values.SET(4)).apply([1, 2, 3]),
	[1, 4, 3]);
t.deepEqual(
	new seqs.APPLY(2, new values.SET(4)).apply([1, 2, 3]),
	[1, 2, 4]);
t.deepEqual(
	new seqs.APPLY({ 0: new values.SET(4), 1: new values.SET(5) })
	.apply([1, 2, 3]),
	[4, 5, 3]);

t.deepEqual(
	new seqs.APPLY(0, new values.SET("d")).apply("abc"),
	"dbc");
t.deepEqual(
	new seqs.APPLY(1, new values.SET("d")).apply("abc"),
	"adc");
t.deepEqual(
	new seqs.APPLY(2, new values.SET("d")).apply("abc"),
	"abd");
t.deepEqual(
	new seqs.APPLY({ 0: new values.SET("d"), 1: new values.SET("e") })
	.apply("abc"),
	"dec");

// simplify

t.deepEqual(
	new seqs.SPLICE(3, 0, "").simplify(),
	new values.NO_OP());
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").simplify(),
	new seqs.SPLICE(3, 3, "456"));
t.deepEqual(
	new seqs.MOVE(3, 5, 3).simplify(),
	new values.NO_OP());
t.deepEqual(
	new seqs.MOVE(3, 5, 4).simplify(),
	new seqs.MOVE(3, 5, 4));
t.deepEqual(
	new seqs.APPLY(0, new values.SET(2)).simplify(),
	new seqs.APPLY(0, new values.SET(2)));
t.deepEqual(
	new seqs.APPLY({
		0: new values.SET(1),
		1: new jot.LIST([]) }).simplify(),
	new seqs.APPLY(0, new values.SET(1)));

// invert

t.deepEqual(
	new seqs.SPLICE(3, 3, "456").inverse("xxx123"),
	new seqs.SPLICE(3, 3, "123"));
t.deepEqual(
	new seqs.MOVE(3, 3, 10).inverse("anything here"),
	new seqs.MOVE(7, 3, 3));
t.deepEqual(
	new seqs.MOVE(10, 3, 3).inverse("anything here"),
	new seqs.MOVE(3, 3, 13));
t.deepEqual(
	new seqs.APPLY(0, new values.SET(2)).inverse([1]),
	new seqs.APPLY(0, new values.SET(1)));
t.deepEqual(
	new seqs.APPLY({ 0: new values.SET("d"), 1: new values.SET("e") }).inverse(['a', 'b']),
	new seqs.APPLY({ 0: new values.SET("a"), 1: new values.SET("b") }));


// atomic_compose

t.deepEqual(
	new seqs.SPLICE(0, 4, "1234").atomic_compose(new seqs.SPLICE(5, 4, "FGHI")),
	new seqs.PATCH([{offset: 0, length: 4, op: new values.SET("1234")}, {offset: 1, length: 4, op: new values.SET("FGHI")}]));
t.deepEqual(
	new seqs.SPLICE(0, 4, "1234").atomic_compose(new seqs.SPLICE(4, 4, "EFGH")),
	new seqs.SPLICE(0, 8, "1234EFGH"));
t.deepEqual(
	new seqs.SPLICE(0, 4, "1234").atomic_compose(new seqs.SPLICE(2, 4, "CDEF")),
	new seqs.SPLICE(0, 6, "12CDEF"));
t.deepEqual(
	new seqs.SPLICE(0, 4, "1234").atomic_compose(new seqs.SPLICE(2, 2, "CD")),
	new seqs.SPLICE(0, 4, "12CD"));
t.deepEqual(
	new seqs.SPLICE(0, 4, "1234").atomic_compose(new seqs.SPLICE(0, 4, "ABCD")),
	new seqs.SPLICE(0, 4, "ABCD"));
t.deepEqual(
	new seqs.SPLICE(0, 4, "1234").atomic_compose(new seqs.SPLICE(1, 2, "BC")),
	new seqs.SPLICE(0, 4, "1BC4"));
t.deepEqual(
	new seqs.SPLICE(0, 4, "1234").atomic_compose(new seqs.SPLICE(0, 2, "AB")),
	new seqs.SPLICE(0, 4, "AB34"));
t.deepEqual(
	new seqs.SPLICE(0, 4, "1234").atomic_compose(new seqs.SPLICE(0, 6, "ABCDEF")),
	new seqs.SPLICE(0, 6, "ABCDEF"));
t.deepEqual(
	new seqs.SPLICE(2, 4, "1234").atomic_compose(new seqs.SPLICE(0, 8, "YZABCDEF")),
	new seqs.SPLICE(0, 8, "YZABCDEF"));
t.deepEqual(
	new seqs.SPLICE(2, 4, "1234").atomic_compose(new seqs.SPLICE(0, 6, "YZABCD")),
	new seqs.SPLICE(0, 6, "YZABCD"));
t.deepEqual(
	new seqs.SPLICE(2, 4, "1234").atomic_compose(new seqs.SPLICE(0, 4, "YZAB")),
	new seqs.SPLICE(0, 6, "YZAB34"));
t.deepEqual(
	new seqs.SPLICE(2, 4, "1234").atomic_compose(new seqs.SPLICE(0, 2, "YZ")),
	new seqs.SPLICE(0, 6, "YZ1234"));
t.deepEqual(
	new seqs.SPLICE(2, 4, "1234").atomic_compose(new seqs.SPLICE(0, 1, "Y")),
	new seqs.PATCH([{offset: 0, length: 1, op: new values.SET("Y")}, {offset: 1, length: 4, op: new values.SET("1234")}]));
t.deepEqual(
	new seqs.SPLICE(0, 4, "1234").atomic_compose(new seqs.PATCH([{offset: 0, length: 1, op: new values.SET("A")}, {offset: 2, length: 1, op: new values.SET("D")}])),
	new seqs.SPLICE(0, 4, "A23D"));

t.deepEqual(
	new seqs.PATCH([{offset: 0, length: 4, op: new values.SET("ab")}, {offset: 1, length: 4, op: new values.SET("defg")}])
		.atomic_compose(new seqs.APPLY(4, new values.SET("E"))),
	new seqs.PATCH([{offset: 0, length: 4, op: new values.SET("ab")}, {offset: 1, length: 4, op: new values.SET("dEfg")}]));
t.deepEqual(
	new seqs.SPLICE(0, 4, "5678").atomic_compose(new seqs.APPLY(1, new values.SET("0"))),
	new seqs.SPLICE(0, 4, "5078"));
t.deepEqual(
	new seqs.SPLICE(0, 4, "5678").atomic_compose(new seqs.APPLY(4, new values.SET("0"))),
	new seqs.SPLICE(0, 5, "56780"));

t.deepEqual(
	new seqs.MOVE(0, 2, 4).atomic_compose(new values.SET("5678")),
	null);

t.deepEqual(
	new seqs.APPLY(0, new values.SET("0", "1")).atomic_compose(new seqs.SPLICE(0, 4, "5678")),
	new seqs.SPLICE(0, 4, "5678"));
t.deepEqual(
	new seqs.APPLY(555, new values.SET("B"))
		.atomic_compose(new seqs.APPLY(555, new values.SET("C"))),
	new seqs.APPLY(555, new values.SET("C")));
t.deepEqual(
	new seqs.APPLY(555, new values.MATH("add", 1))
		.atomic_compose(new seqs.APPLY(555, new values.MATH("mult", 1))),
	null);
t.deepEqual(
	new seqs.APPLY(0, new values.SET("d")).atomic_compose(new seqs.APPLY(1, new values.SET("e"))),
	new seqs.APPLY({ 0: new values.SET("d"), 1: new values.SET("e") }));
t.deepEqual(
	new seqs.APPLY({ 0: new values.SET("d"), 1: new values.SET("e") }).atomic_compose(new seqs.APPLY(0, new values.SET("f"))),
	new seqs.APPLY({ 0: new values.SET("f"), 1: new values.SET("e") }));

// rebase

t.deepEqual(
	new seqs.SPLICE(0, 3, "456").rebase(
		new seqs.SPLICE(0, 3, "456")),
	new values.NO_OP());
t.notOk(
	new seqs.SPLICE(0, 0, "123").rebase(
		new seqs.SPLICE(0, 0, "456")));
t.deepEqual(
	new seqs.SPLICE(0, 0, "123").rebase(
		new seqs.SPLICE(0, 0, "456"), true),
	new seqs.SPLICE(0, 0, "123"));
t.deepEqual(
	new seqs.SPLICE(0, 0, "456").rebase(
		new seqs.SPLICE(0, 0, "123"), true),
	new seqs.SPLICE(3, 0, "456"));
t.notOk(
	new seqs.SPLICE(0, 3, "456").rebase(
		new seqs.SPLICE(0, 3, "789")));
t.deepEqual(
	new seqs.SPLICE(0, 3, "456").rebase(
		new seqs.SPLICE(0, 3, "789"), true),
	new values.NO_OP());
t.deepEqual(
	new seqs.SPLICE(0, 3, "789").rebase(
		new seqs.SPLICE(0, 3, "456"), true),
	new seqs.SPLICE(0, 3, "789"));
t.deepEqual(
	new seqs.SPLICE(0, 3, "456").rebase(
		new seqs.SPLICE(3, 3, "")),
	new seqs.SPLICE(0, 3, "456"));
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").rebase(
		new seqs.SPLICE(0, 3, "AC")),
	new seqs.SPLICE(2, 3, "456"));

// one encompasses the other
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").rebase(
		new seqs.SPLICE(3, 1, "ABC"), true),
	new seqs.SPLICE(3, 5, "456"));
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").rebase(
		new seqs.SPLICE(4, 1, "ABC"), true),
	new seqs.SPLICE(3, 5, "456"));
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").rebase(
		new seqs.SPLICE(5, 1, "ABC"), true),
	new seqs.SPLICE(3, 5, "456"));
console.log("X")
t.deepEqual(
	new seqs.SPLICE(3, 1, "ABC").rebase(
		new seqs.SPLICE(3, 3, "456"), true),
	new seqs.SPLICE(3, 0, "ABC"));
console.log("X")
t.deepEqual(
	new seqs.SPLICE(4, 1, "ABC").rebase(
		new seqs.SPLICE(3, 3, "456"), true),
	new values.NO_OP());
t.deepEqual(
	new seqs.SPLICE(5, 1, "ABC").rebase(
		new seqs.SPLICE(3, 3, "456"), true),
	new seqs.SPLICE(6, 0, "ABC"));
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").rebase(
		new seqs.SPLICE(2, 4, "ABC"), true),
	new seqs.SPLICE(5, 0, "456"));
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").rebase(
		new seqs.SPLICE(2, 5, "ABC"), true),
	new values.NO_OP());

// partial overlap
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").rebase(
		new seqs.SPLICE(2, 2, "ABC"), true),
	new seqs.SPLICE(6, 2, "456"));
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").rebase(
		new seqs.SPLICE(5, 2, "ABC"), true),
	new seqs.SPLICE(3, 2, "456"));
t.deepEqual(
	new seqs.SPLICE(3, 3, "456").rebase(
		new seqs.SPLICE(4, 3, "AB"), true),
	new seqs.SPLICE(3, 1, "456"));
t.deepEqual(
	new seqs.SPLICE(2, 2, "ABC").rebase(
		new seqs.SPLICE(3, 3, "46"), true),
	new seqs.SPLICE(2, 1, "ABC"));
t.deepEqual(
	new seqs.SPLICE(5, 2, "ABC").rebase(
		new seqs.SPLICE(3, 3, "46"), true),
	new seqs.SPLICE(6, 1, "ABC"));
t.deepEqual(
	new seqs.SPLICE(4, 3, "ABC").rebase(
		new seqs.SPLICE(3, 3, "46"), true),
	new seqs.SPLICE(7, 1, "ABC"));

// splice vs apply

t.deepEqual(
	new seqs.SPLICE(0, [1,2,3], [4,5,6]).rebase(
		new seqs.APPLY(0, new values.MATH("add", 1))),
	new seqs.SPLICE(0, [2,2,3], [4,5,6]));

// splice vs map

t.notOk(
	new seqs.SPLICE(1, [1,2,3], [4,5]).rebase(
		new seqs.MAP(new values.MATH("add", 1))));
t.notOk(
	new seqs.MAP(new values.MATH("add", 1)).rebase(
		new seqs.SPLICE(1, [1,2,3], [4,5])));

t.deepEqual(
	new seqs.MOVE(1, 1, 2).rebase(
		new seqs.MAP(new values.MATH("add", 1))),
	new seqs.MOVE(1, 1, 2));
t.deepEqual(
	new seqs.MAP(new values.MATH("add", 1)).rebase(
		new seqs.MOVE(1, 1, 2)),
	new seqs.MAP(new values.MATH("add", 1)));

// apply vs splice

t.deepEqual(
	new seqs.APPLY(555, new values.MATH("add", 3)).rebase(
		new seqs.SPLICE(555, 0, [5])),
	new seqs.APPLY(556, new values.MATH("add", 3)));

// apply vs apply

t.deepEqual(
	new seqs.APPLY(555, new values.MATH("add", 3)).rebase(
		new seqs.APPLY(555, new values.MATH("add", 1))),
	new seqs.APPLY(555, new values.MATH("add", 3)));
t.notOk(
	new seqs.APPLY(555, new values.SET("y")).rebase(
		new seqs.APPLY(555, new values.SET("z"))))
t.deepEqual(
	new seqs.APPLY(555, new values.SET("y")).rebase(
		new seqs.APPLY(555, new values.SET("z")), true),
	new values.NO_OP())
t.deepEqual(
	new seqs.APPLY(555, new values.SET("z")).rebase(
		new seqs.APPLY(555, new values.SET("y")), true),
	new seqs.APPLY(555, new values.SET("z")))
t.deepEqual(
	new seqs.APPLY({0: new values.SET("z"), 1: new values.SET("b"), 2: new values.SET("N")}).rebase(
		new seqs.APPLY({0: new values.SET("y"), 1: new values.SET(" ")}), true),
	new seqs.APPLY({0: new values.SET("z"), 1: new values.SET("b"), 2: new values.SET("N")}))

// apply vs move

t.deepEqual(
	new seqs.APPLY(555, new values.MATH("add", 3)).rebase(
		new seqs.MOVE(555, 3, 0)),
	new seqs.APPLY(0, new values.MATH("add", 3)));

// apply vs map

t.deepEqual(
	new seqs.APPLY(555, new values.MATH("add", 3)).rebase(
		new seqs.MAP(new values.MATH("add", 1))),
	new seqs.APPLY(555, new values.MATH("add", 3)));

// map vs apply

t.deepEqual(
	new seqs.MAP(new values.MATH("add", 1)).rebase(
		new seqs.APPLY(555, new values.MATH("add", 3))),
	new seqs.MAP(new values.MATH("add", 1)));
t.notOk(
	new seqs.MAP(new values.MATH("add", 1)).rebase(
		new seqs.APPLY(555, new values.MATH("mult", 2))));

// map vs map

t.deepEqual(
	new seqs.MAP(new values.MATH("add", 1)).rebase(
		new seqs.MAP(new values.MATH("add", 3))),
	new seqs.MAP(new values.MATH("add", 1)));
t.notOk(
	new seqs.MAP(new values.MATH("add", 1)).rebase(
		new seqs.MAP(new values.MATH("mult", 3))));


// splice vs move

// splice partially remove beginning of LTR MOVE range
t.deepEqual(
  new jot.SPLICE(0, 2, "").rebase(
    new jot.MOVE(1, 2, 4), true),
  new jot.SPLICE(0, 1, "").compose(
  new jot.SPLICE(1, 1, "")))
t.deepEqual(
  new jot.MOVE(1, 2, 4).rebase(
    new jot.SPLICE(0, 2, ""), true),
  new jot.MOVE(0, 1, 2))

t.deepEqual(new jot.SPLICE(2, 6, "").rebase(
    new jot.MOVE(5, 5, 13), true),
  new jot.SPLICE(2, 3, "").compose(
  	new jot.SPLICE(5, 3, "")))

t.deepEqual(new jot.MOVE(5, 5, 13).rebase(
    new jot.SPLICE(2, 6, ""), true),
  new jot.MOVE(2, 2, 7))

// splice partially remove beginning of RTL MOVE range
t.deepEqual(
  new jot.SPLICE(4, 2, "").rebase(
   new jot.MOVE(5, 2, 1), true),
  new jot.SPLICE(1, 1, "").compose(
    new jot.SPLICE(5, 1, "")))

t.deepEqual(
  new jot.MOVE(5, 2, 1).rebase(
    new jot.SPLICE(4, 2, ""), true),
  new jot.MOVE(4, 1, 1))

t.deepEqual(new jot.MOVE(6, 5, 2).rebase(
    new jot.SPLICE(3, 6, ""), true),
  new jot.MOVE(3, 2, 2))

// splice removes whole LTR MOVE range
t.deepEqual(
  new jot.SPLICE(0, 2, "").rebase(
    new jot.MOVE(0, 2, 4), true),
  new jot.SPLICE(2, 2, ""))
t.deepEqual(
  new jot.MOVE(0, 2, 4).rebase(
    new jot.SPLICE(0, 2, ""), true),
  new jot.NO_OP)

// splice removes whole RTL MOVE range
t.deepEqual(
  new jot.SPLICE(4, 2, "").rebase(
    new jot.MOVE(4, 2, 0), true),
  new jot.SPLICE(0, 2, ""))
t.deepEqual(
  new jot.MOVE(4, 2, 0).rebase(
    new jot.SPLICE(4, 2, ""), true),
  new jot.NO_OP)

// splice is within RTL MOVE range
t.deepEqual(
  new jot.SPLICE(4, 3, "").rebase(
    new jot.MOVE(4, 7, 0), true),
  new jot.SPLICE(0, 3, ""))
t.deepEqual(
  new jot.MOVE(4, 7, 0).rebase(
    new jot.SPLICE(4, 3, ""), true),
  new jot.MOVE(4, 4, 0))


// splice is within LTR MOVE range
t.deepEqual(
  new jot.SPLICE(1, 2, "").rebase(
    new jot.MOVE(0, 4, 4), true),
  new jot.SPLICE(1, 2, ""))
t.deepEqual(
  new jot.SPLICE(1, 2, "").rebase(
    new jot.MOVE(0, 4, 5), true),
  new jot.SPLICE(2, 2, ""))
t.deepEqual(
  new jot.MOVE(0, 4, 6).rebase(
    new jot.SPLICE(1, 2, ""), true),
  new jot.MOVE(0, 2, 4))
t.deepEqual(
  new jot.MOVE(0, 2, 4).rebase(
    new jot.SPLICE(0, 2, ""), true),
  new jot.NO_OP)

// splice partially removes end of LTR MOVE range

t.deepEqual(
  new jot.SPLICE(1, 2, "").rebase(
    new jot.MOVE(0, 2, 4), true),
  new jot.SPLICE(0, 1, "").compose(
    new jot.SPLICE(2, 1, "")))
t.deepEqual(
  new jot.MOVE(0, 2, 4).rebase(
    new jot.SPLICE(1, 2, ""), true),
  new jot.MOVE(0, 1, 2))

t.deepEqual(new jot.SPLICE(6, 5, "").rebase(
    new jot.MOVE(4, 5, 13), true),
  new jot.SPLICE(4, 2, "").compose(
  new jot.SPLICE(8, 3, "")))

t.deepEqual(new jot.MOVE(5, 5, 13).rebase(
    new jot.SPLICE(2, 6, ""), true),
  new jot.MOVE(2, 2, 7))

t.deepEqual(new jot.SPLICE(3, 7, "").rebase(
  new jot.MOVE(0, 9, 23), true),
  jot.SPLICE(0, 1, "").compose(
    jot.SPLICE(16, 6, "")))

//splice partially removes end of RTL MOVE range

t.deepEqual(
  new jot.SPLICE(6, 2, "").rebase(
    new jot.MOVE(5, 2, 1), true),
  new jot.SPLICE(2, 1, "").compose(
    new jot.SPLICE(6, 1, "")))
t.deepEqual(
  new jot.MOVE(0, 2, 4).rebase(
    new jot.SPLICE(1, 2, ""), true),
  new jot.MOVE(0, 1, 2))

t.deepEqual(
  new jot.SPLICE(6, 6, "").rebase(
    new jot.MOVE(4, 5, 2), true),
  new jot.SPLICE(4, 3, '').compose(
    new jot.SPLICE(6, 3, '')))

t.deepEqual(
  new jot.SPLICE(6, 7, "").rebase(
    new jot.MOVE(4, 5, 2), true),
  new jot.SPLICE(4, 3, '').compose(
    new jot.SPLICE(6, 4, '')))

t.deepEqual(new jot.MOVE(4, 5, 2).rebase(
  new jot.SPLICE(6, 6, ""), true
),
  new jot.MOVE(4, 2, 2))


// splice has multiple hunks w LTR MOVE
t.deepEqual(jot.SPLICE(3, 7, "").compose(
  new jot.SPLICE(11, 3, "")
).rebase(
  new jot.MOVE(0, 9, 23), true
),
  jot.SPLICE(0, 1, "").compose(
    jot.SPLICE(8, 3, "").compose(
    jot.SPLICE(13, 6, ""))))
t.deepEqual(jot.SPLICE(3, 7, "").compose(
  new jot.SPLICE(8, 3, "")
).rebase(
  new jot.MOVE(0, 9, 23), true
).apply('JKLMNOPQRSTUVWABCDEFGHIXYZ'),'KLMNOSTUVWABCXYZ')

t.deepEqual(jot.SPLICE(3, 7, "").compose(
  new jot.SPLICE(11, 3, "")
).compose(
  new jot.SPLICE(8, 3, "")
).rebase(
  new jot.MOVE(0, 9, 23), true
).apply('JKLMNOPQRSTUVWABCDEFGHIXYZ'),'KLMNOVWABCXYZ')

t.deepEqual(jot.SPLICE(2, 2, "").compose(
  new jot.SPLICE(4, 2, "")
).compose(
  new jot.SPLICE(6, 2, "")
).rebase(
  new jot.MOVE(0, 9, 23), true
),
  jot.SPLICE(1, 2, "").compose(
    jot.SPLICE(14, 2, "").compose(
      jot.SPLICE(16, 2, ""))))

t.deepEqual(jot.SPLICE(2, 2, "").compose(
  new jot.SPLICE(4, 2, "")
).compose(
  new jot.SPLICE(6, 2, "")
).rebase(
  new jot.MOVE(0, 9, 23), true
).apply('JKLMNOPQRSTUVWABCDEFGHIXYZ'), 'JMNOPQRSTUVWABEFIXYZ')

t.deepEqual(jot.SPLICE(12, 2, "").compose(
  new jot.SPLICE(14, 2, "")
).compose(
  new jot.SPLICE(16, 2, "")
).rebase(
  new jot.MOVE(13, 9, 3), true
).apply('ABCDEFGHIJKLMWXYZ'), 'ABCNOPQRSTUVWXYZ')


// splice has multiple hunks w RTL MOVE
expect(jot.SPLICE(10, 2, "")
.compose(
	jot.SPLICE(12, 2, "")
).compose(
  new jot.SPLICE(14, 2, "")
).compose(
  new jot.SPLICE(16, 2, "")
).rebase(
  new jot.MOVE(13, 9, 3), true
).apply(new jot.MOVE(13, 9, 3).apply('ABCDEFGHIJKLMNOPQRSTUVWXYZ'))
  .to.eql('ABCNQRUVDEFGHIJMYZ')

t.end();

});
