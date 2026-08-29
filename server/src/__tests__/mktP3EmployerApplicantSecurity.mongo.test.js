/**
 * MKT-P3 — Employer applicant security & status consistency (local Mongo only).
 * Run:
 *   set MKT_P3_INTEGRATION_TEST=1
 *   node server/src/__tests__/mktP3EmployerApplicantSecurity.mongo.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { resolveMongoTarget } from '../utils/mongoTargetGuard.js';
import { Employer } from '../models/Employer.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { Application } from '../models/Application.js';
import { OpportunityApplication } from '../models/career/OpportunityApplication.js';
import {
  getApplicationDetail,
  updateApplicationStatus,
  getApplicationResume,
} from '../controllers/employerController.js';
import { mapLegacyApplicationStatus } from '../../../shared/career/migrationMap.js';
import { ApplicationMigrationService } from '../services/career/migration/ApplicationMigrationService.js';
import { resolveJobApplyType } from '../services/employerApplicationCounts.js';
import {
  uploadApplicationResumeFile,
  resolvePrivateApplicationFile,
  PRIVATE_APPLICATION_RESUME_DIR,
} from '../services/applicationResumeStorage.js';
import { PRIVATE_LOCAL_PREFIX } from '../../../shared/application/resumeStorageDescriptor.js';

const TEST_DB = 'edurozgaar_mkt_p3_applicant_security';

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    redirected: null,
    ended: false,
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  res.setHeader = (k, v) => {
    res.headers[k] = v;
    return res;
  };
  res.redirect = (code, url) => {
    res.statusCode = code;
    res.redirected = url;
    return res;
  };
  res.write = () => true;
  res.on = () => res;
  res.once = () => res;
  res.emit = () => false;
  res.end = () => {
    res.ended = true;
    return res;
  };
  return res;
}

function employerReq(employerId, params = {}, body = {}) {
  return {
    employer: { employerId: String(employerId) },
    params,
    body,
  };
}

async function invoke(handler, req) {
  const res = mockRes();
  await handler(req, res, (err) => {
    if (err) throw err;
  });
  return res;
}

async function main() {
  if (process.env.MKT_P3_INTEGRATION_TEST !== '1') {
    console.log('mktP3EmployerApplicantSecurity: skipped (set MKT_P3_INTEGRATION_TEST=1)');
    return;
  }

  const uri = process.env.MONGO_URI || `mongodb://127.0.0.1:27017/${TEST_DB}`;
  const target = resolveMongoTarget(uri);
  if (!target.isLocalDevelopmentTarget) {
    console.error('mktP3EmployerApplicantSecurity: refused — non-local Mongo target');
    process.exit(1);
  }

  let count = 0;
  const check = (cond, msg) => {
    assert.ok(cond, msg);
    count += 1;
  };

  await mongoose.connect(uri);
  try {
    await mongoose.connection.db.dropDatabase();

    const [employerA, employerB] = await Employer.create([
      {
        companyName: 'Employer A Co',
        email: `mktp3-a-${Date.now()}@example.test`,
        password: await bcrypt.hash('test-pass', 12),
      },
      {
        companyName: 'Employer B Co',
        email: `mktp3-b-${Date.now()}@example.test`,
        password: await bcrypt.hash('test-pass', 12),
      },
    ]);

    const [jobA, jobB, externalJob] = await Job.create([
      {
        title: 'Internal Role A',
        slug: `mktp3-a-${Date.now()}`,
        company: employerA.companyName,
        organization: employerA.companyName,
        employerId: employerA._id,
        source: 'employer',
        status: 'active',
        approvalStatus: 'approved',
        applyType: 'internal',
      },
      {
        title: 'Internal Role B',
        slug: `mktp3-b-${Date.now()}`,
        company: employerB.companyName,
        organization: employerB.companyName,
        employerId: employerB._id,
        source: 'employer',
        status: 'active',
        approvalStatus: 'approved',
        applyType: 'internal',
      },
      {
        title: 'External Role A',
        slug: `mktp3-ext-${Date.now()}`,
        company: employerA.companyName,
        organization: employerA.companyName,
        employerId: employerA._id,
        source: 'employer',
        status: 'active',
        approvalStatus: 'approved',
        applyType: 'external',
        applicationLink: 'https://example.test/apply',
      },
    ]);

    const user = await User.create({
      name: 'Applicant One',
      email: `mktp3-applicant-${Date.now()}@example.test`,
      password: await bcrypt.hash('user-pass', 12),
    });
    const user2 = await User.create({
      name: 'Applicant Two Private Resume',
      email: `mktp3-applicant2-${Date.now()}@example.test`,
      password: await bcrypt.hash('user-pass', 12),
    });
    const user3 = await User.create({
      name: 'Applicant Three No Resume',
      email: `mktp3-applicant3-${Date.now()}@example.test`,
      password: await bcrypt.hash('user-pass', 12),
    });

    const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const resumeName = `mktp3-resume-${Date.now()}.pdf`;
    const resumePath = path.join(uploadsDir, resumeName);
    await fs.writeFile(resumePath, '%PDF-1.4 mktp3 fixture');
    const resumeURL = `http://localhost:5000/uploads/${resumeName}`;

    const appA = await Application.create({
      userId: user._id,
      jobId: jobA._id,
      status: 'submitted',
      coverLetter: 'Cover letter fixture for MKT-P3.',
      resumeURL,
      resumeSource: 'upload',
    });

    const privateUpload = await uploadApplicationResumeFile({
      buffer: Buffer.from('%PDF-1.4 mktp3-private-mongo'),
      originalname: 'private-resume.pdf',
      mimetype: 'application/pdf',
    });
    const privateKey = privateUpload.resumeURL.slice(PRIVATE_LOCAL_PREFIX.length);
    const privatePath = resolvePrivateApplicationFile(privateKey);
    check(privatePath && privatePath.startsWith(PRIVATE_APPLICATION_RESUME_DIR), 'DOC-SEC-01: private resume outside public uploads');

    const appPrivate = await Application.create({
      userId: user2._id,
      jobId: jobA._id,
      status: 'submitted',
      resumeURL: privateUpload.resumeURL,
      resumeSource: 'upload',
    });

    await ApplicationMigrationService.dualWriteFromLegacyJobApplication(appA.toObject(), jobA.toObject());

    await Application.create({
      userId: user._id,
      jobId: jobB._id,
      status: 'submitted',
      resumeURL,
      resumeSource: 'upload',
    });

    const ownDetail = await invoke(
      getApplicationDetail,
      employerReq(employerA._id, { id: String(appA._id) })
    );
    check(ownDetail.statusCode === 200, 'SEC-01: own application detail allowed');
    check(ownDetail.body?.data?._id, 'SEC-01: detail returns application');
    check(!('resumeURL' in (ownDetail.body?.data || {})), 'SEC-09/DOC-03: detail JSON excludes resumeURL');
    check(ownDetail.body?.data?.hasResume === true, 'DOC-01: hasResume true when resume stored');
    check(ownDetail.body?.data?.coverLetter?.includes('Cover letter fixture'), 'UX-04: cover letter returned');

    const crossDetail = await invoke(
      getApplicationDetail,
      employerReq(employerB._id, { id: String(appA._id) })
    );
    check(crossDetail.statusCode === 404, 'SEC-02: cross-employer detail denied');

    const beforeStatus = (await Application.findById(appA._id)).status;
    const crossPatch = await invoke(
      updateApplicationStatus,
      employerReq(employerB._id, { id: String(appA._id) }, { status: 'rejected' })
    );
    check(crossPatch.statusCode === 404, 'SEC-03: cross-employer PATCH denied');
    check((await Application.findById(appA._id)).status === beforeStatus, 'SEC-03: status unchanged after cross PATCH');

    const massPatch = await invoke(
      updateApplicationStatus,
      employerReq(employerA._id, { id: String(appA._id) }, {
        status: 'shortlisted',
        coverLetter: 'Hacked cover letter',
        resumeURL: 'https://evil.test/resume.pdf',
      })
    );
    check(massPatch.statusCode === 400, 'SEC-08: mass assignment rejected');
    const afterMass = await Application.findById(appA._id).lean();
    check(afterMass.coverLetter.includes('Cover letter fixture'), 'SEC-08: cover letter unchanged');
    check(afterMass.resumeURL === resumeURL, 'SEC-08: resumeURL unchanged');

    const okPatch = await invoke(
      updateApplicationStatus,
      employerReq(employerA._id, { id: String(appA._id) }, { status: 'shortlisted' })
    );
    check(okPatch.statusCode === 200, 'STATUS-02: allowed transition succeeds');
    check(okPatch.body?.application?.status === 'shortlisted', 'STATUS-02: status persisted');
    check(
      okPatch.body?.hiringStage === mapLegacyApplicationStatus('shortlisted'),
      'STATUS-03: hiringStage consistent after update'
    );
    const oa = await OpportunityApplication.findOne({ legacyApplicationId: appA._id }).lean();
    check(oa?.pipelineStage === 'screening', 'STATUS-03: OpportunityApplication stage synced');

    const ownResume = await invoke(
      getApplicationResume,
      employerReq(employerA._id, { id: String(appA._id) })
    );
    check(ownResume.statusCode === 200, 'SEC-04/DOC-01: authorized resume access');
    check(ownResume.headers['Cache-Control'] === 'private, no-store', 'DOC-03: resume response not publicly cached');

    const crossResume = await invoke(
      getApplicationResume,
      employerReq(employerB._id, { id: String(appA._id) })
    );
    check(crossResume.statusCode === 404, 'SEC-04: cross-employer resume denied');

    const privateResume = await invoke(
      getApplicationResume,
      employerReq(employerA._id, { id: String(appPrivate._id) })
    );
    check(privateResume.statusCode === 200, 'DOC-SEC-02: private descriptor resume authorized');
    check(privateResume.headers['Cache-Control'] === 'private, no-store', 'DOC-SEC-09: private resume cache headers');
    check(!privateResume.redirected, 'DOC-SEC-10: no redirect to permanent public URL');

    const anonResume = await invoke(getApplicationResume, { params: { id: String(appPrivate._id) } });
    check(anonResume.statusCode === 404, 'DOC-SEC-04: anonymous resume denied');

    const studentResume = await invoke(getApplicationResume, {
      user: { _id: user._id, role: 'User' },
      params: { id: String(appPrivate._id) },
    });
    check(studentResume.statusCode === 404, 'DOC-SEC-05: student resume denied');

    const privateDetail = await invoke(
      getApplicationDetail,
      employerReq(employerA._id, { id: String(appPrivate._id) })
    );
    check(!('resumeURL' in (privateDetail.body?.data || {})), 'DOC-SEC-06: private app detail excludes resumeURL');
    check(privateDetail.body?.data?.hasResume === true, 'DOC-SEC-06: hasResume only in JSON');

    const missingResume = await invoke(
      getApplicationResume,
      employerReq(employerA._id, { id: String(appA._id) })
    );
    // appA has legacy resume - should work
    check(missingResume.statusCode === 200, 'DOC-SEC-11: legacy local resume via auth endpoint');

    const noResumeApp = await Application.create({
      userId: user3._id,
      jobId: jobA._id,
      status: 'submitted',
      resumeURL: null,
      resumeSource: 'none',
    });
    const noResumeRes = await invoke(
      getApplicationResume,
      employerReq(employerA._id, { id: String(noResumeApp._id) })
    );
    check(noResumeRes.statusCode === 404, 'DOC-SEC-08: missing resume 404');
    check(
      noResumeRes.body?.error?.includes('No resume'),
      'DOC-SEC-08: missing resume truthful message'
    );

    jobA.status = 'closed';
    await jobA.save();
    const closedDetail = await invoke(
      getApplicationDetail,
      employerReq(employerA._id, { id: String(appA._id) })
    );
    check(closedDetail.statusCode === 200, 'closed job application remains accessible');

    check(resolveJobApplyType(externalJob.toObject()) === 'external', 'external job apply type');

    const noop = await invoke(
      updateApplicationStatus,
      employerReq(employerA._id, { id: String(appA._id) }, { status: 'shortlisted' })
    );
    check(noop.statusCode === 200 && noop.body?.unchanged === true, 'STATUS-04: same-status no-op');

    console.log(`mktP3EmployerApplicantSecurity.mongo.test.js: ${count} checks passed on ${mongoose.connection.db.databaseName}`);
  } finally {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
