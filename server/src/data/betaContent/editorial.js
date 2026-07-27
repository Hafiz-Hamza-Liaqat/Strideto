import { BETA_SLUG_PREFIX } from './constants.js';
import { BLOG_CATEGORIES, CAREER_CATEGORIES } from './constants.js';

const AUTHOR = 'Strideto Editorial';
const REVIEWER = 'Strideto Content Team';
const now = () => new Date();

function blog(slugSuffix, title, category, excerpt, bodyParagraphs) {
  const publishedAt = now();
  return {
    slug: `${BETA_SLUG_PREFIX}blog-${slugSuffix}`,
    title,
    category,
    excerpt,
    content: bodyParagraphs.join('\n\n'),
    status: 'published',
    publishedAt,
    tags: ['strideto', 'beta', category.toLowerCase().replace(/\s+/g, '-')],
    authorNote: `Author: ${AUTHOR}. Reviewer: ${REVIEWER}. Published: ${publishedAt.toISOString().slice(0, 10)}.`,
  };
}

function career(slugSuffix, title, category, excerpt, bodyParagraphs) {
  const publishedAt = now();
  return {
    slug: `${BETA_SLUG_PREFIX}career-${slugSuffix}`,
    title,
    category,
    excerpt,
    content: bodyParagraphs.join('\n\n'),
    status: 'published',
    publishedAt,
    tags: ['strideto', 'career-guidance'],
    authorNote: `Author: ${AUTHOR}. Reviewer: ${REVIEWER}.`,
  };
}

