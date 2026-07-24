/**
 * Phase-4 full seed: 50 jobs, 30 scholarships, 20 admissions, 20 blogs, 10 foreign studies, 10 notifications.
 * Run: node src/scripts/seedPhase4.js (from server dir)
 * Uses SEED_FORCE=1 to drop and reseed; otherwise skips non-empty collections.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { Blog } from '../models/Blog.js';
import { ForeignStudy } from '../models/ForeignStudy.js';
import { Notification } from '../models/Notification.js';
import { jobSlug, scholarshipSlug, admissionSlug, blogSlug, foreignStudySlug } from '../utils/slugify.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/edurozgaar';
const FORCE = process.env.SEED_FORCE === '1';

const now = () => new Date();
const days = (n) => new Date(Date.now() + n * 86400000);

const JOB_TEMPLATES = [
  { title: 'Software Engineer', company: 'TechCorp Pakistan', province: 'Punjab', category: 'Software', type: 'full-time' },
  { title: 'Data Analyst', company: 'DataHub Ltd', province: 'Punjab', category: 'Data Science', type: 'full-time' },
  { title: 'Marketing Intern', company: 'GrowthPak', province: 'Sindh', category: 'Marketing', type: 'internship' },
  { title: 'Frontend Developer', company: 'WebSolutions PK', province: 'Sindh', category: 'Software', type: 'full-time' },
  { title: 'Content Writer', company: 'EduMedia', province: 'Punjab', category: 'Content', type: 'part-time' },
  { title: 'HR Coordinator', company: 'PeopleFirst', province: 'Sindh', category: 'HR', type: 'full-time' },
  { title: 'Backend Developer', company: 'API Labs', province: 'Sindh', category: 'Software', type: 'full-time' },
  { title: 'Graphic Designer', company: 'Creative Studio', province: 'Punjab', category: 'Design', type: 'contract' },
  { title: 'Accountant', company: 'FinancePro', province: 'Sindh', category: 'Finance', type: 'full-time' },
  { title: 'Teaching Assistant', company: 'EduPak University', province: 'Punjab', category: 'Education', type: 'part-time' },
];
const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Islamabad'];
const CATEGORIES = ['Software', 'Data Science', 'Marketing', 'HR', 'Design', 'Finance', 'Education', 'Sales', 'Support', 'Research'];

function buildJobs() {
  const jobs = [];
  for (let i = 0; i < 50; i++) {
    const t = JOB_TEMPLATES[i % JOB_TEMPLATES.length];
    const province = PROVINCES[i % PROVINCES.length];
    const category = CATEGORIES[i % CATEGORIES.length];
    jobs.push({
      title: `${t.title}${i > 9 ? ` (${i})` : ''}`,
      company: t.company,
      province,
      category,
      type: t.type,
      deadline: days(15 + (i % 45)),
      description: `Role description for ${t.title}.`,
      requirements: ['Relevant degree', 'Good communication'],
      applicationInstructions: 'Apply via email or portal.',
      status: 'active',
      logoUrl: '/job-logo-fallback.svg',
    });
  }
  return jobs;
}

const SCHOLARSHIP_TEMPLATES = [
  { title: 'HEC Need-Based Scholarship', provider: 'HEC', level: 'Undergraduate', country: 'Pakistan' },
  { title: 'PEEF Scholarship', provider: 'PEEF', level: 'Undergraduate', country: 'Pakistan' },
  { title: 'PM Youth Program', provider: 'PMYP', level: 'Graduate', country: 'Pakistan' },
  { title: 'USAID Merit Scholarship', provider: 'USAID', level: 'Undergraduate', country: 'Pakistan' },
  { title: 'British Council Great Scholarship', provider: 'British Council', level: 'Graduate', country: 'UK' },
  { title: 'Australian Awards', provider: 'DFAT Australia', level: 'Graduate', country: 'Australia' },
  { title: 'Chevening Scholarship', provider: 'UK FCDO', level: 'Graduate', country: 'UK' },
  { title: 'Fulbright Program', provider: 'USEFP', level: 'Graduate', country: 'USA' },
  { title: 'LUMS Merit Scholarship', provider: 'LUMS', level: 'Undergraduate', country: 'Pakistan' },
  { title: 'PhD Research Grant', provider: 'HEC', level: 'PhD', country: 'Pakistan' },
];

function buildScholarships() {
  const list = [];
  for (let i = 0; i < 30; i++) {
    const t = SCHOLARSHIP_TEMPLATES[i % SCHOLARSHIP_TEMPLATES.length];
    list.push({
      title: `${t.title} ${2024 + (i % 2)}`,
      provider: t.provider,
      level: t.level,
      country: t.country,
      amount: i % 3 === 0 ? 'Full tuition' : 'Partial coverage',
      deadline: days(30 + (i % 90)),
      description: 'Eligibility and benefits apply.',
      eligibility: ['Pakistani national', 'Merit/Need based'],
      applicationInstructions: 'Apply online.',
      status: 'active',
      logoUrl: '/placeholder-scholarship.svg',
    });
  }
  return list;
}

const ADMISSION_TEMPLATES = [
  { program: 'BS Computer Science', institution: 'FAST University', department: 'CS' },
  { program: 'MBA', institution: 'LUMS', department: 'Business' },
  { program: 'BBA', institution: 'IBA Karachi', department: 'Business' },
  { program: 'MBBS', institution: 'King Edward Medical University', department: 'Medicine' },
  { program: 'MS Data Science', institution: 'NUST', department: 'SEECS' },
  { program: 'BS Electrical Engineering', institution: 'UET Lahore', department: 'EE' },
  { program: 'LLB', institution: 'University of Punjab', department: 'Law' },
  { program: 'BArch', institution: 'NCA Lahore', department: 'Architecture' },
  { program: 'MPhil Economics', institution: 'PIDE', department: 'Economics' },
  { program: 'BS Software Engineering', institution: 'COMSATS', department: 'CS' },
];

function buildAdmissions() {
  const list = [];
  for (let i = 0; i < 20; i++) {
    const t = ADMISSION_TEMPLATES[i % ADMISSION_TEMPLATES.length];
    list.push({
      program: t.program,
      institution: t.institution,
      department: t.department,
      province: PROVINCES[i % PROVINCES.length],
      session: 'Fall 2024',
      deadline: days(20 + (i % 40)),
      description: 'Admission requirements and process.',
      eligibility: ['Relevant qualification', 'Entry test'],
      applicationInstructions: 'Apply at institution portal.',
      status: 'active',
      logoUrl: '/placeholder-admission.svg',
    });
  }
  return list;
}

const BLOG_TEMPLATES = [
  { title: 'How to Prepare for University Admissions in Pakistan', category: 'Admissions', tags: ['admissions', 'university', 'pakistan'] },
  { title: 'Top Scholarships for Pakistani Students 2024', category: 'Scholarships', tags: ['scholarships', 'hec', 'funding'] },
  { title: 'Career Tips for Fresh Graduates', category: 'Careers', tags: ['career', 'jobs', 'graduates'] },
  { title: 'Study Abroad: UK vs Australia', category: 'Foreign Studies', tags: ['study-abroad', 'uk', 'australia'] },
  { title: 'Freelancing While Studying', category: 'Careers', tags: ['freelancing', 'students', 'income'] },
  { title: 'Writing a Winning Scholarship Essay', category: 'Scholarships', tags: ['scholarship', 'essay', 'tips'] },
  { title: 'Best Engineering Universities in Pakistan', category: 'Admissions', tags: ['engineering', 'universities', 'pakistan'] },
  { title: 'Understanding MDCAT and Medical Admissions', category: 'Admissions', tags: ['mdcat', 'medical', 'mbbs'] },
  { title: 'Remote Work Opportunities for Students', category: 'Jobs', tags: ['remote', 'jobs', 'students'] },
  { title: 'HEC Recognized Universities List', category: 'Education', tags: ['hec', 'universities', 'recognition'] },
];

function buildBlogs() {
  const list = [];
  for (let i = 0; i < 20; i++) {
    const t = BLOG_TEMPLATES[i % BLOG_TEMPLATES.length];
    const title = i < 10 ? t.title : `${t.title} – Part ${i - 9}`;
    list.push({
      title,
      excerpt: `Summary of ${title}.`,
      content: `Full content for ${title}. This article covers key points for students.`,
      tags: t.tags,
      category: t.category,
      views: Math.floor(Math.random() * 500),
      status: 'published',
      publishedAt: new Date(Date.now() - (i % 30) * 86400000),
      imageUrl: '/placeholder-blog.svg',
    });
  }
  return list;
}

const FS_TEMPLATES = [
  { country: 'UK', program: 'Master\'s in Business', level: 'Graduate' },
  { country: 'USA', program: 'PhD in Engineering', level: 'PhD' },
  { country: 'Australia', program: 'Undergraduate Degree', level: 'Undergraduate' },
  { country: 'Germany', program: 'Master\'s in CS', level: 'Graduate' },
  { country: 'Canada', program: 'MBA', level: 'Graduate' },
  { country: 'UK', program: 'LLB', level: 'Undergraduate' },
  { country: 'Malaysia', program: 'Medical Program', level: 'Undergraduate' },
  { country: 'China', program: 'Engineering Exchange', level: 'Short Course' },
  { country: 'Turkey', program: 'Scholarship Program', level: 'Graduate' },
  { country: 'USA', program: 'Fulbright Research', level: 'PhD' },
];

function buildForeignStudies() {
  return FS_TEMPLATES.map((t, i) => ({
    ...t,
    slug: foreignStudySlug(t.country, t.program) + (i > 0 ? `-${i}` : ''),
    institution: `${t.country} University`,
    requirements: ['English proficiency', 'Relevant degree'],
    deadline: days(60 + i * 10),
    description: `Study ${t.program} in ${t.country}.`,
    link: 'https://example.com/apply',
    status: 'active',
    imageUrl: '/placeholder-fs.svg',
  }));
}

const NOTIFICATIONS = [
  { title: 'New jobs in Punjab', message: '10 new jobs matching your interests in Punjab.', target_province: 'Punjab', target_interest: 'Software', delivered: false },
  { title: 'Scholarship deadline reminder', message: 'HEC Need-Based Scholarship closes in 7 days.', target_province: null, target_interest: 'Scholarships', delivered: true },
  { title: 'Admissions open', message: 'FAST University Fall 2024 admissions are open.', target_province: 'Sindh', target_interest: 'Admissions', delivered: false },
  { title: 'Study abroad fair', message: 'Virtual study abroad fair this weekend.', target_province: null, target_interest: 'Foreign Studies', delivered: false },
  { title: 'Jobs in Karachi', message: 'New IT jobs in Karachi.', target_province: 'Sindh', target_interest: 'Software', delivered: true },
  { title: 'PEEF scholarship update', message: 'PEEF has extended the deadline.', target_province: 'Punjab', target_interest: 'Scholarships', delivered: false },
  { title: 'LUMS admissions', message: 'LUMS MBA applications now open.', target_province: null, target_interest: 'Admissions', delivered: false },
  { title: 'UK scholarship alert', message: 'Chevening 2024 application window open.', target_province: null, target_interest: 'Foreign Studies', delivered: true },
  { title: 'Internships in Islamabad', message: 'Tech internships in Islamabad.', target_province: 'Islamabad', target_interest: 'Software', delivered: false },
  { title: 'System maintenance', message: 'EduRozgaar will be under maintenance tonight.', target_province: null, target_interest: null, delivered: true },
];

async function seed() {
  await mongoose.connect(MONGO_URI);

  if (FORCE) {
    await Job.deleteMany({});
    await Scholarship.deleteMany({});
    await Admission.deleteMany({});
    await Blog.deleteMany({});
    await ForeignStudy.deleteMany({});
    await Notification.deleteMany({});
    console.log('Cleared collections (SEED_FORCE=1).');
  }

  if (FORCE || (await Job.countDocuments()) === 0) {
    const jobs = buildJobs();
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      await Job.create({ ...j, slug: jobSlug(j.title, j.province || '') + (i > 0 ? `-${i}` : '') });
    }
    console.log('Seeded', jobs.length, 'jobs');
  }

  if (FORCE || (await Scholarship.countDocuments()) === 0) {
    const scholarships = buildScholarships();
    for (let i = 0; i < scholarships.length; i++) {
      const s = scholarships[i];
      await Scholarship.create({ ...s, slug: scholarshipSlug(s.title, s.country || '') + (i > 0 ? `-${i}` : '') });
    }
    console.log('Seeded', scholarships.length, 'scholarships');
  }

  if (FORCE || (await Admission.countDocuments()) === 0) {
    const admissions = buildAdmissions();
    for (let i = 0; i < admissions.length; i++) {
      const a = admissions[i];
      await Admission.create({ ...a, slug: admissionSlug(a.program, a.institution) + (i > 0 ? `-${i}` : '') });
    }
    console.log('Seeded', admissions.length, 'admissions');
  }

  if (FORCE || (await Blog.countDocuments()) === 0) {
    const blogs = buildBlogs();
    for (let i = 0; i < blogs.length; i++) {
      const b = blogs[i];
      await Blog.create({ ...b, slug: blogSlug(b.title) + (i > 0 ? `-${i}` : '') });
    }
    console.log('Seeded', blogs.length, 'blogs');
  }

  if (FORCE || (await ForeignStudy.countDocuments()) === 0) {
    const fs = buildForeignStudies();
    for (const f of fs) {
      await ForeignStudy.create(f);
    }
    console.log('Seeded', fs.length, 'foreign studies');
  }

  if (FORCE || (await Notification.countDocuments()) === 0) {
    await Notification.insertMany(NOTIFICATIONS);
    console.log('Seeded', NOTIFICATIONS.length, 'notifications');
  }

  await mongoose.disconnect();
  console.log('Phase-4 seed done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
