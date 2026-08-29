/**
 * MKT-P5 — Mongo integration: offer IDOR, idempotency, status truth, worker-stopped.
 * Run:
 *   set MKT_P5_INTEGRATION_TEST=1
 *   node server/src/__tests__/mktP5ApplicationOffer.mongo.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { resolveMongoTarget } from '../utils/mongoTargetGuard.js';
import { Employer } from '../models/Employer.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Application } from '../models/Application.js';
import { ApplicationOffer } from '../models/ApplicationOffer.js';
import { OpportunityApplication } from '../models/career/OpportunityApplication.js';
import { UserNotification } from '../models/UserNotification.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { AuditLog } from '../models/AuditLog.js';
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { provisionMktP4CommunicationIndexes } from '../services/platform/mktP4CommunicationIndexProvision.js';
import { provisionMktP5OfferIndexes } from '../services/platform/mktP5OfferIndexProvision.js';
import * as OfferService from '../services/applicationOfferService.js';
import {
  employerSendOffer,
  employerWithdrawOffer,
  candidateRespondOffer,
} from '../controllers/applicationOfferController.js';
import { employerListCommunication } from '../controllers/applicationCommunicationController.js';

const TEST_DB = 'edurozgaar_mkt_p5_offer';

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function employerReq(employerId, params = {}, body = {}) {
  return {
    employer: { employerId: String(employerId) },
    params,
    body,
    query: {},
    headers: {},
    socket: {},
  };
}

function studentReq(userId, params = {}, body = {}) {
  return {
    user: { userId: String(userId), role: 'User' },
    params,
    body,
    query: {},
    headers: {},
    socket: {},
  };
}

async function invoke(handler, req) {
  const res = mockRes();
  try {
    await handler(req, res, (err) => {
      if (err) throw err;
    });
  } catch (err) {
    if (err?.status) {
      res.statusCode = err.status;
      res.body = { error: err.message };
      return res;
    }
    throw err;
  }
  return res;
}

async function main() {
  if (process.env.MKT_P5_INTEGRATION_TEST !== '1') {
    console.log('mktP5ApplicationOffer.mongo: skipped (set MKT_P5_INTEGRATION_TEST=1)');
    return;
  }

  const uri = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
  const target = resolveMongoTarget(uri);
  if (!target.isLocalDevelopmentTarget) {
    console.error('mktP5ApplicationOffer.mongo: refused — non-local Mongo target');
    process.exit(1);
  }

  let count = 0;
  const check = (cond, msg) => {
    assert.ok(cond, msg);
    count += 1;
  };

  await mongoose.connect(uri, { autoIndex: false });
  try {
    await mongoose.connection.db.dropDatabase();
    await provisionMktP4CommunicationIndexes();
    await provisionMktP5OfferIndexes();

    const [employerA, employerB] = await Employer.create([
      {
        companyName: 'Employer A',
        email: `mktp5-a-${Date.now()}@example.test`,
        password: await bcrypt.hash('pass', 12),
      },
      {
        companyName: 'Employer B',
        email: `mktp5-b-${Date.now()}@example.test`,
        password: await bcrypt.hash('pass', 12),
      },
    ]);

    const [candidateA, candidateB] = await User.create([
      {
        name: 'Candidate A',
        email: `mktp5-ca-${Date.now()}@example.test`,
        password: await bcrypt.hash('pass', 12),
      },
      {
        name: 'Candidate B',
        email: `mktp5-cb-${Date.now()}@example.test`,
        password: await bcrypt.hash('pass', 12),
      },
    ]);

    const [jobA, jobB, externalJob] = await Job.create([
      {
        title: 'Internal Job A',
        slug: `mktp5-ja-${Date.now()}`,
        company: 'Employer A',
        organization: 'Employer A',
        employerId: employerA._id,
        source: 'employer',
        status: 'active',
        approvalStatus: 'approved',
        applyType: 'internal',
      },
      {
        title: 'Internal Job B',
        slug: `mktp5-jb-${Date.now()}`,
        company: 'Employer B',
        organization: 'Employer B',
        employerId: employerB._id,
        source: 'employer',
        status: 'active',
        approvalStatus: 'approved',
        applyType: 'internal',
      },
      {
        title: 'External Job',
        slug: `mktp5-ext-${Date.now()}`,
        company: 'Employer A',
        organization: 'Employer A',
        employerId: employerA._id,
        source: 'employer',
        status: 'active',
        approvalStatus: 'approved',
        applyType: 'external',
        applicationLink: 'https://example.test/apply',
      },
    ]);

    const appA = await Application.create({
      userId: candidateA._id,
      jobId: jobA._id,
      status: 'interview',
    });
    const appB = await Application.create({
      userId: candidateB._id,
      jobId: jobB._id,
      status: 'interview',
    });
    await Application.create({
      userId: candidateA._id,
      jobId: externalJob._id,
      status: 'interview',
    });

    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(appA.toObject(), jobA.toObject());
    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(appB.toObject(), jobB.toObject());

    const oaA = await OpportunityApplication.findOne({ legacyApplicationId: appA._id }).lean();
    const oaB = await OpportunityApplication.findOne({ legacyApplicationId: appB._id }).lean();

    const sendRes = await invoke(
      employerSendOffer,
      employerReq(employerA._id, { id: String(appA._id) }, {
        compensationText: 'PKR 150,000/month',
        offerNote: 'Welcome aboard',
        clientCommandId: 'cmd-offer-1',
      })
    );
    check(sendRes.statusCode === 201, 'employer sends offer');
    const offerId = sendRes.body?.data?._id;
    check(offerId, 'offer id returned');
    check(sendRes.body?.sideEffects?.emailQueued === true, 'email job queued when worker stopped');

    const offerRow = await ApplicationOffer.findById(offerId).lean();
    check(offerRow?.status === 'sent', 'offer persisted as sent');

    const notif = await UserNotification.findOne({ 'metadata.offerId': String(offerId) }).lean();
    check(notif, 'candidate in-app notification created');

    const emailJob = await BackgroundJob.findOne({ dedupKey: `email:app-offer:${appA._id}:${offerId}` }).lean();
    check(emailJob?.status === 'pending', 'email job pending (worker stopped)');

    const dupRes = await invoke(
      employerSendOffer,
      employerReq(employerA._id, { id: String(appA._id) }, { clientCommandId: 'cmd-offer-1' })
    );
    check(dupRes.statusCode === 200 && dupRes.body?.duplicate === true, 'duplicate clientCommandId idempotent');
    check((await ApplicationOffer.countDocuments({ applicationId: appA._id })) === 1, 'no duplicate offer rows');

    const crossSend = await invoke(
      employerSendOffer,
      employerReq(employerB._id, { id: String(appA._id) }, { clientCommandId: 'cmd-cross' })
    );
    check(crossSend.statusCode === 404, 'Employer B cannot offer on Employer A application');

    const acceptRes = await invoke(
      candidateRespondOffer,
      studentReq(candidateA._id, { id: String(oaA._id), offerId: String(offerId) }, { response: 'accepted' })
    );
    check(acceptRes.statusCode === 200, 'candidate accepts own offer');
    check(acceptRes.body?.data?.offer?.status === 'accepted', 'offer status accepted');

    const appAfterAccept = await Application.findById(appA._id).lean();
    check(appAfterAccept.status === 'interview', 'accept does not auto-transition to hired');

    const oaAfterAccept = await OpportunityApplication.findById(oaA._id).lean();
    check(oaAfterAccept.pipelineStage === 'interview', 'hiringStage unchanged on accept');

    const crossAccept = await invoke(
      candidateRespondOffer,
      studentReq(candidateB._id, { id: String(oaA._id), offerId: String(offerId) }, { response: 'declined' })
    );
    check(crossAccept.statusCode === 404, 'Candidate B cannot respond to Candidate A offer');

    const sendB = await OfferService.sendApplicationOffer(employerB._id, appB._id, {
      clientCommandId: 'cmd-b-1',
    });
    const offerBId = sendB.offer._id;
    await OfferService.respondToApplicationOffer(candidateB._id, oaB._id, offerBId, { response: 'declined' });
    const appBAfter = await Application.findById(appB._id).lean();
    check(appBAfter.status !== 'rejected', 'decline does not auto-reject application');

    const send2 = await OfferService.sendApplicationOffer(employerA._id, appA._id, {
      clientCommandId: 'cmd-offer-2',
      compensationText: 'Revised terms',
    });
    check(send2.duplicate === false, 'replacement offer after terminal state');
    check((await ApplicationOffer.countDocuments({ applicationId: appA._id })) >= 2, 'offer history retained');

    const withdrawRes = await invoke(
      employerWithdrawOffer,
      employerReq(employerA._id, { id: String(appA._id), offerId: String(send2.offer._id) })
    );
    check(withdrawRes.statusCode === 200, 'employer withdraws sent offer');

    const comm = await invoke(
      employerListCommunication,
      employerReq(employerA._id, { id: String(appA._id) })
    );
    check(comm.body?.data?.activeOffer, 'communication includes activeOffer');
    const sysMsgs = (comm.body?.data?.messages || []).filter((m) => m.body?.includes('Offer'));
    check(sysMsgs.length >= 2, 'offer events in communication history');
    check(
      !sysMsgs.some((m) => m.body?.includes('PKR') || m.body?.includes('150,000')),
      'system events do not expose compensation'
    );

    const audit = await AuditLog.find({ action: { $in: ['offer.sent', 'offer.accepted', 'offer.withdrawn'] } }).lean();
    check(audit.length >= 2, 'audit records created');
    check(!audit.some((a) => a.metadata?.compensationText), 'audit avoids compensation text');

    console.log(`mktP5ApplicationOffer.mongo: ${count} passed`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
