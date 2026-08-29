/**
 * MKT-P5 — physical index provisioning on local Mongo.
 * Run:
 *   set MKT_P5_INTEGRATION_TEST=1
 *   node server/src/__tests__/mktP5OfferIndexes.mongo.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { resolveMongoTarget } from '../utils/mongoTargetGuard.js';
import {
  provisionMktP5OfferIndexes,
  verifyMktP5OfferIndexes,
} from '../services/platform/mktP5OfferIndexProvision.js';

const TEST_DB = 'edurozgaar_mkt_p5_offer_indexes';

async function main() {
  if (process.env.MKT_P5_INTEGRATION_TEST !== '1') {
    console.log('mktP5OfferIndexes.mongo: skipped (set MKT_P5_INTEGRATION_TEST=1)');
    return;
  }

  const uri = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
  if (!resolveMongoTarget(uri).isLocalDevelopmentTarget) {
    console.error('refused — non-local Mongo');
    process.exit(1);
  }

  let count = 0;
  const check = (c, m) => {
    assert.ok(c, m);
    count += 1;
  };

  await mongoose.connect(uri, { autoIndex: false });
  try {
    await mongoose.connection.db.dropDatabase();

    let report = await verifyMktP5OfferIndexes();
    check(!report.ok, 'IDX-P5-01: indexes missing before provision');

    await provisionMktP5OfferIndexes();
    report = await verifyMktP5OfferIndexes();
    check(report.ok, 'IDX-P5-02: indexes ready after provision');
    check(report.offers.matched.length === 3, 'IDX-P5-03: three critical indexes present');

    await provisionMktP5OfferIndexes();
    report = await verifyMktP5OfferIndexes();
    check(report.ok, 'IDX-P5-04: second provision idempotent');

    console.log(`mktP5OfferIndexes.mongo: ${count} passed`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
