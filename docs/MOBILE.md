# Phone version: product plan and how it is built

The desktop app (the design board at `/`) is drawn for a 1440 px screen and cannot be used on a phone.
This document says who the phone version is for, what it does first, what it leaves out, and how it is put together.

## Who uses it on a phone, and for what

| Who | What they do on a phone | How good it has to be |
| --- | --- | --- |
| Telecaller (Anitha, Harsha) | Find the next lead, understand it in a few seconds, call, record the outcome, send a quote or payment link on WhatsApp, move to the next lead | Excellent. This is most of the phone time. |
| Telecaller | Find a customer who calls back (search), check history, reveal the number, look up what to say (playbook) | Good |
| Team lead (Ravi) | Check today's numbers and the leaderboard, see who is behind, move a lead to another caller, mark someone on leave | Good |
| Telecaller, team lead | Edit or add a quote, documents, coupons, lessons, the detailed stats tables | Acceptable: complete and clear, not optimised |
| Admin (Vikram) | Targets, rules, message journey, templates, sent log | Reachable and readable. These are desk jobs. |

The phone is a calling tool first and a dashboard second.

## What success looks like

- From Today, a caller logs a "no answer" and is on the next lead in 4 taps: lead, Call, No answer, Save.
- A connected call is logged in 5 taps: lead, Call, Connected, outcome, Save.
- A quote goes out on WhatsApp from an open lead in 3 taps, with a visible confirmation.
- Nothing scrolls sideways on a 360 px wide phone. No text is smaller than 12 px. Every button is at least 44 px tall.
- The phone's Back button closes exactly one thing (a sheet, then the lead) and never drops a live call.
- Every button either does something or says why it cannot.

## How the phone app is organised

- **Bottom tabs:** Today, Stats, Learn, and Admin (team lead and admin only). The same four places as the desktop rail.
- **Top bar:** screen name, search, and the signed-in person's initial. The initial opens a small menu with the sample-only controls ("view as", "AI call: customer says yes").
- **Search** opens as a full screen with the keyboard up. It works from every tab (on desktop a result only opens from Today).
- **A lead opens as a full-screen page** over the queue, so the queue keeps its place when you come back. The page has three tabs:
  - **Overview**: why to call now, what to know before calling, next steps (payment, lapsed policy), AI summary, the four facts, recent history.
  - **Quotes**: insurer quotes, edit or add a quote, previous policy, send the chosen quote on WhatsApp.
  - **Customer**: contact (hidden until you call or message), language, address, and the records: documents, claims, history, coupons.
- **The action dock** at the bottom of the lead page always holds the next step of the calling loop:
  - before a call: WhatsApp, Email, Log outcome, **Call**
  - during or after a call: End, **No answer**, **Connected**. Either one opens the outcome sheet with that step already chosen.
- **Sheets** slide up from the bottom for a single task: filters, call outcome, message composer.
- **A live call follows you.** A green strip under the top bar on every tab leads back to the lead you are on a call with.
- **Messages from the app** ("Saved for Kavya. Next: Rahul") appear at the bottom wherever you are and clear by themselves.

## Decisions taken for the phone

1. **Queue cards are shorter.** A card shows what decides "call this one or not": name, car, the reason, days left, a few status tags, the best quote in one line, and Call. The star rating, chassis and engine numbers, the previous-policy block and quote editing live inside the lead.
2. **Quotes are edited in one place,** the Quotes tab of the lead. The desktop's older quote dialog (opened from a queue card) is not carried over.
3. **No dead buttons.** Controls that do nothing on desktop are not shown on the phone: Leads, Scan policy, New enquiry, the Play buttons, the Discount box, "View policy copy".
4. **Silent taps now explain themselves.** Where the desktop ignores a tap (calling a blocked lead, a fifth key filter), the phone says why.
5. **Things that cannot be undone ask first:** closing a lead, "do not call", "wrong number", moving leads in bulk, marking a person as left.
6. **View-only means no edit controls.** On someone else's lead a telecaller sees a clear "View only" note and no edit buttons, instead of dimmed controls that do nothing. A team lead sees admin settings as plain text.
7. **Readable outdoors.** Solid white cards, larger text than desktop (15 px, inputs 16 px), status always written as text as well as colour.

## Not in this version

- A real dialler. "Call" starts the same in-app call session as on desktop; it does not ring the customer. The same goes for WhatsApp and email, which are recorded, not sent.
- A native app, offline use, notifications.
- Scan policy and New enquiry (they have no behaviour on desktop yet).
- A landscape or tablet-specific layout. Tablets held upright get the phone layout in a centred column; wider screens get the desktop app.
- Saved data. As on desktop, everything is sample data and resets on reload.

## Things inherited from the desktop logic (worth fixing there, for both)

The phone shares the desktop's logic on purpose, so these behave the same on both. They are listed here so they are decided once, in the board.

- After "Save", the next lead is chosen by its position in the data, not by its place on screen, and it can be a lead that must not be called.
- "Snooze 10 min" on a callback never ends by itself.
- A telecaller looking at someone else's lead (found by search) can reveal that customer's full number by opening a message. Nothing records it.
- Only one outcome draft and one call exist at a time. Opening another lead mid-way drops the draft.
- Filter counts ignore the selected tab and the other filters.
- "Awaiting payment" on the Today strip is a fixed number.

## How it is built

- `prototype/V35.dc.html` is the board: one template drawn for desktop, and the logic. It is not edited by hand.
- `src/proto/runtime.ts` is the engine that runs a board. It can now hold a second template and shows it when the screen is narrower than 900 px. Both templates share one running copy of the logic, so turning a tablet or resizing a window keeps the same lead, tab and filters.
- `src/mobile/` is the phone layout:
  - `tpl/` the phone template in parts, one per screen, stitched together by `index.ts`
  - `css/` the phone styles: `base.css` is the shared set of parts (cards, buttons, sheets...), then one file per screen
  - `logic.ts` and `vals/` a thin layer on top of the board's logic: phone-only values (what is open, shorter lists), the Back button, the confirm dialog, the message at the bottom of the screen. It adds no business rules.
  - `contract.test.ts` checks that every value the phone template asks for still exists in the board's logic.

## When a new board version arrives

1. Add the new board under `prototype/` and change the one import in `src/proto/boot.ts`, as before.
2. Run `npm test`. The contract test lists any value the phone layout uses that the new board renamed or removed. Fix those names in `src/mobile/tpl/` or `src/mobile/vals/`.
3. New desktop features do not appear on the phone by themselves. Each needs a place in the phone template.

Because the phone layout lives in this repository, the next board must be based on the current `main`, or it will overwrite these files.
