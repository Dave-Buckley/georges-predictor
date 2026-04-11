# Deferred Items — Phase 02 Fixture Layer

## Pre-existing TypeScript Errors (Out of Scope)

These errors existed before Plan 02-01 execution and are not caused by new changes.

### 1. tests/actions/admin/members.test.ts:358
```
Argument of type '([table]: [string]) => boolean' is not assignable to parameter of type '(value: any[], index: number, array: any[][]) => unknown'.
```
- Found during: Task 2 TypeScript check
- Status: Pre-existing (confirmed via git stash test)
- Action needed: Fix destructuring pattern in members test

### 2. tests/middleware.test.ts:24
```
Type 'Mock<Procedure | Constructable>' is not assignable to type 'Mock<Procedure>'
```
- Found during: Task 2 TypeScript check
- Status: Pre-existing (confirmed via git stash test)
- Action needed: Update mock type to match vitest 4.x Mock type signatures
