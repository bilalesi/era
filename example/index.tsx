import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import cx from 'classnames';
import { DateTime, Interval, Duration } from 'luxon';
import {
  viewOfInterval,
  today,
  viewOfDays,
  isWeekend,
  isToday,
  weekOf,
  splitByUnit,
  paddedMonthOf,
  dayOf,
} from '../.';
import { IconArrowLeft, IconArrowRight } from './icons';

type View = 'day' | 'week' | 'month' | 'year';

interface CalendarState {
  view: View;
  datetime: DateTime;
  interval: Interval;
}

type CalendarAction =
  | { type: 'set.view'; payload: View }
  | { type: 'set.datetime'; payload: DateTime };

type CalendarReducer = (
  state: CalendarState,
  action: CalendarAction
) => CalendarState;

function useCalendar(reducer: CalendarReducer, initialState: CalendarState) {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const set = {
    view: payload => dispatch({ type: 'set.view', payload }),
    datetime: payload => dispatch({ type: 'set.datetime', payload }),
  };
  return [state, set] as const;
}

function CalendarViewSelect({ view, setView }) {
  return (
    <div className="CalendarViewSelect">
      <ButtonGroup>
        {['day', 'week', 'month', 'year'].map(option => {
          const checked = view === option;
          const handleChange = () => setView(option);
          return (
            <ButtonGroupOption
              key={option}
              active={checked}
              onClick={handleChange}
            >
              {option}
            </ButtonGroupOption>
          );
        })}
      </ButtonGroup>
    </div>
  );
}

function CalendarNav({ interval, view, datetime, setDatetime }) {
  function prev() {
    setDatetime(datetime.minus({ [view]: 1 }));
  }
  function next() {
    setDatetime(datetime.plus({ [view]: 1 }));
  }
  function goToday() {
    setDatetime(today().start.startOf('day'));
  }
  return (
    <div className="CalendarNav">
      <ButtonGroup>
        <ButtonGroupOption onClick={prev}>
          <IconArrowLeft width={11} height={14} />
        </ButtonGroupOption>
        <ButtonGroupOption onClick={goToday} bordered>
          Today
        </ButtonGroupOption>
        <ButtonGroupOption onClick={next}>
          <IconArrowRight width={11} height={14} />
        </ButtonGroupOption>
      </ButtonGroup>
    </div>
  );
}

function CalendarDay({ datetime, setDatetime, day }) {
  let segments = viewOfInterval(day.start, 'day').splitBy(
    Duration.fromObject({ minutes: 30 })
  );
  // handle day light savings
  if (segments.length !== 48) {
    segments = viewOfInterval(day.start.minus({ days: 2 }), 'day').splitBy(
      Duration.fromObject({ minutes: 30 })
    );
  }
  const dayName = formatWeekday({ day: day.start });
  const dayNumber = formatDayNumber({ day: day.start });
  const className = cx('Day', {
    'Day--today': isToday(day.start),
    'Day--weekend': isWeekend(day.start),
    'Day--highlight': day.contains(datetime),
  });
  const handleClick = () => setDatetime(day.start);
  return (
    <div className={className}>
      <button className="DayHeader" onClick={handleClick}>
        <div>{dayName}</div>
        <div className="DayHeader__number">{dayNumber}</div>
      </button>
      {segments.map((segment, i) => {
        return <div key={segment.start.toISO()} className="DaySegment"></div>;
      })}
    </div>
  );
}

