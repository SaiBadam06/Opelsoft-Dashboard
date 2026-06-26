// Printed before `next dev` (via the package.json "predev" hook).
console.log(
  [
    "",
    "──────────────────────────────────────────────────────────────",
    " OpelSoft Dashboard",
    " If you ever reset the DB, the full sequence is:",
    "   1. Run migrations 0001 → 0002 → 0003 → 0004 in the SQL Editor",
    "   2. npm run seed         (admin account)",
    "   3. npm run seed:all     (everything else / dummy data)",
    "──────────────────────────────────────────────────────────────",
    "",
  ].join("\n"),
);
