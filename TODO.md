* REN still has a conflictless case that needs to be implemented, afterwards diff can return RENs again.
* MOVE needs to be rewritten or merged with PATCH and then made conflictless.
* PATCH inside PATCH must go away in simplfy in case a PATCH ends up inside a PATCH from rebasing a MAP
* Document diff.
* Versioning of serialized objects.
* Strucutued output of conflicts from failed rebases would make it easier to implement a git merge driver.
* Developer documentation.
* Floating point operations yield inconsistent results due to rounding. The random.js tests fail because of this.
* Better/more tests.
* Test coverage.
