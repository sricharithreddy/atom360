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

- **Top bar on Today:** a search bar with the **filters** button inside it on the right, the **alerts** bell, and the signed-in person's initial.
- **No bottom tabs.** The queue gets the whole screen. Stats, Learn and Admin (team lead and admin only) open from the menu behind the initial; on those screens the top bar has a back arrow to Today.
- **Alerts** (the bell, with a count) hold the promised callback that is due (Call now, Snooze), calls made without an outcome, customers who told the AI they want to renew, and callbacks later today. They used to sit on the Today screen.
- **Lead cards** on Today show **OD only** or **TP only** next to the policy end date when the renewal is not the usual OD + TP.
- **Today** starts with a slim strip of four numbers: calls against target, connected, renewed, and the month against target. Then the lists (Due now, Hot, Follow-ups, All), the one-tap key filters, and the lead cards.
- **Search** opens as a full screen with the keyboard up. It works from every screen.
- **A lead opens as a full-screen page** over the queue, so the queue keeps its place. Four tabs:
  - **Overview**: why to call now and the next call time, a few short tags (Hot, With AI, OD only renewal...), the payment or lapsed-policy steps when there are any, then:
    - **Vehicle**: registration, chassis and engine (or motor) numbers, each with **Copy**.
    - **Policy**: the renewal type first (**OD only**, **TP only** or **OD + TP**, with what it means for the quote), insurer, policy number with Copy, when OD and TP end, NCB, IDV, whether a claim was made last year, and the financier.
    - rows that lead to the best quote and the last contact (with the number of attempts). No scripts or long explanations.
  - **Quotes**: insurer quotes, edit or add a quote, previous policy, send the chosen quote on WhatsApp.
  - **History**: two views. **Calls & messages** (calls, AI calls, WhatsApp and email), and **Service** (visits to our workshop: periodic service, repairs, claim repairs, with amount and kilometres).
  - **Customer**: contact (hidden until you call or message), language, address, and documents, claims and coupons.
- **The action dock** at the bottom of the lead page always holds the next step of the calling loop:
  - before a call: WhatsApp, Email, Outcome, **Call**
  - during or after a call: End, **No answer**, **Connected**. Either one opens the outcome sheet with that step already chosen.
- **Sheets** slide up from the bottom for a single task: filters, alerts, call outcome, message composer.
- **A live call follows you.** A green strip under the top bar leads back to the lead you are on a call with.
- **Messages from the app** ("Saved for Kavya. Now on Fatima.") appear at the top and clear by themselves.
- **Back** closes one thing at a time. From Stats, Learn or Admin it returns to Today. It will not leave the app while a call is live.

## Decisions taken for the phone

1. **Queue cards are shorter.** A card shows what decides "call this one or not": name, car, the reason, days left, a few status tags, the best quote in one line, and Call. The star rating, chassis and engine numbers, the previous-policy block and quote editing live inside the lead.
2. **Quotes are edited in one place,** the Quotes tab of the lead. The desktop's older quote dialog (opened from a queue card) is not carried over.
3. **No dead buttons.** Controls that do nothing on desktop are not shown on the phone: Leads, Scan policy, New enquiry, the Play buttons, the Discount box, "View policy copy".
4. **Silent taps now explain themselves.** Where the desktop ignores a tap (calling a blocked lead, a fifth key filter), the phone says why.
5. **Things that cannot be undone ask first:** closing a lead, "do not call", "wrong number", moving leads in bulk, marking a person as left.
6. **Double taps are harmless.** When the buttons under the thumb change (a call starts, a sheet closes), taps are ignored for a moment, so a double tap cannot pick an outcome or start a call on the next lead. Calling a second customer while a call is live asks first.
7. **View-only means no edit controls.** On someone else's lead a telecaller sees a clear "View only" note and no edit buttons, instead of dimmed controls that do nothing. A team lead sees admin settings as plain text.
8. **Readable outdoors.** Solid white cards, larger text than desktop (15 px, inputs 16 px), status always written as text as well as colour.

## Showing it on a computer

The live site has a **Desktop / Mobile** switch at the bottom of the left rail. **Mobile** opens the phone layout in a phone frame, with buttons for the phone's Back button and for restarting the demo with fresh sample data. Desktop and phone keep separate sample data, so switching back and forth keeps each where you left it. `/?view=mobile` opens straight in phone view. On a real phone the switch is not shown.

## Not in this version

- A real dialler. "Call" starts the same in-app call session as on desktop; it does not ring the customer. The same goes for WhatsApp and email, which are recorded, not sent.
- A native app, offline use, notifications.
- Scan policy and New enquiry (they have no behaviour on desktop yet).
- A landscape or tablet-specific layout. Tablets held upright get the phone layout in a centred column; wider screens get the desktop app.
- Saved data. As on desktop, everything is sample data and resets on reload.
- Real service history. The Service view shows sample workshop visits kept in `src/mobile/vals/lead-history.ts` until the dealer's workshop system is connected. The desktop does not show service history yet.

## Things inherited from the desktop logic (worth fixing there, for both)

The phone shares the desktop's logic on purpose, so these behave the same on both. They are listed here so they are decided once, in the board.

- After "Save", the next lead is chosen by its position in the data, not by its place on screen, and it can be a lead that must not be called.
- "Snooze 10 min" on a callback never ends by itself.
- A telecaller looking at someone else's lead (found by search) can reveal that customer's full number by opening a message. Nothing records it.
- Only one call exists at a time, and an outcome being filled in belongs to one lead at a time.
- A lead closed as lost (renewed elsewhere, vehicle sold...) stays in the queue with a working Call button. Only "wrong number" and "do not call" change the card.
- Details typed with an outcome are not checked (a two-digit mobile is accepted), and a template's wording can be saved empty.
- Marking a person as left says their leads follow the allocation rules, but the leads stay with them until moved.
- Some sentences disagree with the numbers (the claims note says NCB 35% while the quotes use 45%) or lack singular forms ("1 leads lost").
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
