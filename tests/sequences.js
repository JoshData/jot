var test = require('tap').test;
var values = require("../jot/values.js");
var seqs = require("../jot/sequences.js");
var jot = require("../jot");

test('sequences', function(t) {

// inspect

t.equal(
	new seqs.SPLICE(0, "1", "4").inspect(),
	'<sequences.SPLICE +0 "1" => "4">');
t.equal(
	new seqs.MOVE(0, 2, 5).inspect(),
	'<sequences.MOVE @0x2 => @5>');
t.equal(
	new seqs.APPLY(0, new values.SET(2)).inspect(),
	'<sequences.APPLY 0:<values.SET 2>>');
t.equal(
	new seqs.APPLY({ 0: new values.SET(2), 4: new values.SET(10) }).inspect(),
	'<sequences.APPLY 0:<values.SET 2>, 4:<values.SET 10>>');
t.equal(
	new seqs.MAP(new values.MATH('add', 1)).inspect(),
	'<sequences.MAP <values.MATH add:1>>');

// serialization

t.deepEqual(
	jot.opFromJSON(new seqs.SPLICE(0, "1", "4").toJSON()),
	new seqs.SPLICE(0, "1", "4"));
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
	new seqs.SPLICE(0, "1", "4").apply("123"),
	"423");
t.equal(
	new seqs.SPLICE(0, "1", "").apply("123"),
	"23");
t.equal(
	new seqs.SPLICE(0, "1", "44").apply("123"),
	"4423");
t.equal(
	new seqs.SPLICE(3, "", "44").apply("123"),
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
	new seqs.SPLICE(3, "123", "123").simplify(),
	new values.NO_OP());
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").simplify(),
	new seqs.SPLICE(3, "123", "456"));
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
	new seqs.SPLICE(3, "123", "456").inverse("123"),
	new seqs.SPLICE(3, "456", "123"));
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
	new seqs.APPLY({ 0: new values.SET("d"), 1: new values.SET("e") }).inverse({ 0: "a", 1: "b" }),
	new seqs.APPLY({ 0: new values.SET("a"), 1: new values.SET("b") }));


// compose

t.deepEqual(
	new seqs.SPLICE(0, "", "123").compose(new values.SET("456")),
	new values.SET("456"));
t.deepEqual(
	new seqs.SPLICE([{offset: 0, old_value: "1234", new_value: "ab"}, {offset: 1, old_value: "5678", new_value: "cdef"}]).compose(new seqs.APPLY(4, new values.SET("D"))),
	new seqs.SPLICE([{offset: 0, old_value: "1234", new_value: "ab"}, {offset: 1, old_value: "5678", new_value: "cDef"}]));
t.deepEqual(
	new seqs.SPLICE(0, "1234", "5678").compose(new seqs.APPLY(1, new values.SET("0"))),
	new seqs.SPLICE(0, "1234", "5078"));
t.deepEqual(
	new seqs.SPLICE(0, "1234", "5678").compose(new seqs.APPLY(4, new values.SET("0"))),
	null);

t.deepEqual(
	new seqs.MOVE(0, 2, 4).compose(new values.SET("5678")),
	new values.SET("5678"));

t.deepEqual(
	new seqs.APPLY(0, new values.SET("0", "1")).compose(new values.SET("5678")),
	new values.SET("5678"));
t.deepEqual(
	new seqs.APPLY(0, new values.SET("0", "1")).compose(new seqs.SPLICE(0, "1234", "5678")),
	null);
t.deepEqual(
	new seqs.APPLY(555, new values.SET("B"))
		.compose(new seqs.APPLY(555, new values.SET("C"))),
	new seqs.APPLY(555, new values.SET("C")));
t.deepEqual(
	new seqs.APPLY(555, new values.MATH("add", 1))
		.compose(new seqs.APPLY(555, new values.MATH("mult", 1))),
	new seqs.APPLY(555, new jot.LIST([
		new values.MATH("add", 1), new values.MATH("mult", 1)
	])));
t.deepEqual(
	new seqs.APPLY(0, new values.SET("d")).compose(new seqs.APPLY(1, new values.SET("e"))),
	new seqs.APPLY({ 0: new values.SET("d"), 1: new values.SET("e") }));
t.deepEqual(
	new seqs.APPLY({ 0: new values.SET("d"), 1: new values.SET("e") }).compose(new seqs.APPLY(0, new values.SET("f"))),
	new seqs.APPLY({ 0: new values.SET("f"), 1: new values.SET("e") }));

// rebase

