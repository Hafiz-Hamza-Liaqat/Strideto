import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../../components/seo';
import { examsApi } from '../../services/listingsService';
import { ROUTES } from '../../constants';

export default function ExamDetail() {
  const { t } = useTranslation(['exams', 'navbar']);
  const { slug } = useParams();
  const [exam, setExam] = useState(null);
  const [papers, setPapers] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      examsApi.getExam(slug).then((r) => r.data),
      examsApi.listPastPapers(slug).then((r) => r.data?.data || []),
      examsApi.listQuizzes(slug).then((r) => r.data?.data || []),
    ])
      .then(([ex, p, q]) => {
        setExam(ex);
        setPapers(p);
        setQuizzes(q);
      })
      .catch(() => setExam(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-4" />
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }
  if (!exam) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-600 dark:text-red-400">{t('exams:examNotFound')}</p>
        <Link to={ROUTES.EXAM_PREP} className="text-primary dark:text-mint mt-2 inline-block">{t('exams:backToExamPrep')}</Link>
      </div>
    );
  }

  const canonicalPath = `${ROUTES.EXAM_PREP}/${exam.slug || slug}`;
  const description = exam.description || t('exams:examDescriptionFallback', { name: exam.name });

  return (
    <>
      <SeoHead
        title={`${exam.name} ${t('exams:examPrepSuffix')}`}
        description={description}
        canonical={canonicalPath}
        noindex
      />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={ROUTES.EXAM_PREP} className="text-sm text-primary dark:text-mint hover:underline mb-4 inline-block">
          ← {t('exams:examPrepBreadcrumb')}
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{exam.name}</h1>
        {exam.description && <p className="text-gray-600 dark:text-gray-400 mb-6">{exam.description}</p>}

        {exam.syllabus && (
          <section className="mb-8 p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('exams:syllabus')}</h2>
            <div className="prose dark:prose-invert text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm">{exam.syllabus}</div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('exams:pastPapersTitle')}</h2>
          {papers.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('exams:noPastPapers')}</p>
          ) : (
            <ul className="space-y-2">
              {papers.map((p) => (
                <li key={p._id}>
                  <a
                    href={p.link || p.fileUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{p.title}</span>
                    {p.year && <span className="text-gray-500 dark:text-gray-400 ml-2">({p.year})</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('exams:practiceQuizzes')}</h2>
          {quizzes.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('exams:noQuizzes')}</p>
          ) : (
            <ul className="space-y-2">
              {quizzes.map((q) => (
                <li key={q._id}>
                  <Link
                    to={ROUTES.QUIZ_TAKE.replace(':quizId', q._id)}
                    className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{q.title}</span>
                    {q.durationMinutes && (
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        · {q.durationMinutes} {t('exams:minutesShort')}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
