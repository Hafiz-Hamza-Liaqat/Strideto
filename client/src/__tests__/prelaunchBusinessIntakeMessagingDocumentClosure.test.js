import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const buyerApi = read('services/gbsBuyerApi.js');
const providerApi = read('services/gbsProviderApi.js');
const requestForm = read('pages/BusinessClient/BusinessClientRequestForm.jsx');
const messages = read('components/gbs/GbsContextMessages.jsx');
const inbox = read('pages/Agent/business-services/GbsMessages.jsx');
const buyerCase = read('pages/BusinessClient/BusinessClientCaseDetail.jsx');
const providerCase = read('pages/Agent/business-services/GbsCaseDetail.jsx');

assert.match(buyerApi, /business\/private-beta\/services/);
assert.match(buyerApi, /business\/private-beta\/requests/);
assert.match(requestForm, /channel.*private-beta/);
assert.match(requestForm, /createPrivateBetaRequest/);
assert.match(requestForm, /Provider-issued private service link/);
assert.match(messages, /Business \$\{contextType\} conversation/);
assert.match(messages, /Load older messages/);
assert.match(messages, /maxLength=\{4000\}/);
assert.match(messages, /Send message/);
assert.doesNotMatch(messages, /dangerouslySetInnerHTML/);
assert.match(providerApi, /listMessageThreads/);
assert.match(inbox, /Request, Quote, or Case/);
assert.doesNotMatch(inbox, /not configured for this workflow yet/);
for (const file of [buyerCase, providerCase]) {
  assert.match(file, /Secure Business document exchange is not available in this private beta\./);
  assert.match(file, /security\?\.uploadEnabled/);
}

console.log('prelaunchBusinessIntakeMessagingDocumentClosure.test.js: 17 assertions passed');
