// Phone layout for the board: a second template that runs on the board's own logic.
// The template is written in parts (tpl/*.html) and stitched into the shell here.
import './css/base.css';
import './css/shell.css';
import './css/today.css';
import './css/filters.css';
import './css/lead-summary.css';
import './css/lead-quotes.css';
import './css/lead-customer.css';
import './css/outcome.css';
import './css/message.css';
import './css/stats.css';
import './css/learn.css';
import './css/admin.css';
import './css/admin-messages.css';
import './css/alerts.css';
import './css/lead-history.css';
import shell from './tpl/shell.html?raw';
import lead from './tpl/lead.html?raw';
import today from './tpl/today.html?raw';
import filters from './tpl/filters.html?raw';
import leadSummary from './tpl/lead-summary.html?raw';
import leadQuotes from './tpl/lead-quotes.html?raw';
import leadCustomer from './tpl/lead-customer.html?raw';
import outcome from './tpl/outcome.html?raw';
import message from './tpl/message.html?raw';
import stats from './tpl/stats.html?raw';
import learn from './tpl/learn.html?raw';
import admin from './tpl/admin.html?raw';
import adminMessages from './tpl/admin-messages.html?raw';
import alerts from './tpl/alerts.html?raw';
import leadHistory from './tpl/lead-history.html?raw';
import { assemble } from './assemble';

export { MOBILE_QUERY, withMobile } from './logic';

export const mobileTemplate = assemble(shell, {
  lead, today, filters, 'lead-summary': leadSummary, 'lead-quotes': leadQuotes, 'lead-customer': leadCustomer,
  outcome, message, stats, learn, admin, 'admin-messages': adminMessages, alerts, 'lead-history': leadHistory,
});
