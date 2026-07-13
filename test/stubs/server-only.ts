// ponytail: "server-only" isn't installed as a real package in this repo (see src/lib/mail.ts,
// src/lib/ai/*.ts) — those files simply have no tests importing them yet. Since Task 2.5
// needs GraphSender under test, alias the real import to this empty stub instead of installing
// a dependency or touching untested files. Upgrade path: if "server-only" ever gets added to
// package.json for real, delete this stub + the vitest alias below.
export {};