function CalendarTimeZones({ datetime }) {
  return (
    <>
      {['utc', 'local'].map(timezone => {
        const now = timezone === 'local' ? DateTime.local() : DateTime.utc();
        let segments = splitByUnit(dayOf(DateTime.local()), 'hour');
        // handle day light savings
        if (segments.length !== 48) {
          segments = splitByUnit(
            dayOf(DateTime.local().minus({ days: 2 })),
            'hour'
          );
        }
        return (
          <div key={timezone} className="CalendarTimeZone">
            <div className="DayHeader">
              <small>{now.toFormat('ZZZZ')}</small>
            </div>
            {segments.map(segment => {
              const time =
                timezone === 'local' ? segment.start : segment.start.toUTC();
              return (
                <div key={time.toISO()} className="CalendarTimeZone__time">
                  {time.toLocaleString({
                    hour: 'numeric',
                    hour12: true,
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function CalendarDays({ view, datetime, setDatetime }) {
  const days = viewOfDays(datetime, view);
  return (
    <div className="CalendarDays">
      <CalendarTimeZones datetime={datetime} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${days.length}, 1fr)`,
        }}
      >
        {days.map(day => {
          return (
            <CalendarDay
              key={day.toISO()}
              day={day}
              datetime={datetime}
              setDatetime={setDatetime}
            />
          );
        })}
      </div>
    </div>
  );
}

function CalendarMonth({ datetime, setDatetime }) {
  const days = viewOfDays(datetime, 'month');
  return (
    <div className="Month">
      <div className="Month__days">
        {days.map((day, i) => {
          const weekday = day.start.weekday;
          const isToday = day.contains(DateTime.local());
          const isActive = day.contains(datetime);

          const gridColumn =
            i === 0 ? (weekday === 7 ? 0 : weekday + 1) : undefined;

          function handleDayClick(dt) {
            return () => setDatetime(dt);
          }

          return (
            <button
              key={day.toISO()}
              className="Month__day"
              style={{ gridColumn }}
              onClick={handleDayClick(day.start)}
            >
              <span
                className={cx('Month__day-decoration', {
                  'Month__day-decoration--today': isToday,
                  'Month__day-decoration--active': isActive,
                  'Month__day-decoration--weekday': weekday > 5,
                  'Month__day-decoration--padded-month':
                    day.start.month !== datetime.month,
                })}
              >
                <span
                  className={cx('Month__day--date', {
                    'Month__day--today': isToday,
                    'Month__day--active': isActive,
                    'Month__day--padded-month':
                      day.start.month !== datetime.month,
                  })}
                >
                  {day.start.day}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarMiniMonth({
  month,
  datetime,
  setDatetime,
  interval,
  spanMonths = false,
}) {
  const days = splitByUnit(
    paddedMonthOf(month.start, { daysPerWeek: 7, weeksPerMonth: 6 }),
    'days'
  );
  return (
    <div className="MiniMonth">
      <div className="MiniMonth__header">
        {month.start.toLocaleString({
          month: 'long',
        })}
      </div>
      <div className="MiniMonth__days">
        {days.map((day, i) => {
          const weekday = day.start.weekday;
          const isToday = day.contains(DateTime.local());
          const isPadded = day.start.month !== month.start.month;
          const isInterval = interval.contains(day.start);
          const highlightDay = spanMonths
            ? isInterval
            : isInterval && !isPadded;
          const gridColumn =
            i === 0 ? (weekday === 7 ? 0 : weekday + 1) : undefined;
          function handleDayClick(dt) {
            return () => setDatetime(dt);
          }
          return (
            <button
              key={day.toISO()}
              className="MiniMonth__day"
              style={{ gridColumn }}
              onClick={handleDayClick(day.start)}
            >
              <span
                className={cx('MiniMonth__day-decoration', {
                  'MiniMonth__day-decoration--today': isToday && !isPadded,
                  'MiniMonth__day-decoration--interval': highlightDay,
                  'MiniMonth__day-decoration--padded-month':
                    isPadded && !highlightDay,
                  'MiniMonth__day-decoration--interval-start':
                    highlightDay &&
                    interval.start.equals(day.start.startOf('day')),
                  'MiniMonth__day-decoration--interval-end':
                    highlightDay &&
                    interval.end.hasSame(day.start.endOf('day'), 'day'),
                })}
              >
                {day.start.day}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarYear({ datetime, setDatetime }) {
  const interval = viewOfInterval(datetime, 'year');
  const months = splitByUnit(interval, 'months');
  return (
    <div className="Year">
      {months.map(month => (
        <CalendarMiniMonth
          key={month.start.toISO()}
          month={month}
          interval={viewOfInterval(datetime, 'day')}
          datetime={datetime}
          setDatetime={setDatetime}
        />
      ))}
    </div>
  );
}

function reducer(state, action) {
  switch (action.type) {
    case 'set.view':
      return {
        ...state,
        view: action.payload,
        interval: viewOfInterval(state.datetime, action.payload),
      };
    case 'set.datetime':
      return {
        ...state,
        datetime: action.payload,
        interval: viewOfInterval(action.payload, state.view),
      };
    default:
      return state;
  }
}

const initialState: CalendarState = {
  view: 'week',
  datetime: DateTime.local(),
  interval: weekOf(DateTime.local()),
};

function CalendarApp() {
  const [state, set] = useCalendar(reducer, initialState);
  const { view, datetime, interval } = state;
  return (
    <div className="CalendarApp">
      <div className="Calendar">
        <div className="CalendarHeader">
          <div className="CalendarHeader__title">
            {view !== 'year' && (
              <span className="CalendarHeader__title-month">
                {datetime.toLocaleString({ month: 'long' })}
              </span>
            )}{' '}
            <span>{datetime.year}</span>
          </div>
          <CalendarViewSelect view={view} setView={set.view} />
          <CalendarNav
            interval={interval}
            view={view}
            datetime={datetime}
            setDatetime={set.datetime}
          />
        </div>
        {['day', 'week'].includes(view) && (
          <CalendarDays
            view={view}
            datetime={datetime}
            setDatetime={set.datetime}
          />
        )}
        {view === 'month' && (
          <CalendarMonth datetime={datetime} setDatetime={set.datetime} />
        )}
        {view === 'year' && (
          <CalendarYear datetime={datetime} setDatetime={set.datetime} />
        )}
      </div>
      <div className="CalendarSidebar">
        <div className="CalendarSidebar__content">
          {['day', 'week'].includes(view) && (
            <CalendarMiniMonth
              spanMonths
              interval={interval}
              datetime={datetime}
              setDatetime={set.datetime}
              month={Interval.fromDateTimes(
                datetime.startOf('month'),
                datetime.endOf('month')
              )}
            />
          )}
          <Settings />
        </div>
      </div>
    </div>
  );
}

function formatWeekday({ day, options = { weekday: 'short' } }) {
  if (day.day === 1) return day.monthShort;
  return day.toLocaleString(options);
}

function formatDayNumber({ day, options = { day: 'numeric' } }) {
  return day.toLocaleString(options);
}

export function ButtonGroup({ children }) {
  return <div className="ButtonGroup">{children}</div>;
}

export function ButtonGroupOption({
  active = false,
  bordered = false,
  onClick,
  children,
}) {
  const classnames = cx('ButtonGroupOption', {
    'ButtonGroupOption--active': active,
    'ButtonGroupOption--bordered': bordered,
  });
  return (
    <button className={classnames} onClick={onClick}>
      {children}
    </button>
  );
}

function Settings() {
  return (
    <div className="Settings">
      <SettingsTheme />
      <SettingsAccentColor />
      <SettingsPanel title="Made By">
        <a href="https://hshoff.dev" className="Logo">
          SHOFFH
        </a>
      </SettingsPanel>
    </div>
  );
}

export function SettingsRow({ children, ...restProps }) {
  return (
    <div className="SettingsRow" {...restProps}>
      {children}
    </div>
  );
}

export function SettingsTitle({ collapsed, children, ...restProps }) {
  return (
    <div className="SettingsTitle" {...restProps}>
      <div>{children}</div>
      <button>{collapsed ? '+' : '-'}</button>
    </div>
  );
}

export function SettingsContent({ children }) {
  return <div className="SettingsContent">{children}</div>;
}

export function SettingsPanel({ title, children, defaultCollapse = false }) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapse);
  function toggle() {
    setCollapsed(!collapsed);
  }
  return (
    <SettingsRow>
      <SettingsTitle collapsed={collapsed} onClick={toggle}>
        {title}
      </SettingsTitle>
      {!collapsed && <SettingsContent>{children}</SettingsContent>}
    </SettingsRow>
  );
}

export function SettingsTheme() {
  const [active, setActive] = React.useState('light');

  React.useEffect(() => {
    document.body.className = active.toLowerCase();
  }, [active]);

  const themes = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
  ];

  return (
    <SettingsPanel title="Theme" defaultCollapse={false}>
      <ButtonGroup>
        {themes.map(theme => {
          const click = event => setActive(theme.value);
          return (
            <ButtonGroupOption
              key={theme.value}
              active={active === theme.value}
              onClick={click}
            >
              {theme.label}
            </ButtonGroupOption>
          );
        })}
      </ButtonGroup>
    </SettingsPanel>
  );
}

export function SettingsAccentColor() {
  const [accent, setAccent] = React.useState('#5251c0');

  // read + set value on mount
  React.useEffect(() => {
    setAccent(
      getComputedStyle(document.body).getPropertyValue('--primary-accent')
    );
  }, []);

  // update variable value on accent change
  React.useEffect(() => {
    document.body.style.setProperty('--primary-accent', accent);
  }, [accent]);

  return (
    <SettingsPanel title="Accent Color">
      <div className="Accent">
        <input
          id="AccentColor"
          type="color"
          value={accent.trim()}
          onChange={e => setAccent(e.target.value)}
        />
        <label htmlFor="AccentColor">{accent}</label>
      </div>
    </SettingsPanel>
  );
}

ReactDOM.render(<CalendarApp />, document.getElementById('root'));
