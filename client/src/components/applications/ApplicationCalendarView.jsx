import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants';
import { applicationDisplayTitle, stageBadgeClass } from '../../utils/applicationUi';
import { getLanguageConfig } from '../../i18n/config';

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Only dates the model actually carries: appliedAt, interview.scheduledAt, reminder remindAt. */
function collectEvents(applications) {
  const events = [];
  for (const app of applications) {
    if (app.appliedAt) events.push({ date: new Date(app.appliedAt), kind: 'applied', app });
    if (app.interview?.scheduledAt) events.push({ date: new Date(app.interview.scheduledAt), kind: 'interview', app });
    for (const r of app.reminderReferences || []) {
      if (r.remindAt) events.push({ date: new Date(r.remindAt), kind: 'reminder', app });
    }
  }
  return events.filter((e) => !Number.isNaN(e.date.getTime()));
}

export function ApplicationCalendarView({ applications }) {
  const { t, i18n } = useTranslation(['applications']);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const locale = getLanguageConfig(i18n.language).locale || 'en-PK';
  const events = useMemo(() => collectEvents(applications), [applications]);
  const monthLabel = cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = new Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
    return cells;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      if (e.date.getFullYear() !== cursor.getFullYear() || e.date.getMonth() !== cursor.getMonth()) continue;
      const key = dayKey(e.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return map;
  }, [events, cursor]);

  const weekdayLabels = useMemo(() => {
    const base = new Date(2023, 0, 1); // a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          aria-label={t('applications:calendar.prevMonth', { defaultValue: 'Previous month' })}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ←
        </button>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white" aria-live="polite">{monthLabel}</h2>
        <button
          type="button"
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          aria-label={t('applications:calendar.nextMonth', { defaultValue: 'Next month' })}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 min-h-[44px] min-w-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          →
        </button>
      </div>

      {eventsByDay.size === 0 ? (
        <p className="text-center text-gray-600 dark:text-gray-400 py-8">
          {t('applications:calendar.empty', { defaultValue: 'No dated activity in this month.' })}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-[560px] text-xs text-gray-500 dark:text-gray-400 mb-1" role="row">
            {weekdayLabels.map((w) => (
              <div key={w} className="text-center py-1" role="columnheader">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 min-w-[560px]" role="grid" aria-label={monthLabel}>
            {grid.map((date, idx) => {
              if (!date) return <div key={`blank-${idx}`} className="min-h-[84px]" aria-hidden="true" />;
              const key = dayKey(date);
              const dayEvents = eventsByDay.get(key) || [];
              return (
                <div
                  key={key}
                  className="min-h-[84px] rounded-lg border border-gray-100 dark:border-gray-700 p-1 flex flex-col gap-1"
                  role="gridcell"
                  aria-label={date.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}
                >
                  <span className="text-xs text-gray-400 dark:text-gray-500">{date.getDate()}</span>
                  {dayEvents.map((e, i) => {
                    const title = applicationDisplayTitle(e.app, t);
                    const typeLabel = e.app.opportunityRef?.opportunityType
                      ? t(`applications:opportunityTypes.${e.app.opportunityRef.opportunityType}`, { defaultValue: e.app.opportunityRef.opportunityType })
                      : '';
                    const kindLabel = t(`applications:calendar.kinds.${e.kind}`, { defaultValue: e.kind });
                    return (
                      <Link
                        key={`${e.app._id}-${e.kind}-${i}`}
                        to={`${ROUTES.APPLICATIONS}/${e.app._id}`}
                        title={`${kindLabel} · ${typeLabel} · ${title}`}
                        className={`block text-left px-1.5 py-1 rounded text-[11px] leading-tight truncate focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${stageBadgeClass(e.app.pipelineStage)}`}
                      >
                        <span className="block truncate font-medium">{title}</span>
                        <span className="block truncate opacity-80">{kindLabel}{typeLabel ? ` · ${typeLabel}` : ''}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApplicationCalendarView;
