/**
 * Seed jobs, scholarships, admissions for Phase-3.
 * Run from server: npm run seed:listings
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Scholarship } from '../models/Scholarship.js';
import { Admission } from '../models/Admission.js';
import { jobSlug, scholarshipSlug, admissionSlug } from '../utils/slugify.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/edurozgaar';

const JOBS = [
  { title: 'Software Engineer', company: 'TechCorp Pakistan', province: 'Punjab', category: 'Software', type: 'full-time', deadline: new Date(Date.now() + 30 * 86400000), description: 'Build scalable web applications.', requirements: ['BS CS', '2+ years'], applicationInstructions: 'Apply via email.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Data Analyst', company: 'DataHub Ltd', province: 'Punjab', category: 'Data Science', type: 'full-time', deadline: new Date(Date.now() + 25 * 86400000), description: 'Analyze and visualize data.', requirements: ['Excel', 'SQL'], applicationInstructions: 'Apply online.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Marketing Intern', company: 'GrowthPak', province: 'Sindh', category: 'Marketing', type: 'internship', deadline: new Date(Date.now() + 14 * 86400000), description: 'Support marketing campaigns.', applicationInstructions: 'Send CV.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Frontend Developer', company: 'WebSolutions PK', province: 'Sindh', category: 'Software', type: 'full-time', deadline: new Date(Date.now() + 45 * 86400000), description: 'React and modern frontend.', requirements: ['React', 'TypeScript'], applicationInstructions: 'Apply via portal.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Content Writer', company: 'EduMedia', province: 'Punjab', category: 'Content', type: 'part-time', deadline: new Date(Date.now() + 20 * 86400000), description: 'Write education content.', applicationInstructions: 'Submit samples.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'HR Coordinator', company: 'PeopleFirst', province: 'Sindh', category: 'HR', type: 'full-time', deadline: new Date(Date.now() + 30 * 86400000), description: 'Recruitment and onboarding.', applicationInstructions: 'Apply online.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Backend Developer', company: 'API Labs', province: 'Sindh', category: 'Software', type: 'full-time', deadline: new Date(Date.now() + 35 * 86400000), description: 'Node.js and MongoDB.', requirements: ['Node', 'MongoDB'], applicationInstructions: 'GitHub link required.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Graphic Designer', company: 'Creative Studio', province: 'Punjab', category: 'Design', type: 'contract', deadline: new Date(Date.now() + 21 * 86400000), description: 'Brand and social assets.', applicationInstructions: 'Portfolio link.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Accountant', company: 'FinancePro', province: 'Sindh', category: 'Finance', type: 'full-time', deadline: new Date(Date.now() + 40 * 86400000), description: 'Financial reporting.', requirements: ['ACCA/CA'], applicationInstructions: 'Apply via email.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Teaching Assistant', company: 'EduPak University', province: 'Punjab', category: 'Education', type: 'part-time', deadline: new Date(Date.now() + 15 * 86400000), description: 'Support undergraduate courses.', applicationInstructions: 'Apply to department.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'DevOps Engineer', company: 'CloudPak', province: 'Sindh', category: 'Software', type: 'full-time', deadline: new Date(Date.now() + 28 * 86400000), description: 'CI/CD and cloud infrastructure.', requirements: ['AWS', 'Docker'], applicationInstructions: 'Apply online.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Sales Executive', company: 'SalesForce PK', province: 'Punjab', category: 'Sales', type: 'full-time', deadline: new Date(Date.now() + 18 * 86400000), description: 'B2B sales and client relations.', applicationInstructions: 'Send CV to HR.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Research Associate', company: 'Research Institute', province: 'Sindh', category: 'Research', type: 'full-time', deadline: new Date(Date.now() + 60 * 86400000), description: 'Academic research support.', applicationInstructions: 'Apply with publication list.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Customer Support', company: 'SupportHub', province: 'Punjab', category: 'Support', type: 'full-time', deadline: new Date(Date.now() + 10 * 86400000), description: 'Handle customer queries.', applicationInstructions: 'Apply via portal.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Product Manager', company: 'ProductLabs', province: 'Sindh', category: 'Product', type: 'full-time', deadline: new Date(Date.now() + 42 * 86400000), description: 'Own product roadmap.', requirements: ['3+ years PM'], applicationInstructions: 'Apply online.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'UI/UX Designer', company: 'DesignCo', province: 'Punjab', category: 'Design', type: 'full-time', deadline: new Date(Date.now() + 22 * 86400000), description: 'Design user interfaces.', applicationInstructions: 'Portfolio required.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Business Analyst', company: 'Analytics Pro', province: 'Sindh', category: 'Business', type: 'full-time', deadline: new Date(Date.now() + 33 * 86400000), description: 'Requirements and process analysis.', applicationInstructions: 'Apply via email.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Network Engineer', company: 'NetSolutions', province: 'Punjab', category: 'IT', type: 'full-time', deadline: new Date(Date.now() + 26 * 86400000), description: 'Maintain network infrastructure.', applicationInstructions: 'Apply online.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Social Media Manager', company: 'SocialBuzz', province: 'Sindh', category: 'Marketing', type: 'full-time', deadline: new Date(Date.now() + 19 * 86400000), description: 'Manage social channels.', applicationInstructions: 'Submit portfolio.', logoUrl: '/job-logo-fallback.svg' },
  { title: 'Quality Assurance', company: 'QALabs', province: 'Punjab', category: 'Software', type: 'full-time', deadline: new Date(Date.now() + 24 * 86400000), description: 'Manual and automated testing.', applicationInstructions: 'Apply via portal.', logoUrl: '/job-logo-fallback.svg' },
];

const SCHOLARSHIPS = [
  { title: 'HEC Need-Based Scholarship 2024', provider: 'HEC', level: 'Undergraduate', country: 'Pakistan', amount: 'Full tuition', deadline: new Date(Date.now() + 60 * 86400000), description: 'For deserving students.', eligibility: ['Pakistani national', 'Need-based'], applicationInstructions: 'Apply at HEC portal.', logoUrl: '/placeholder-scholarship.svg' },
  { title: 'PEEF Scholarship Program', provider: 'PEEF', level: 'Undergraduate', country: 'Pakistan', amount: 'PKR 50,000/year', deadline: new Date(Date.now() + 45 * 86400000), description: 'Punjab Education Endowment Fund.', eligibility: ['Punjab domicile'], applicationInstructions: 'Apply online.', logoUrl: '/placeholder-scholarship.svg' },
  { title: 'Prime Minister Youth Program', provider: 'PMYP', level: 'Graduate', country: 'Pakistan', amount: 'Stipend + fee', deadline: new Date(Date.now() + 30 * 86400000), description: 'Youth skill development.', eligibility: ['18-35 years'], applicationInstructions: 'Register on PMYP portal.', logoUrl: '/placeholder-scholarship.svg' },
  { title: 'USAID Merit Scholarship', provider: 'USAID', level: 'Undergraduate', country: 'Pakistan', amount: 'Full coverage', deadline: new Date(Date.now() + 90 * 86400000), description: 'Merit-based undergraduate.', eligibility: ['Merit', 'Financial need'], applicationInstructions: 'Apply via partner universities.', logoUrl: '/placeholder-scholarship.svg' },
  { title: 'British Council Great Scholarship', provider: 'British Council', level: 'Graduate', country: 'UK', amount: '£10,000', deadline: new Date(Date.now() + 120 * 86400000), description: 'For Pakistani students in UK.', eligibility: ['Pakistani', 'UK admission'], applicationInstructions: 'Apply on British Council site.', logoUrl: '/placeholder-scholarship.svg' },
  { title: 'Australian Awards Scholarships', provider: 'DFAT Australia', level: 'Graduate', country: 'Australia', amount: 'Full scholarship', deadline: new Date(Date.now() + 150 * 86400000), description: 'Master's in Australia.', eligibility: ['Pakistani', 'Work experience'], applicationInstructions: 'Online application.', logoUrl: '/placeholder-scholarship.svg' },
  { title: 'Chevening Scholarship', provider: 'UK FCDO', level: 'Graduate', country: 'UK', amount: 'Full coverage', deadline: new Date(Date.now() + 100 * 86400000), description: 'One-year Master\'s in UK.', eligibility: ['Leadership', '2 years work'], applicationInstructions: 'Apply at Chevening website.', logoUrl: '/placeholder-scholarship.svg' },
  { title: 'Fulbright Program', provider: 'USEFP', level: 'Graduate', country: 'USA', amount: 'Full funding', deadline: new Date(Date.now() + 80 * 86400000), description: 'Master\'s/PhD in USA.', eligibility: ['Pakistani', 'GRE'], applicationInstructions: 'USEFP portal.', logoUrl: '/placeholder-scholarship.svg' },
  { title: 'Undergraduate Merit Scholarship', provider: 'LUMS', level: 'Undergraduate', country: 'Pakistan', amount: 'Up to 100%', deadline: new Date(Date.now() + 40 * 86400000), description: 'Merit and need-based.', eligibility: ['Admission to LUMS'], applicationInstructions: 'Apply with admission.', logoUrl: '/placeholder-scholarship.svg' },
  { title: 'PhD Research Grant', provider: 'HEC', level: 'PhD', country: 'Pakistan', amount: 'Stipend + tuition', deadline: new Date(Date.now() + 70 * 86400000), description: 'PhD in Pakistani universities.', eligibility: ['MS/MPhil', 'GAT'], applicationInstructions: 'HEC portal.', logoUrl: '/placeholder-scholarship.svg' },
];

const ADMISSIONS = [
  { program: 'BS Computer Science', institution: 'FAST University', department: 'CS', session: 'Fall 2024', deadline: new Date(Date.now() + 25 * 86400000), description: 'Four-year undergraduate program.', eligibility: ['FSc/ICS', 'NTS'], applicationInstructions: 'Apply at FAST portal.', logoUrl: '/placeholder-admission.svg' },
  { program: 'MBA', institution: 'LUMS', department: 'Business', session: 'Fall 2024', deadline: new Date(Date.now() + 35 * 86400000), description: 'Master of Business Administration.', eligibility: ['16 years education', 'GMAT/GRE'], applicationInstructions: 'LUMS application portal.', logoUrl: '/placeholder-admission.svg' },
  { program: 'BBA', institution: 'IBA Karachi', department: 'Business', session: 'Fall 2024', deadline: new Date(Date.now() + 20 * 86400000), description: 'Bachelor of Business Administration.', eligibility: ['Intermediate', 'Admission test'], applicationInstructions: 'IBA admission portal.', logoUrl: '/placeholder-admission.svg' },
  { program: 'MBBS', institution: 'King Edward Medical University', department: 'Medicine', session: '2024', deadline: new Date(Date.now() + 50 * 86400000), description: 'Five-year medical program.', eligibility: ['FSc Pre-Med', 'MDCAT'], applicationInstructions: 'PMDC portal.', logoUrl: '/placeholder-admission.svg' },
  { program: 'MS Data Science', institution: 'NUST', department: 'SEECS', session: 'Fall 2024', deadline: new Date(Date.now() + 30 * 86400000), description: 'Master\'s in Data Science.', eligibility: ['BS CS/related', 'GAT'], applicationInstructions: 'NUST admission site.', logoUrl: '/placeholder-admission.svg' },
  { program: 'BS Electrical Engineering', institution: 'UET Lahore', department: 'EE', session: 'Fall 2024', deadline: new Date(Date.now() + 28 * 86400000), description: 'Four-year BSc Electrical.', eligibility: ['FSc Pre-Eng', 'ECAT'], applicationInstructions: 'UET admission portal.', logoUrl: '/placeholder-admission.svg' },
  { program: 'LLB', institution: 'University of Punjab', department: 'Law', session: 'Fall 2024', deadline: new Date(Date.now() + 22 * 86400000), description: 'Five-year law degree.', eligibility: ['Intermediate'], applicationInstructions: 'PU admission office.', logoUrl: '/placeholder-admission.svg' },
  { program: 'BArch', institution: 'NCA Lahore', department: 'Architecture', session: 'Fall 2024', deadline: new Date(Date.now() + 32 * 86400000), description: 'Five-year architecture program.', eligibility: ['FSc/FA', 'NCA test'], applicationInstructions: 'NCA application.', logoUrl: '/placeholder-admission.svg' },
  { program: 'MPhil Economics', institution: 'PIDE', department: 'Economics', session: 'Fall 2024', deadline: new Date(Date.now() + 45 * 86400000), description: 'MPhil in Economics.', eligibility: ['MA/BSc Economics'], applicationInstructions: 'PIDE website.', logoUrl: '/placeholder-admission.svg' },
  { program: 'BS Software Engineering', institution: 'COMSATS', department: 'CS', session: 'Fall 2024', deadline: new Date(Date.now() + 26 * 86400000), description: 'Four-year software engineering.', eligibility: ['FSc/ICS', 'NTS'], applicationInstructions: 'COMSATS admission.', logoUrl: '/placeholder-admission.svg' },
];

async function seed() {
  await mongoose.connect(MONGO_URI);

  const jobCount = await Job.countDocuments();
  if (jobCount === 0) {
    for (const j of JOBS) {
      const slug = jobSlug(j.title, j.province || j.location || '');
      await Job.create({ ...j, slug });
    }
    console.log('Created', JOBS.length, 'jobs');
  } else {
    console.log('Jobs already exist, skipping.');
  }

  const scholarshipCount = await Scholarship.countDocuments();
  if (scholarshipCount === 0) {
    for (const s of SCHOLARSHIPS) {
      const slug = scholarshipSlug(s.title, s.country || '');
      await Scholarship.create({ ...s, slug });
    }
    console.log('Created', SCHOLARSHIPS.length, 'scholarships');
  } else {
    console.log('Scholarships already exist, skipping.');
  }

  const admissionCount = await Admission.countDocuments();
  if (admissionCount === 0) {
    for (const a of ADMISSIONS) {
      const slug = admissionSlug(a.program, a.institution);
      await Admission.create({ ...a, slug });
    }
    console.log('Created', ADMISSIONS.length, 'admissions');
  } else {
    console.log('Admissions already exist, skipping.');
  }

  await mongoose.disconnect();
  console.log('Seed listings done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
