@AGENTS.md
@~/.claude/AGENTS-COMPACT.md

# masterclass

Multi-tenant Kajabi-like platform. Plan + decisions log (G0–G28): `docs/PLAN.md`.

- Rule G0: mimic Kajabi behaviour (verify on help.kajabi.com) unless docs/PLAN.md says otherwise.
- TDD. `pnpm verify` green before every PR.
- UI: MDS + CSS Modules. No Tailwind.
- Host -> space: `src/proxy.ts` -> `src/lib/tenancy/`. Platform host SSOT: `src/config/platform.ts`.
- Dev hosts: `localhost` (platform), `<slug>.localhost` (space).
- Reference app: `../kinbaku-study-group` (copy code, never share — G27).
