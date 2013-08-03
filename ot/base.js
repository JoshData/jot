/* Base functions for the operational transform library. */


import copy

class ConflictError(Exception):
	"""This exception is thrown inside rebase to indicate the no rebase can be made."""
	
	def __init__(self, a, b):
		self.a = a
		self.b = b
		
	def __repr__(self):
		return "Conflict between %s and %s" % (repr(self.a), repr(self.b))

	def __str__(self):
		return repr(self)

class OperationBase(object):
	"""The abstract base class of all transformable operations."""

	def simplify(self):
		"""A fast operation that returns a simpler version of this operation in case it is a degenerate case of a more general class of operations."""
		return self

	def normalize(self):
		"""A slow operation that composes internal operations before simplifying."""
		return self
		
	def apply(self, document):
		"""Applies this operation to a document."""
		raise NotImplementedError()

	def __or__(self, other):
		# Runs apply, but always makes a deep copy first.
		# i.e. self | "document", designed to have lower precedence than the other overloaded operator
		return self.apply(copy.deepcopy(other))

	def invert(self):
		"""Returns the inverse operation of this operation, such that self.compose(self.invert()) is equivalent to NullOperation."""
		raise NotImplementedError()
	
	def __invert__(self, other):
		# i.e. ~self
		return self.invert(other)

	def compose(self, other):
		"""Returns an operation that has the same behavior as other.apply(self.apply(document)). If either is a NullOperation, returns the other. Otherwise returns self.atomic_compose(other) if the operations are both atomic and the result is not None. Otherwise returns a Sequence. Self and other are assumed to already be simplified. When other is self.invert(), must return a NullOperation."""
		if isinstance(self, NullOperation):
			return other
		elif isinstance(other, NullOperation):
			return self
		elif isinstance(self, Sequence) and isinstance(other, Sequence):
			return Sequence(self.operations + other.operations)
		elif isinstance(self, Sequence):
			return Sequence(self.operations + [other])
		elif isinstance(other, Sequence):
			return Sequence([self] + other.operations)
		else:
			# both are atomic operations
			c = self.atomic_compose(other)
			if c:
				return c
			return Sequence([self, other])

	def __add__(self, other):
		# i.e. self + other
		return self.compose(other)

	def rebase(self, other):
		"""Returns an operation such that other.compose(self.rebase(other)) yields an operation equivalent to self.compose(other.rebase(self)) and self.rebase(a.compose(b)) is equivalent to self.rebase(a).rebase(b). The idea is that if self and other were created simultaneously, the rebase creates a pair of operations that can be applied sequentially to combine the operations. Self and other are assumed to already be simplified. A ConflictError can be thrown if no rebase exists."""
		raise NotImplementedError()
		
	def __div__(self, other):
		# i.e. self / other
		return self.rebase(other)
		
	def rcompose(self, other):
		"""Returns a composition of the operations equivalent to self.compose(other.rebase(self))."""
		return self.compose(other.rebase(self))
		
	def __mul__(self, other):
		return self.rcompose(other)

class AtomicOperation(OperationBase):
	"""The abstract base class for non-Sequence operations."""
	
	def atomic_compose(self, other):
		"""Returns an atomic operation that has the same behavior as other.apply(self.apply(document)),
		or None if no atomic operation can be created. other is an atomic operation except NullOperation. Self and other are assumed to be simplified."""
		raise NotImplementedError()

	def atomic_rebase(self, other):
		"""Returns an operation that meets the Operation.rebase() contract, given an atomic non-null operation other. Self and other are assumed to be simplified."""
		raise NotImplementedError()

	def rebase(self, other):
		if isinstance(other, Sequence):
			r = self
			for op in other.operations:
				r = r.rebase(op)
			return r
		elif isinstance(other, NullOperation):
			return self
		else:
			return self.atomic_rebase(other)

class NullOperation(AtomicOperation):
	"""A operation that is a no-op. This operation makes no changes to a document. Its inverse is itself. It composes with any other operation to return the other operation. Its rebase against any operation is itself."""
	def apply(self, document):
		return document
	def invert(self):
		return self
	def atomic_compose(self, other):
		return other
	def atomic_rebase(self, other):
		# The rebase of NULL against anything is NULL (by axiom) and anything rebased against NULL is itself.
		# a/NULL ==> NULL + a/NULL => a + NULL/a => a
		return self
		
