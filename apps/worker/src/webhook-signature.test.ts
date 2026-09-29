import test from 'node:test';
import assert from 'node:assert/strict';
import {signWebhook,verifyWebhook} from './webhook-signature.js';

test('webhook HMAC detects payload tampering',()=>{
  const signature=signWebhook('secret','123','{"ok":true}');
  assert.equal(verifyWebhook('secret','123','{"ok":true}',signature),true);
  assert.equal(verifyWebhook('secret','123','{"ok":false}',signature),false);
});
