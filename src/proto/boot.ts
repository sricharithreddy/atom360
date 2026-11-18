// Production screen: the latest design-canvas board, run as is.
// To ship a newer board, add it under prototype/ and change the import below.
import board from '../../prototype/V35.dc.html?raw';
import { DCLogic, mountPrototype } from './runtime';
import './proto.css';
import { MOBILE_QUERY, mobileTemplate, withMobile } from '../mobile';

export function bootPrototype(el: HTMLElement): void {
  const body = board.slice(board.indexOf('<x-dc>') + 6, board.indexOf('<script type="text/x-dc"'));
  const template = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const code = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(board)![1];
  // The board ships its logic as source text, so it is turned into a class here.
  const Component = new Function('DCLogic', `${code}\nreturn Component;`)(DCLogic);
  // Phones get their own layout on the same logic and state (see src/mobile).
  mountPrototype(withMobile(Component), template, el, { query: MOBILE_QUERY, template: mobileTemplate });
}
