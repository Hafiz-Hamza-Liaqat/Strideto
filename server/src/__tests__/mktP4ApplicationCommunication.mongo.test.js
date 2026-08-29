/**
 * MKT-P4 — Mongo integration: IDOR, idempotency, privacy, worker-stopped truth.
 * Run:
 *   set MKT_P4_INTEGRATION_TEST=1
 *   node server/src/__tests__/mktP4ApplicationCommunication.mongo.test.js
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { resolveMongoTarget } from '../utils/mongoTargetGuard.js';
import { Employer } from '../models/Employer.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Application } from '../models/Application.js';
import { ApplicationMessage } from '../models/ApplicationMessage.js';
import { ApplicationInterviewInvitation } from '../models/ApplicationInterviewInvitation.js';
import { OpportunityApplication } from '../models/career/OpportunityApplication.js';
import { UserNotification } from '../models/UserNotification.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { AuditLog } from '../models/AuditLog.js';
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { OpportunityApplicationService } from '../services/career/OpportunityApplicationService.js';
import { OpportunityApplicationRepository } from '../repositories/career/OpportunityApplicationRepository.js';
import { provisionMktP4CommunicationIndexes } from '../services/platform/mktP4CommunicationIndexProvision.js';
import { validateInterviewMeetingUrl } from '../utils/interviewMeetingUrl.js';
import {
  employerListCommunication,
  employerSendMessage,
  employerCreateInterviewInvitation,
  candidateListCommunication,
  candidateSendMessage,
  candidateRespondInterviewInvitation,
} from '../controllers/applicationCommunicationController.js';
import * as CommunicationService from '../services/applicationCommunicationService.js';

const TEST_DB = 'edurozgaar_mkt_p4_communication';

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

function employerReq(employerId, params = {}, body = {}, query = {}) {
  return {
    employer: { employerId: String(employerId) },
    params,
    body,
    query,
    headers: {},
    socket: {},
  };
}

function studentReq(userId, params = {}, body = {}, query = {}) {
  return {
    user: { userId: String(userId), role: 'User' },
    params,
    body,
    query,
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

function futureIso(daysAhead = 7) {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

async function main() {
  if (process.env.MKT_P4_INTEGRATION_TEST !== '1') {
    console.log('mktP4ApplicationCommunication.mongo: skipped (set MKT_P4_INTEGRATION_TEST=1)');
    return;
  }

  const uri = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
  const target = resolveMongoTarget(uri);
  if (!target.isLocalDevelopmentTarget) {
    console.error('mktP4ApplicationCommunication.mongo: refused — non-local Mongo target');
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

    const [employerA, employerB] = await Employer.create([
      {
        companyName: 'Employer A',
        email: `mktp4-a-${Date.now()}@example.test`,
        password: await bcrypt.hash('pass', 12),
      },
      {
        companyName: 'Employer B',
        email: `mktp4-b-${Date.now()}@example.test`,
        password: await bcrypt.hash('pass', 12),
      },
    ]);

    const [candidateA, candidateB] = await User.create([
      {
        name: 'Candidate A',
        email: `mktp4-ca-${Date.now()}@example.test`,
        password: await bcrypt.hash('pass', 12),
      },
      {
        name: 'Candidate B',
        email: `mktp4-cb-${Date.now()}@example.test`,
        password: await bcrypt.hash('pass', 12),
      },
    ]);

    const [jobA, jobB, externalJob] = await Job.create([
      {
        title: 'Internal Job A',
        slug: `mktp4-ja-${Date.now()}`,
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
        slug: `mktp4-jb-${Date.now()}`,
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
        slug: `mktp4-ext-${Date.now()}`,
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
      status: 'submitted',
    });
    const appB = await Application.create({
      userId: candidateB._id,
      jobId: jobB._id,
      status: 'submitted',
    });
    const appExternal = await Application.create({
      userId: candidateA._id,
      jobId: externalJob._id,
      status: 'submitted',
    });

    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(appA.toObject(), jobA.toObject());
    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(appB.toObject(), jobB.toObject());

    const oaA = await OpportunityApplication.findOne({ legacyApplicationId: appA._id }).lean();
    const oaB = await OpportunityApplication.findOne({ legacyApplicationId: appB._id }).lean();
    check(oaA && oaB, 'fixtures: dual-write OA links');

    await OpportunityApplicationRepository.pushNote(oaA._id, {
      body: 'Employer-only hiring note',
      visibility: 'employer_scoped',
      createdAt: new Date(),
      createdByActorType: 'employer',
      createdByActorId: String(employerA._id),
    });
    await OpportunityApplicationRepository.pushNote(oaA._id, {
      body: 'Candidate personal note',
      visibility: 'private',
      createdAt: new Date(),
      createdByActorType: 'talent',
      createdByActorId: String(candidateA._id),
    });

    const candidateView = await OpportunityApplicationService.getById(candidateA._id, oaA._id);
    check(
      !candidateView.notes.some((n) => n.visibility === 'employer_scoped'),
      'PRIV-02: candidate API excludes employer_scoped notes'
    );
    check(
      candidateView.notes.some((n) => n.body === 'Candidate personal note'),
      'PRIV-03: candidate private notes remain visible'
    );
    const rawOa = await OpportunityApplication.findById(oaA._id).lean();
    check(
      rawOa.notes.some((n) => n.body === 'Employer-only hiring note'),
      'PRIV-01: employer_scoped note remains in DB'
    );

    const xssBody = '<script>alert(1)</script>\n<img src=x onerror=alert(1)>';
    const sendA = await invoke(
      employerSendMessage,
      employerReq(employerA._id, { id: String(appA._id) }, { body: xssBody, clientMessageId: 'msg-xss-1' })
    );
    check(sendA.statusCode === 201, 'employer send message succeeds');
    const stored = await ApplicationMessage.findOne({ applicationId: appA._id }).lean();
    check(stored.body === xssBody.trim(), 'XSS: body stored verbatim as text');

    const listA = await invoke(
      employerListCommunication,
      employerReq(employerA._id, { id: String(appA._id) })
    );
    check(listA.statusCode === 200 && listA.body?.data?.messages?.length >= 1, 'Employer A reads own communication');

    const crossList = await invoke(
      employerListCommunication,
      employerReq(employerB._id, { id: String(appA._id) })
    );
    check(crossList.statusCode === 404, 'Employer B cannot read Employer A communication');

    const msgCountBeforeCross = await ApplicationMessage.countDocuments({ applicationId: appB._id });
    const crossSend = await invoke(
      employerSendMessage,
      employerReq(employerB._id, { id: String(appA._id) }, { body: 'cross attack' })
    );
    check(crossSend.statusCode === 404, 'Employer B cannot send to Application A');
    check(
      (await ApplicationMessage.countDocuments({ applicationId: appA._id })) === 1,
      'Employer B send did not create message on A'
    );
    check(
      (await ApplicationMessage.countDocuments({ applicationId: appB._id })) === msgCountBeforeCross,
      'Employer B state unchanged'
    );

    const dupId = 'idem-concurrent-1';
    const [r1, r2] = await Promise.all([
      CommunicationService.sendEmployerMessage(employerA._id, appA._id, {
        body: 'Concurrent one',
        clientMessageId: dupId,
      }),
      CommunicationService.sendEmployerMessage(employerA._id, appA._id, {
        body: 'Concurrent two',
        clientMessageId: dupId,
      }),
    ]);
    check(
      (await ApplicationMessage.countDocuments({ applicationId: appA._id, clientMessageId: dupId })) === 1,
      'IDX-03: concurrent same clientMessageId creates one row'
    );
    check(r1.duplicate !== r2.duplicate || r1.duplicate || r2.duplicate, 'idempotency: one path marked duplicate');

    await CommunicationService.sendEmployerMessage(employerA._id, appA._id, {
      body: 'Second distinct',
      clientMessageId: 'idem-distinct-2',
    });
    check(
      (await ApplicationMessage.countDocuments({ applicationId: appA._id, clientMessageId: { $ne: null } })) >= 2,
      'IDX-04: different clientMessageId creates additional message'
    );

    await CommunicationService.sendEmployerMessage(employerB._id, appB._id, {
      body: 'Same id different app',
      clientMessageId: dupId,
    });
    check(
      (await ApplicationMessage.countDocuments({ clientMessageId: dupId })) === 2,
      'IDX-05: same clientMessageId allowed on different applications'
    );

    const massSend = await invoke(
      employerSendMessage,
      employerReq(employerA._id, { id: String(appA._id) }, {
        body: 'ok',
        senderId: employerB._id,
        applicationStatus: 'hired',
      })
    );
    check(massSend.statusCode === 400, 'mass assignment rejected on employer message');

    const candidateList = await invoke(
      candidateListCommunication,
      studentReq(candidateA._id, { id: String(oaA._id) })
    );
    check(candidateList.statusCode === 200, 'Candidate A reads own communication');

    const crossCandidate = await invoke(
      candidateListCommunication,
      studentReq(candidateA._id, { id: String(oaB._id) })
    );
    check(crossCandidate.statusCode === 404, 'Candidate A cannot read Candidate B communication');

    const reply = await invoke(
      candidateSendMessage,
      studentReq(candidateA._id, { id: String(oaA._id) }, { body: 'Thanks for the update' })
    );
    check(reply.statusCode === 201, 'Candidate A reply persists');

    const employerOnCandidateRoute = await invoke(
      candidateSendMessage,
      employerReq(employerA._id, { id: String(oaA._id) }, { body: 'wrong role' })
    );
    check(employerOnCandidateRoute.statusCode === 404, 'employer cannot use candidate message route');

    const studentOnEmployerRoute = await invoke(
      employerSendMessage,
      studentReq(candidateA._id, { id: String(appA._id) }, { body: 'wrong role' })
    );
    check(studentOnEmployerRoute.statusCode === 404, 'student cannot use employer message route');

    const externalSend = await invoke(
      employerSendMessage,
      employerReq(employerA._id, { id: String(appExternal._id) }, { body: 'external' })
    );
    check(externalSend.statusCode === 404, 'external application message blocked');
    check(
      (await ApplicationMessage.countDocuments({ applicationId: appExternal._id })) === 0,
      'external application has no communication rows'
    );

    const karachiAt = futureIso(10);
    const inviteKarachi = await invoke(
      employerCreateInterviewInvitation,
      employerReq(employerA._id, { id: String(appA._id) }, {
        scheduledAt: karachiAt,
        timeZone: 'Asia/Karachi',
        method: 'video',
        meetingUrl: 'https://meet.example.test/karachi-room',
        employerNote: 'Bring ID',
      })
    );
    check(inviteKarachi.statusCode === 201, 'interview invite Asia/Karachi created');
    const invKarachi = inviteKarachi.body?.data?.invitation;
    check(invKarachi?.timeZone === 'Asia/Karachi', 'TZ E2E: Asia/Karachi stored');
    check(new Date(invKarachi.scheduledAt).toISOString() === karachiAt, 'TZ E2E: UTC instant stable');

    const dublinAt = futureIso(11);
    const inviteDublin = await invoke(
      employerCreateInterviewInvitation,
      employerReq(employerA._id, { id: String(appA._id) }, {
        scheduledAt: dublinAt,
        timeZone: 'Europe/Dublin',
        method: 'in_person',
        location: 'Dublin HQ',
      })
    );
    check(inviteDublin.statusCode === 201, 'interview invite Europe/Dublin created');
    check(inviteDublin.body?.data?.invitation?.timeZone === 'Europe/Dublin', 'TZ E2E: Europe/Dublin stored');

    const badTz = await invoke(
      employerCreateInterviewInvitation,
      employerReq(employerA._id, { id: String(appA._id) }, {
        scheduledAt: futureIso(12),
        timeZone: 'UTC+5',
        method: 'video',
        meetingUrl: 'https://meet.example.test/x',
      })
    );
    check(badTz.statusCode === 400, 'invalid timezone UTC+5 rejected');

    const pastInvite = await invoke(
      employerCreateInterviewInvitation,
      employerReq(employerA._id, { id: String(appA._id) }, {
        scheduledAt: new Date(Date.now() - 3600000).toISOString(),
        timeZone: 'Asia/Karachi',
        method: 'video',
        meetingUrl: 'https://meet.example.test/past',
      })
    );
    check(pastInvite.statusCode === 400, 'past datetime rejected');

    const prevProd = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    check(validateInterviewMeetingUrl('http://insecure.example/x').ok === false, 'prod rejects http meeting URL');
    check(validateInterviewMeetingUrl('javascript:alert(1)').ok === false, 'javascript URL rejected');
    check(validateInterviewMeetingUrl('https://meet.example.test/ok').ok === true, 'https accepted');
    process.env.NODE_ENV = prevProd;

    const activeInv = await ApplicationInterviewInvitation.findOne({
      applicationId: appA._id,
      status: { $in: ['pending', 'accepted'] },
      supersededBy: null,
    }).sort({ createdAt: -1 });
    check(activeInv, 'active invitation exists for RSVP');

    const accept = await invoke(
      candidateRespondInterviewInvitation,
      studentReq(candidateA._id, { id: String(oaA._id), invitationId: String(activeInv._id) }, { response: 'accepted' })
    );
    check(accept.statusCode === 200, 'candidate accept succeeds');
    check(accept.body?.data?.invitation?.status === 'accepted', 'invitation accepted');
    const appAfterAccept = await Application.findById(appA._id).lean();
    check(appAfterAccept.status === 'interview', 'accept keeps Application.status interview');
    check(appAfterAccept.status !== 'hired', 'accept does not hire');

    const invDeclineTarget = await ApplicationInterviewInvitation.create({
      applicationId: appB._id,
      scheduledAt: new Date(futureIso(14)),
      timeZone: 'Asia/Karachi',
      method: 'phone',
      status: 'pending',
      createdByEmployerId: employerB._id,
    });
    await invoke(
      candidateRespondInterviewInvitation,
      studentReq(candidateB._id, { id: String(oaB._id), invitationId: String(invDeclineTarget._id) }, {
        response: 'declined',
      })
    );
    const appBAfterDecline = await Application.findById(appB._id).lean();
    check(appBAfterDecline.status !== 'rejected', 'decline does not reject application');

    const crossAccept = await invoke(
      candidateRespondInterviewInvitation,
      studentReq(candidateA._id, { id: String(oaB._id), invitationId: String(invDeclineTarget._id) }, {
        response: 'accepted',
      })
    );
    check(crossAccept.statusCode === 404, 'candidate cannot RSVP on another application');

    const notifCount = await UserNotification.countDocuments({ userId: candidateA._id });
    check(notifCount >= 1, 'worker-stopped: in-app notifications persisted');

    const emailJobs = await BackgroundJob.find({ type: 'email' }).lean();
    check(emailJobs.length >= 1, 'worker-stopped: email jobs queued');
    check(emailJobs.every((j) => j.status === 'pending' || j.status === 'processing'), 'worker-stopped: no completed email jobs without worker');

    for (let i = 0; i < 52; i += 1) {
      await ApplicationMessage.create({
        applicationId: appB._id,
        senderRole: 'employer',
        senderId: employerB._id,
        messageType: 'message',
        body: `Pagination msg ${i}`,
        clientMessageId: `page-${i}`,
        createdAt: new Date(Date.now() + i * 1000),
      });
    }
    const page1 = await CommunicationService.listCommunication(appB._id, { page: 1, limit: 50 });
    const page2 = await CommunicationService.listCommunication(appB._id, { page: 2, limit: 50 });
    check(page1.messages.length === 50, 'pagination page 1 limit 50');
    check(page2.messages.length >= 1, 'pagination page 2 has remainder');
    const ids1 = new Set(page1.messages.map((m) => String(m._id)));
    check(page2.messages.every((m) => !ids1.has(String(m._id))), 'pagination no duplicate across pages');

    const audit = await AuditLog.findOne({ action: 'application.message.sent' }).lean();
    check(audit && !JSON.stringify(audit).includes(xssBody.slice(0, 20)), 'audit avoids full message body');

    console.log(`mktP4ApplicationCommunication.mongo.test.js: ${count} checks passed on ${mongoose.connection.db.databaseName}`);
  } finally {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