t.deepEqual(
	new seqs.SPLICE(0, "123", "456").rebase(
		new seqs.SPLICE(0, "123", "456")),
	new values.NO_OP());
t.notOk(
	new seqs.SPLICE(0, "", "123").rebase(
		new seqs.SPLICE(0, "", "456")));
t.deepEqual(
	new seqs.SPLICE(0, "", "123").rebase(
		new seqs.SPLICE(0, "", "456"), true),
	new seqs.SPLICE(0, "", "123"));
t.deepEqual(
	new seqs.SPLICE(0, "", "456").rebase(
		new seqs.SPLICE(0, "", "123"), true),
	new seqs.SPLICE(3, "", "456"));
t.notOk(
	new seqs.SPLICE(0, "123", "456").rebase(
		new seqs.SPLICE(0, "123", "789")));
t.deepEqual(
	new seqs.SPLICE(0, "123", "456").rebase(
		new seqs.SPLICE(0, "123", "789"), true),
	new values.NO_OP());
t.deepEqual(
	new seqs.SPLICE(0, "123", "789").rebase(
		new seqs.SPLICE(0, "123", "456"), true),
	new seqs.SPLICE(0, "456", "789"));
t.deepEqual(
	new seqs.SPLICE(0, "123", "456").rebase(
		new seqs.SPLICE(3, "789", "")),
	new seqs.SPLICE(0, "123", "456"));
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").rebase(
		new seqs.SPLICE(0, "789", "AC")),
	new seqs.SPLICE(2, "123", "456"));

// one encompasses the other
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").rebase(
		new seqs.SPLICE(3, "1", "ABC"), true),
	new seqs.SPLICE(6, "23", "456"));
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").rebase(
		new seqs.SPLICE(4, "2", "ABC"), true),
	new seqs.SPLICE(3, "1ABC3", "456"));
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").rebase(
		new seqs.SPLICE(5, "3", "ABC"), true),
	new seqs.SPLICE(3, "12", "456"));
t.deepEqual(
	new seqs.SPLICE(3, "1", "ABC").rebase(
		new seqs.SPLICE(3, "123", "456"), true),
	new seqs.SPLICE(3, "", "ABC"));
t.deepEqual(
	new seqs.SPLICE(4, "2", "ABC").rebase(
		new seqs.SPLICE(3, "123", "456"), true),
	new values.NO_OP());
t.deepEqual(
	new seqs.SPLICE(5, "3", "ABC").rebase(
		new seqs.SPLICE(3, "123", "456"), true),
	new seqs.SPLICE(6, "", "ABC"));
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").rebase(
		new seqs.SPLICE(2, "0123", "ABC"), true),
	new seqs.SPLICE(5, "", "456"));
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").rebase(
		new seqs.SPLICE(2, "01234", "ABC"), true),
	new values.NO_OP());

// partial overlap
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").rebase(
		new seqs.SPLICE(2, "01", "ABC"), true),
	new seqs.SPLICE(6, "23", "456"));
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").rebase(
		new seqs.SPLICE(5, "34", "ABC"), true),
	new seqs.SPLICE(3, "12", "456"));
t.deepEqual(
	new seqs.SPLICE(3, "123", "456").rebase(
		new seqs.SPLICE(4, "234", "AB"), true),
	new seqs.SPLICE(3, "1", "456"));
t.deepEqual(
	new seqs.SPLICE(2, "01", "ABC").rebase(
		new seqs.SPLICE(3, "123", "46"), true),
	new seqs.SPLICE(2, "0", "ABC"));
t.deepEqual(
	new seqs.SPLICE(5, "34", "ABC").rebase(
		new seqs.SPLICE(3, "123", "46"), true),
	new seqs.SPLICE(6, "4", "ABC"));
t.deepEqual(
	new seqs.SPLICE(4, "234", "ABC").rebase(
		new seqs.SPLICE(3, "123", "46"), true),
	new seqs.SPLICE(7, "4", "ABC"));

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
		new seqs.INS(555, [5])),
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
	new values.NO_OP()
	)
t.deepEqual(
	new seqs.APPLY(555, new values.SET("z")).rebase(
		new seqs.APPLY(555, new values.SET("y")), true),
	new seqs.APPLY(555, new values.SET("z"))
	)
t.deepEqual(
	new seqs.APPLY({0: new values.SET("z"), 1: new values.SET("b"), 2: new values.SET("N")}).rebase(
		new seqs.APPLY({0: new values.SET("y"), 1: new values.SET(" ")}), true),
	new seqs.APPLY({0: new values.SET("z"), 1: new values.SET("b"), 2: new values.SET("N")})
	)

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

t.end();

});
