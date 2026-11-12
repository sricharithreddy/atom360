# API contract

Every screen talks to the server through `src/api/endpoints.ts`. The fake server in `src/mock/handlers.ts` answers these calls today; the real backend must answer the same calls with the same shapes (types in `src/domain/types.ts`).

All calls except sign-in send `Authorization: Bearer <token>`. Errors come back as `{ "message": "..." }` with a plain sentence the screen can show as is.

| Method | Path | Body | Returns | Notes |
| --- | --- | --- | --- | --- |
| POST | `/auth/sign-in` | `{ mobile, pin }` | `Session` | 401 when they do not match |
| GET | `/me` | | `Session` | restores a session after reload |
| GET | `/today/summary` | | `TodaySummary` | own numbers for a telecaller, team numbers for a team lead or admin |
| GET | `/queue?tab=&aiQualified=&expiringInDays=&source=` | | `QueueResponse` | filtering, grouping and ordering happen on the server |
| GET | `/leads/search?q=` | | `LeadCard[]` | name, reg no, mobile or policy no; includes other people's leads (view only) |
| GET | `/leads/:id` | | `LeadDetail` | contact details are masked |
| POST | `/leads/:id/reveal` | `{ field }` | `{ value }` | records who looked at the full number or email |
| POST | `/leads/:id/calls` | | `{ call, mobile }` | 403 with the reason when a call is not allowed |
| POST | `/leads/:id/outcomes` | `OutcomeInput` | `LeadDetail` | 403 unless owner, team lead or admin |
| POST | `/leads/:id/quotes` | `QuoteInput` (+ `id` to edit) | `LeadDetail` | live quotes cannot be edited |
| POST | `/leads/:id/messages` | `{ template }` | `{ body, waUrl }` | builds the WhatsApp message and link |

`/mock/*` endpoints exist only in the fake server (sample logins, reset, calling-hours switch).

## Rules the server enforces

They live in `src/rules/` as pure functions with tests, so the backend can import or port them unchanged:

- **Ownership** (`canEditLead`, `callBlock`): only the owner, a team lead or an admin edits a lead or logs an outcome. Anyone can search and view.
- **Calling rules** (`callBlock`): wrong number, do not call, not the owner, outside calling hours, in that order.
- **Allocation** (`allocateLead`): earlier renewer first if still active (on leave counts), then round robin.
- **AI in parallel** (`aiState`): AI picks up a call pending for more than `dealer.aiPickupDays`; never for do-not-call customers.
- **Queue** (`queueGroup`, `queueRank`): promised callbacks first, then AI qualified, then by due time.