class Sequence(OperationBase):
	"""A operation that applies a list of other (typically atomic) operations sequentially."""
	
	def __init__(self, operations, is_normalized=False):
		"""Creates a new Sequence operation."""
		self.operations = operations
		self.normalized = is_normalized
		
	def __repr__(self):
		return "Sequence[" + ", ".join(repr(s) for s in self.operations) + "]"

	def simplify(self, recursive=True):
		"""If this operation contains zero or one operation, returns a NullOperation or the operation it contains --- not wrapped by a Sequence. Otherwise, returns self."""
		if len(self.operations) == 0:
			return NullOperation()
		if len(self.operations) == 1:
			return self.operations[0].simplify()
		if not recursive: return self
		return Sequence([t.simplify() for t in self.operations], is_normalized=self.normalized)
		
	def normalize(self):
		"""Composes consecutive operations where possible and removes NullOperations, returning a new Sequence, or if the Sequence contains an empty list, a NullOperation, or if the Sequence contains just a single operation, then that operation is returned."""
		operations = []		
		for tseq in self.operations:
			tseq = tseq.normalize()
			if isinstance(tseq, NullOperation): continue
			
			t_ops = [tseq]
			if isinstance(tseq, Sequence):
				t_ops = tseq.operations
			
			for t in t_ops:
				if len(operations) == 0:
					# Just append the first one.
					operations.append(t)
				else:
					# Test if the last operation in the list can be composed
					# with the next one. If so, replace the last operation
					# with the composed operation. Otherwise append the
					# next operation.
					c = operations[-1].atomic_compose(t)
					if c:
						if isinstance(c, NullOperation):
							operations.pop(-1)
						else:
							operations[-1] = c
					else:
						operations.append(t)
						
		return Sequence(operations, is_normalized=True).simplify(recursive=False)

	def apply(self, document):
		# Apply the operations in sequence.
		for t in self.operations:
			document = t.apply(document)
		return document
		
	def invert(self):
		# Apply the inverses of the operations in reverse order.
		# Then normalize in case any operations compose.
		ops = [t.invert() for t in self.operations]
		ops.reverse()
		return Sequence(ops).normalize()

	def rebase(self, other):
		# Rebase recursively.
		
		if isinstance(other, NullOperation):
			return self
		
		# Normalize first.
		if not self.normalized:
			return self.normalize().rebase(other)
			
		# We're guaranteed to be normalized, which means we have at least two non-composable
		# operations. Split this sequence into the first operation and the remaining operations.
		op1 = self.operations[0]
		op2 = Sequence(self.operations[1:], is_normalized=True).simplify() # fast normalization
		
		return op1.rebase(other).compose( op2.rebase(other.rebase(op1)) )

		# To see why this works, it will help to put this in a symbolic form.
		#
		#   Let a + b == a.compose(b)
		#   and a / b == a.rebase(b)
		#
		# We're computing self/other, and our return value in symbolic form is:
		#
		#   (op1/other) + (op2/(other/op1))
		#   where self = op1 + op2
		#
		# The contract of rebase is;
		# 	a + (b/a) == b + (a/b)   and
		# 	x/(a+b) == (x/a)/b
		#
		# Also note that the compose operator is associative, so
		#	a + (b+c) == (a+b) + c
		#
		# To see that we've implemented rebase correctly, let's look
		# at what happens when we compose our result with other as per the rebase rule:
		#   other + (self/other)
		# And then do some algebraic manipulations:
		#   other + [ (op1/other) + (op2/(other/op1)) ]   (substituting our hypothesis for self/other)
		#   [ other + (op1/other) ] + (op2/(other/op1))   (associativity)
		#   [ op1 + (other/op1) ] + (op2/(other/op1))     (rebase's contract on the left side)
		#   op1 + [ (other/op1)  + (op2/(other/op1)) ]    (associativity)
		#   op1 + [ op2 + ((other/op1)/op2) ]             (rebase's contract on the right side)
		#   (op1 + op2) + ((other/op1)/op2)               (associativity)
		#   self + [(other/op1)/op2]                      (substituting self for (op1+op2))
		#   self + [other/(op1+op2)]                      (rebase's second contract)
		#   self + (other/self)                           (substitution)
		# Thus we've proved that the rebase contract holds for our return value.

class ConsoleObserver(object):
	def push(self, operation):
		print(operation)
	

class RecordingObserver(object):
	def __init__(self):
		self.ops = []
		
	def push(self, operation):
		self.ops.append(operation)

	def get_operations(self):
		d = self.ops
		self.ops = []
		return Sequence(d).normalize()

