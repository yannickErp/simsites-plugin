# Scene patterns

Small, tested building blocks for `render(t, h)`. Every one is a pure function of `t`: it sets the state for any
moment, in any order. Copy, rename the ids, adjust the times. Put the markup in the page from the start (hidden), never
create elements inside `render`.

## Finding elements

`h.$('invite-btn')`, `h.set('invite-btn', …)`, `h.fade(…)`, `h.text(…)` look for `data-sim="invite-btn"` first; anything
else is a CSS selector: `h.set('#ghost-card', …)`, `h.set('.others-label', …)`. Elements without a data-sim id need
the `#id` / `.class` form, or nothing happens (no error — the sim just doesn't change).

## Timing helpers you'll use everywhere

```js
const open  = h.prog(t, 2.0, 2.35, 'out');      // 0 → 1 while t goes 2.0 → 2.35 (eased)
const close = h.prog(t, 6.2, 6.5, 'inOut');     // 0 → 1 on the way out
const shown = open * (1 - close);               // 0 → 1 → 0
h.fade('toast', shown);                          // opacity + visibility (keeps layout)
h.between(t, 2.0, 6.5)                           // boolean window
```

## Dialog with backdrop (opens on a click, closes on confirm)

```html
<div class="backdrop" data-sim="dialog-backdrop"></div>
<div class="dialog" data-sim="delete-dialog" role="dialog">
  <h3>Delete “Draft Q4 roadmap”?</h3><p>This can't be undone.</p>
  <span class="btn" data-sim="confirm-cancel" data-ui="button">Cancel</span>
  <span class="btn btn-danger" data-sim="confirm-delete" data-ui="button">Delete</span>
</div>
```
```css
.backdrop { position: fixed; inset: 0; background: rgb(15 23 42 / .45); }
.dialog { position: fixed; left: 50%; top: 50%; width: 420px; transform: translate(-50%, -50%); }
```
```js
const d = h.prog(t, 4.1, 4.35, 'out') * (1 - h.prog(t, 6.0, 6.2));
h.fade('dialog-backdrop', d);
h.set('delete-dialog', { opacity: d, visibility: d > 0.01 ? 'visible' : 'hidden',
  transform: `translate(-50%, ${-50 + (1 - d) * 4}%) scale(${0.97 + 0.03 * d})` });
```

## Side panel sliding in from the right

```js
const p = h.prog(t, 1.6, 2.0, 'out') * (1 - h.prog(t, 9.0, 9.3));
h.set('details-panel', { transform: `translateX(${(1 - p) * 100}%)`, visibility: p > 0.01 ? 'visible' : 'hidden' });
h.$('task-t1').classList.toggle('is-selected', p > 0.5);   // the row it belongs to stays highlighted
```

## Typing into a field (focus ring, placeholder, caret)

```html
<div class="input" data-sim="invite-email"><span class="value"></span></div>
```
```js
const EMAIL = 'maya.okafor@acme.co';
const typed = h.typed(EMAIL, t, 3.0, 3.0 + EMAIL.length / 15);        // ~15 chars/s
h.$('invite-email').classList.toggle('is-focused', h.between(t, 2.8, 5.4));
h.$('invite-email').querySelector('.value').innerHTML =
  typed ? `${typed}${h.between(t, 2.8, 5.4) ? '<span class="caret"></span>' : ''}` : '<span class="placeholder">name@company.com</span>';
```
Step: `{ t: 3.0, do: 'type', target: 'invite-email', value: EMAIL }` — the step's value is exactly the text typed.

## Dropdown / select menu

```js
const m = h.prog(t, 3.2, 3.4, 'out') * (1 - h.prog(t, 4.2, 4.35));
h.set('assignee-menu', { opacity: m, visibility: m > 0.01 ? 'visible' : 'hidden', transform: `translateY(${(1 - m) * -4}px)` });
h.$('assignee-option-sam-chen').classList.toggle('is-hover', h.between(t, 3.8, 4.2));
h.text('assignee-value', t >= 4.2 ? 'Sam Chen' : 'Ana Lopez');
```
Steps: click the field (`assignee-select`) at 3.2, click the option (`assignee-option-sam-chen`) at 4.2.

## A new row appearing in a list (and the counter that goes with it)

```js
const added = h.prog(t, 6.6, 7.0, 'out');
h.set('member-row-maya-okafor', { height: `${56 * added}px`, opacity: added, overflow: 'hidden' });
h.set('member-row-maya-okafor', { background: `color-mix(in srgb, var(--accent-soft) ${Math.round(100 * (1 - h.prog(t, 8, 9)))}%, transparent)` });
h.text('team-count', `${t >= 6.6 ? 4 : 3} members`);
```

## Removing a row (delete)

```js
const gone = h.prog(t, 6.3, 6.7, 'inOut');
h.set('task-t3', { height: `${52 * (1 - gone)}px`, opacity: 1 - gone, overflow: 'hidden', borderTopWidth: gone > 0.99 ? '0px' : '1px' });
```

## Toast that appears, holds, leaves

```js
const toast = h.prog(t, 7.0, 7.3, 'out') * (1 - h.prog(t, 10.4, 10.8));
h.set('toast-deleted', { opacity: toast, visibility: toast > 0.01 ? 'visible' : 'hidden', transform: `translateY(${(1 - toast) * 12}px)` });
```
An `expect` step on a toast goes ~0.2s after it starts appearing, while it's fully visible.

## Button pressed / busy / done

```js
h.$('invite-send').classList.toggle('is-pressed', h.between(t, 6.5, 6.65));
h.text('invite-send', h.between(t, 6.5, 7.1) ? 'Sending…' : 'Send invite');
```

## Inline validation error (the error variant of a flow)

```js
const err = h.prog(t, 5.0, 5.2, 'out');
h.fade('email-error', err);                                   // "Enter a valid email address"
h.$('invite-email').classList.toggle('is-invalid', t >= 5.0);
```
Then `{ t: 5.3, do: 'expect', target: 'email-error' }`.

## Hover tooltip

```js
h.fade('blocked-tip', h.prog(t, 3.0, 3.2) * (1 - h.prog(t, 5.0, 5.2)));
```
Step: `{ t: 2.8, do: 'hover', target: 'task-t2-badge' }`.

## Uploading a file (avatar, attachment, import)

Draw the button the user clicks and what happens after the pick (preview, file name, progress); the OS dialog is
never drawn. Step: `{ t: 2.0, do: 'upload', target: 'avatar-upload', value: 'ana.png', note: 'Picks a photo' }` —
verify picks a generated file with that name (a real tiny PNG for images, a small CSV for .csv).

## Double-click (rename in place)

Step: `{ t: 1.2, do: 'dblclick', target: 'card-c2', note: 'Double-clicks to rename' }` — the runtime shows two quick
ripples; verify double-clicks the real element. Never write a double-click as `click` (verify would click once).

## Pressing a key (Enter submits, Escape closes)

```js
const added = t >= 3.4;                                       // the key press adds the card
h.$('new-card').querySelector('.value').innerHTML = !added && typed ? typed : '<span class="placeholder">Add a card</span>';
```
Step: `{ t: 3.4, do: 'key', target: 'new-card', value: 'Enter', note: 'Adds it' }` — the runtime shows the key; the
target is the focused element. Escape on a dialog: `{ do: 'key', value: 'Escape' }`.

## Dragging an item (to another list, or to reorder)

One record keeps ONE data-sim id wherever it is drawn (the copy in To do and the copy in Done are both `card-c4`);
show the copy where it is at time t and draw a lifted "ghost" following the pointer during the drag (0.8s).
```js
const dragging = h.between(t, 5.2, 6.0), dropped = t >= 6.0;
h.set('#card-c4-in-todo', { display: dropped ? 'none' : 'block', opacity: dragging ? 0.35 : 1 });
h.set('#card-c4-in-done', { display: dropped ? 'block' : 'none' });
const p = h.prog(t, 5.2, 6.0, 'inOut'), from = h.$('#card-c4-in-todo').getBoundingClientRect(), to = h.$('column-done').getBoundingClientRect();
h.set('#ghost', dragging ? { display: 'block', left: `${h.tween(t, 5.2, 6.0, from.left, to.left + 12)}px`, top: `${h.tween(t, 5.2, 6.0, from.top, to.top + 60)}px` } : { display: 'none' });
```
Step: `{ t: 5.2, do: 'drag', target: 'card-c4', to: 'column-done', note: 'Moves it to Done' }` — verify drags it in
the real app and checks it really landed in `column-done` (or, dropped on a sibling card, moved within its list).

## Scrolling a long page

Wrap the page content in `<div data-sim-scroll>`; `h.scrollTo(y)` translates it.
```js
h.scrollTo(h.tween(t, 4.0, 5.0, 0, 620, 'inOut'));
```
Step: `{ t: 4.0, do: 'scroll', target: 'billing-section' }` — the target must be in view after the scroll.

## Phone layout

```js
Sim.define({ variants: ['default', 'mobile'], … });
const phone = h.variant === 'mobile';
document.body.classList.toggle('is-phone', phone);           // CSS does the rest: .is-phone .sidebar { display: none } …
```
Steps only the phone takes (open the menu first): `{ t: 1.2, do: 'click', target: 'nav-menu', only: 'mobile' }`.