export function buildEditorialContent() {
  const blogs = [
    blog(
      'jobs-checklist',
      'How to evaluate a job posting before you apply',
      'Jobs',
      'A practical checklist for students and graduates reviewing roles on Strideto.',
      [
        'Strideto lists opportunities from employers and official sources. Before you apply, confirm the organization name, application channel, and deadline on the employer or official portal.',
        'Avoid sharing CNIC copies, bank details, or upfront fees in chat or email. Legitimate employers use structured application flows or official government portals.',
        'Save roles you are considering and track applications in your Strideto dashboard so you do not miss follow-ups.',
      ]
    ),
    blog(
      'scholarships-timeline',
      'Building a scholarship application timeline',
      'Scholarships',
      'Plan transcripts, references, and deadlines without last-minute stress.',
      [
        'Start with the official program page linked from each listing. Note hard deadlines and required documents.',
        'Work backward four to six weeks for references and attestation. Keep scanned PDFs organized by program.',
        'Use Strideto saved scholarships to compare funding type and study level side by side.',
      ]
    ),
    blog(
      'admissions-documents',
      'Admission documents Pakistani students often need',
      'Admissions',
      'Transcripts, domicile, and test scores—what to prepare early.',
      [
        'Universities may require matric, intermediate, and entry test scores. Check the institution admission page for the intake you target.',
        'Some programs require online application fees—pay only on the official site linked from the listing.',
        'Strideto admission pages summarize programs; always verify details on the university portal before submitting.',
      ]
    ),
    blog(
      'career-first-role',
      'Your first role after graduation: realistic expectations',
      'Career',
      'How to balance learning, compensation, and growth in your first job.',
      [
        'First roles often emphasize learning and accountability over title. Look for mentorship and clear tasks.',
        'Compare offers using total learning value, not salary alone—especially for remote or hybrid roles.',
        'Keep your Strideto talent profile updated so employers and readiness tools reflect your latest skills.',
      ]
    ),
    blog(
      'exam-prep-plan',
      'A four-week exam prep plan that fits university life',
      'Exam Prep',
      'Short daily sessions beat cramming for PPSC-style multiple choice practice.',
      [
        'Block 45 minutes daily for one subject. Rotate English, quantitative, and general knowledge.',
        'Use official syllabi where available; Strideto exam prep modules supplement practice.',
        'Review incorrect answers the next day—spaced repetition improves retention.',
      ]
    ),
    blog(
      'study-abroad-basics',
      'Study abroad: start with official country portals',
      'Study Abroad',
      'Use government education sites before paying any agent.',
      [
        'Countries publish student visa and scholarship information on official domains. Strideto foreign study guides link to those sources.',
        'Compare intakes, language requirements, and proof-of-funds rules early.',
        'Never wire money to unverified contacts—use university payment portals only.',
      ]
    ),
    blog(
      'tech-portfolio',
      'Tech students: a minimal portfolio employers can skim in two minutes',
      'Technology',
      'Projects, GitHub, and a short README beat a long unstructured CV.',
      [
        'Highlight two projects with problem, stack, and outcome. Link live demos when possible.',
        'List skills you can demonstrate in interview—not every buzzword.',
        'Upload your resume to Strideto and keep experience entries aligned with your portfolio.',
      ]
    ),
    blog(
      'student-life-balance',
      'Balancing applications, exams, and wellbeing',
      'Student Life',
      'Sustainable habits during competitive admission and job seasons.',
      [
        'Batch similar tasks: one evening for applications, another for test practice.',
        'Share deadlines with a peer for accountability.',
        'Strideto notifications can remind you about saved opportunities—tune them in profile settings.',
      ]
    ),
  ];

  const careerArticles = [
    career(
      'path-stem',
      'STEM career paths in Pakistan: where to start',
      'Career Path',
      'Overview of engineering, computing, and health sciences entry routes.',
      [
        'STEM graduates often combine degree credentials with certifications and internships.',
        'Explore government and private sector timelines separately—application channels differ.',
        'Strideto career guidance articles are informational; verify requirements with employers.',
      ]
    ),
    career(
      'interview-star',
      'Answer behavioral interviews with a simple STAR outline',
      'Interview Tips',
      'Situation, Task, Action, Result—without memorizing scripts.',
      [
        'Pick three stories from university projects or internships before the interview.',
        'Quantify impact where honest: time saved, users helped, grade improvement.',
        'Practice aloud once; clarity matters more than perfect English.',
      ]
    ),
    career(
      'resume-one-page',
      'When a one-page resume is enough',
      'Resume',
      'Early-career candidates should prioritize clarity over length.',
      [
        'Lead with education and top projects if experience is limited.',
        'Use action verbs and measurable outcomes.',
        'Strideto resume builder templates are ATS-friendly—export PDF for applications.',
      ]
    ),
    career(
      'skills-communication',
      'Communication skills employers mention most',
      'Skills',
      'Writing, listening, and concise updates in hybrid teams.',
      [
        'Email etiquette: subject lines, polite requests, and clear next steps.',
        'In interviews, pause before answering complex questions.',
        'Assessments on Strideto can highlight communication strengths when enabled.',
      ]
    ),
    career(
      'networking-students',
      'Student networking without awkward cold messages',
      'Networking',
      'Alumni events, faculty introductions, and professional communities.',
      [
        'Ask specific questions after talks or webinars instead of generic connection requests.',
        'Follow up within 48 hours with thanks and one detail from the conversation.',
        'Strideto webinars list upcoming sessions—register for topics aligned with your goals.',
      ]
    ),
    career(
      'first-job-offers',
      'Comparing your first job offers fairly',
      'First Job',
      'Role, manager, learning budget, and location costs.',
      [
        'Calculate commute or internet costs for hybrid roles.',
        'Ask about probation, benefits, and training in writing when possible.',
        'Use Strideto application tracking to note where you are in each process.',
      ]
    ),
    career(
      'freelance-side',
      'Freelancing while studying: scope and contracts',
      'Freelancing',
      'Start small, document deliverables, and avoid unclear scope creep.',
      [
        'Use written agreements for timeline, revisions, and payment.',
        'Portfolio pieces from freelance work can strengthen your Strideto profile.',
        'Report suspicious clients via Strideto support.',
      ]
    ),
    career(
      'govt-jobs-overview',
      'Government jobs in Pakistan: common application channels',
      'Government Jobs',
      'PPSC, FPSC, and department portals—high-level orientation only.',
      [
        'Each commission publishes its own schedule and syllabus. Use official sites linked from Strideto when provided.',
        'Prepare documents early: domicile, CNIC, photographs per advertisement.',
        'This article is not legal advice; always read the latest advertisement PDF.',
      ]
    ),
  ];

  // Ensure category coverage
  const blogCats = new Set(blogs.map((b) => b.category));
  const careerCats = new Set(careerArticles.map((c) => c.category));
  for (const c of BLOG_CATEGORIES.slice(0, 4)) {
    if (!blogCats.has(c)) blogCats.add(c);
  }
  for (const c of CAREER_CATEGORIES.slice(0, 4)) {
    if (!careerCats.has(c)) careerCats.add(c);
  }

  return { blogs, careerArticles };
}
