// Production screen: the latest design-canvas board, run as is.
// To ship a newer board, add it under prototype/ and change the import below.
import board from '../../prototype/V35.dc.html?raw';
import { DCLogic, mountPrototype } from './runtime';
import './proto.css';
import { MOBILE_QUERY, mobileTemplate, withMobile } from '../mobile';
import { injectDesk } from '../desk/inject';
import '../desk/desk.css';

export function bootPrototype(el: HTMLElement): void {
  const body = board.slice(board.indexOf('<x-dc>') + 6, board.indexOf('<script type="text/x-dc"'));
  const template = body
    .replace(/<helmet>[\s\S]*?<\/helmet>/, '')
    // Current Autoprism dark app icon on the dark rail, instead of the board's older drawn triangle (if a board still has it).
    .replace(/<svg[^>]*aria-label="Autoprism"[^>]*>[\s\S]*?<\/svg>/, '<img src="/brand/autoprism-icon-dark.png" width="40" height="40" alt="Autoprism" style="display: block; width: 40px; height: 40px">');
  // Features that started on the phone, added to the desktop board at named spots (see src/desk).
  const desk = injectDesk(template);
  if (desk.missing.length && typeof console !== 'undefined') console.warn('Desktop parts not placed (anchor moved in this board):', desk.missing.join(', '));
  const code = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(board)![1];
  // The board ships its logic as source text, so it is turned into a class here.
  const Component = new Function('DCLogic', `${code}\nreturn Component;`)(DCLogic);
  // Phones get their own layout on the same logic and state (see src/mobile).
  mountPrototype(withMobile(Component), desk.template, el, { query: MOBILE_QUERY, template: mobileTemplate });
}
