---
name: mobile-first-react
description: >
  Analyzes a React page/component and rewrites it to be mobile-first and visually polished on small screens.
  Grounded in 2025 industry standards: WCAG 2.2, Apple HIG, Google Material Design, Core Web Vitals,
  and modern dashboard/SaaS UX patterns including bento grids, progressive disclosure, skeleton loaders,
  responsive charts, and PWA safe-area handling. Preserves all logic — only transforms layout and style.
---

# Mobile-First React Optimizer (2025 Edition)

## Overview

This skill takes a React component or page and produces a fully rewritten, mobile-first version that:

- Renders beautifully from **320px** upward, with progressive enhancement for larger screens
- Follows **WCAG 2.2 AA** (touch targets, contrast, spacing), **Apple HIG** (44pt min tap), and **Google Material Design** (48dp min tap) standards
- Applies **2025 dashboard UX principles**: bento grids, priority hierarchy, progressive disclosure, skeleton loaders, responsive charts
- Handles **iOS/Android safe areas** (notches, home indicators, dynamic islands)
- Uses Tailwind CSS utility classes throughout — no external libs added unless already present
- **Preserves all logic, state, props, hooks, and data flow — only layout and style change**

---

## Step 1 — Analyze the Page

Before writing a single line of code, read the entire component and produce a structured audit. Skipping this step produces inferior output.

### 1A — Information Architecture Audit (Dashboard/SaaS Pages)

- [ ] Does the layout apply the **3-Second Rule**? The most critical KPI or action should be graspable within 3 seconds on mobile
- [ ] Are KPI/stat cards shown first, with detail tables/charts below? (Inverted pyramid)
- [ ] Is **progressive disclosure** used — summary first, drill-down on tap?
- [ ] Are alerts/status badges visually distinct (colored pills) rather than buried in text rows?
- [ ] Does content follow the **F-pattern** — critical content top-left, scanning left-to-right then down?
- [ ] Are there more than 5–7 pieces of information competing equally for attention? (Information overload)

### 1B — Layout & Structure

- [ ] Fixed pixel widths (`w-[400px]`, `style={{width: 400}}`) that overflow on 320px screens
- [ ] Side-by-side layouts (`flex-row`, `grid-cols-N`) without mobile-first col-1 override
- [ ] Horizontal scrolling content missing `overflow-x-auto`
- [ ] Multi-column stat/KPI cards not collapsing to 1–2 cols on mobile
- [ ] Missing `max-w-*` constraints causing excessive width on large mobiles
- [ ] Sidebar layouts that need to collapse to drawer/hidden on mobile

### 1C — Tables

- [ ] Any `<table>` — must be transformed (see Table Patterns)
- [ ] Tables with ≤ 4 columns → card-stack pattern on mobile
- [ ] Tables with 5+ columns → horizontal scroll with sticky first column
- [ ] Action columns (edit/delete) → full-width buttons inside card on mobile

### 1D — Navigation

- [ ] Top nav with 3+ links → hamburger drawer on mobile
- [ ] ≤ 5 primary nav items → consider bottom tab bar (thumb-zone friendly)
- [ ] Sidebar nav → must collapse; drawer or hidden on mobile
- [ ] Breadcrumbs with 3+ levels → truncate middle items on mobile

### 1E — Charts & Data Visualization

- [ ] Charts rendered at fixed pixel dimensions (will not scale)
- [ ] Charts without `ResponsiveContainer` (Recharts) or equivalent wrapper
- [ ] Complex multi-series charts that become illegible at < 360px width
- [ ] Chart legends to the right of chart → must move below on mobile
- [ ] Charts without skeleton/loading state (causes CLS — Core Web Vitals issue)
- [ ] Hover-only chart interactions → need tap equivalents

### 1F — Forms & Inputs

- [ ] Inputs below `min-h-[44px]` height
- [ ] Inputs without `w-full` on mobile
- [ ] Side-by-side fields not stacking on mobile
- [ ] Missing `inputMode` attributes on number/email/phone/URL inputs
- [ ] Missing `autoComplete` attributes
- [ ] Submit buttons too narrow — should be `w-full` on mobile

### 1G — Buttons & Touch Targets

- [ ] Clickable elements with tap area < 44px (WCAG AAA / Apple HIG minimum)
- [ ] Adjacent buttons/icons with < 8px gap (accidental tap risk)
- [ ] Icon-only buttons missing `aria-label`
- [ ] Primary action not reachable as FAB or bottom tab
- [ ] Hover-only states with no touch equivalent

### 1H — Modals, Sheets & Overlays

- [ ] Modals with fixed widths overflowing on mobile
- [ ] Modals missing `overflow-y-auto` + `max-h-[90vh]`
- [ ] Centered modal on mobile — should be bottom sheet with rounded top corners
- [ ] Missing drag handle on bottom sheets
- [ ] No `overscroll-contain` on modal scroll container (causes page scroll bleed)

### 1I — Loading States

- [ ] Data-fetching components without skeleton placeholders
- [ ] Spinners used instead of shape-matched skeletons
- [ ] Content causing layout shift (CLS) when loaded — no reserved space

### 1J — Safe Areas & PWA

- [ ] Fixed bottom bars missing `pb-[env(safe-area-inset-bottom)]`
- [ ] Fixed top headers missing `pt-[env(safe-area-inset-top)]` for notch devices
- [ ] Side drawers missing `pl-[env(safe-area-inset-left)]` for landscape notch
- [ ] `<meta name="viewport">` missing `viewport-fit=cover` for full-bleed designs
- [ ] Input font sizes < 16px (triggers iOS auto-zoom)

### 1K — Typography

- [ ] Font sizes below `text-base` (16px) for body or input text
- [ ] Line height below 1.5 for paragraphs (WCAG 1.4.12)
- [ ] Long unbroken strings without `break-words`
- [ ] Missing visual hierarchy — all text same weight/size

### 1L — Images & Media

- [ ] Images without `w-full max-w-full` — will overflow
- [ ] Images without `aspect-ratio` — causes layout shift
- [ ] Off-screen images without `loading="lazy"`
- [ ] Missing `srcset` for responsive bandwidth optimization

---

## Step 2 — Transformation Plan

After the audit, write one line per issue before touching code:

```
TRANSFORMATION PLAN:
1. Reorder: Move 3 KPI stat cards to top — currently buried below chart (3-Second Rule)
2. ProductTable (6 cols) → card stack on mobile, horizontal scroll on sm+
3. Sidebar nav → hamburger drawer on mobile; bottom tab bar with 4 items
4. BarChart fixed 500px → ResponsiveContainer + skeleton loader
5. "Export" button 32px → min-h-[44px], full-width on mobile
6. Add/Edit modal → bottom-sheet on mobile with drag handle
7. Form: stack Name/Email fields on mobile, add inputMode + autoComplete
8. Fixed bottom toolbar → add pb-[env(safe-area-inset-bottom)]
9. Add skeleton loaders to KPI cards and chart
```

---

## Step 3 — Apply Transformations

### Breakpoint Strategy (Mobile-First Always)

Base classes = mobile. Layer up with `sm:` / `md:` / `lg:`:

```
Mobile (default): 320px – 639px
Tablet (sm:):     640px – 1023px
Desktop (md:):    1024px+
```

---

### PATTERN LIBRARY

---

#### DASHBOARD LAYOUT — Information Hierarchy

Mobile dashboards must follow the inverted pyramid: KPIs first, charts second, tables last.

```jsx
const Dashboard = () => (
  <div className="min-h-screen bg-gray-50">
    <MobileHeader />

    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6
                     pb-[calc(env(safe-area-inset-bottom)+80px)] sm:pb-6">

      {/* LAYER 1 — Primary KPIs (above fold on mobile) */}
      <section aria-label="Key metrics">
        <KPIBentoGrid />
      </section>

      {/* LAYER 2 — Charts with progressive disclosure */}
      <section aria-label="Trends">
        <ChartSection />
      </section>

      {/* LAYER 3 — Detail tables (user scrolls to) */}
      <section aria-label="Detailed data">
        <DataTable />
      </section>
    </main>

    <BottomTabBar />
  </div>
);
```

---

#### BENTO GRID — KPI Cards (2025 Standard)

The Bento grid (popularized by Apple, now standard in SaaS dashboards) uses asymmetric blocks of varying size to communicate hierarchy: large block = high importance. On mobile, collapse to 2 columns.

```jsx
const KPIBentoGrid = ({ metrics }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {/* Hero KPI — spans full width (2 cols on mobile), dominant color */}
    <div className="col-span-2 bg-blue-600 text-white rounded-2xl p-5 shadow-sm">
      <p className="text-sm font-medium text-blue-200">Total Revenue</p>
      <p className="text-3xl font-bold mt-1">{metrics.revenue}</p>
      <div className="flex items-center gap-1 mt-2 text-sm text-blue-200">
        <TrendUpIcon className="w-4 h-4" />
        <span>+12.4% vs last month</span>
      </div>
    </div>

    {/* Secondary KPIs — 1 col each on mobile */}
    {metrics.secondary.map((m) => (
      <div key={m.key} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{m.label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{m.value}</p>
        <StatusBadge trend={m.trend} />
      </div>
    ))}
  </div>
);

// Colored status pill — instantly scannable, not buried text
const StatusBadge = ({ trend }) => {
  const styles = {
    up:   'bg-green-100 text-green-700',
    down: 'bg-red-100 text-red-700',
    flat: 'bg-gray-100 text-gray-600',
  };
  const icons = { up: '↑', down: '↓', flat: '→' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium
                      px-2 py-0.5 rounded-full mt-2 ${styles[trend.direction]}`}>
      {icons[trend.direction]} {trend.label}
    </span>
  );
};

// Skeleton that matches card shape — prevents CLS
const KPICardSkeleton = () => (
  <div className="animate-pulse bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
    <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
    <div className="h-8 w-28 bg-gray-200 rounded mb-2" />
    <div className="h-3 w-16 bg-gray-200 rounded" />
  </div>
);
```

---

#### CHARTS — Responsive + Skeleton Loader

Recharts requires `ResponsiveContainer`. Always pair with shape-matched skeleton to prevent CLS.

```jsx
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const ChartSkeleton = () => (
  <div className="animate-pulse bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm">
    <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
    <div className="h-[200px] sm:h-[280px] bg-gray-200 rounded-xl" />
    <div className="h-3 w-24 bg-gray-200 rounded mt-3 mx-auto" />
  </div>
);

const ResponsiveAreaChart = ({ data, isLoading }) => {
  if (isLoading) return <ChartSkeleton />;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Revenue Trend</h3>
        {/* Compact time range picker — min-h for touch */}
        <div className="flex gap-1">
          {['7d', '30d', '90d'].map(r => (
            <button key={r}
              className="text-xs px-2.5 py-1.5 rounded-lg min-h-[32px] font-medium
                         text-gray-500 hover:bg-gray-100 data-[active=true]:bg-blue-100
                         data-[active=true]:text-blue-700">
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Always width="100%" — NEVER fixed pixel width */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                 interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                 tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{
              borderRadius: '12px', border: 'none',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '13px'
            }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2}
                fill="url(#colorRevenue)" />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend BELOW chart (not right-aligned) — mobile constraint */}
      <div className="flex justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
          Revenue
        </div>
      </div>
    </div>
  );
};
```

---

#### TABLES — Three Patterns

**Pattern A — Card Stack (≤ 4 columns)**

```jsx
const ResponsiveTable = ({ data, columns, actions }) => (
  <div className="w-full">
    {/* Mobile: Card Stack */}
    <div className="block sm:hidden space-y-3">
      {data.map((row) => (
        <div key={row.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{row[columns[0].key]}</p>
              <p className="text-xs text-gray-500 mt-0.5">{row[columns[1].key]}</p>
            </div>
            <StatusBadge status={row.status} />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {columns.slice(2).map(col => (
              <div key={col.key}>
                <dt className="text-xs text-gray-400">{col.label}</dt>
                <dd className="font-medium text-gray-700">{row[col.key]}</dd>
              </div>
            ))}
          </dl>

          {actions && (
            <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
              {actions.map(action => (
                <button key={action.label} onClick={() => action.fn(row)}
                  className="flex-1 text-sm font-medium py-2 min-h-[44px] rounded-xl
                             border border-gray-200 text-gray-700 hover:bg-gray-50">
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>

    {/* Tablet+: Traditional Table */}
    <div className="hidden sm:block overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
      <table className="min-w-full divide-y divide-gray-100 text-sm bg-white">
        <thead className="bg-gray-50">
          <tr>
            {columns.map(col => (
              <th key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {col.label}
              </th>
            ))}
            {actions && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {data.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3.5 text-gray-700">{row[col.key]}</td>
              ))}
              {actions && (
                <td className="px-4 py-3.5">
                  <div className="flex gap-2 justify-end">
                    {actions.map(action => (
                      <button key={action.label} onClick={() => action.fn(row)}
                        className="text-xs font-medium px-3 py-1.5 min-h-[32px]
                                   rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600">
                        {action.label}
                      </button>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
```

**Pattern B — Horizontal Scroll with Sticky Column (5+ columns)**

```jsx
<div className="overflow-x-auto -mx-4 sm:mx-0 rounded-2xl border border-gray-100 shadow-sm">
  <table className="min-w-[720px] w-full divide-y divide-gray-100 text-sm">
    <thead className="bg-gray-50">
      <tr>
        <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold
                       text-gray-500 uppercase shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
          Name
        </th>
        {/* Other columns */}
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-50 bg-white">
      {data.map(row => (
        <tr key={row.id} className="hover:bg-gray-50/50">
          <td className="sticky left-0 z-10 bg-white px-4 py-3.5 font-medium text-gray-900
                         shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
            {row.name}
          </td>
          {/* Other cells */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Table Skeleton:**

```jsx
const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="animate-pulse rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
    <div className="block sm:hidden space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-gray-100 rounded-xl h-28" />
      ))}
    </div>
    <div className="hidden sm:block">
      <div className="bg-gray-50 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-4 border-t border-gray-50 flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 bg-gray-100 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  </div>
);
```

---

#### NAVIGATION

**Pattern A — Hamburger Drawer (many nav items)**

```jsx
const MobileHeader = ({ title, navItems }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Sticky header — respects iOS status bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100
                         pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14 sm:hidden">
          <span className="font-semibold text-gray-900">{title}</span>
          <div className="flex items-center gap-1">
            <button className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center
                               rounded-xl hover:bg-gray-100" aria-label="Notifications">
              <BellIcon className="w-5 h-5 text-gray-600" />
            </button>
            <button onClick={() => setOpen(true)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center
                         rounded-xl hover:bg-gray-100" aria-label="Open menu">
              <MenuIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 sm:hidden backdrop-blur-[1px]"
             onClick={() => setOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white flex flex-col
                         transform transition-transform duration-300 ease-out sm:hidden
                         pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
                         ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <span className="font-bold text-gray-900">Menu</span>
          <button onClick={() => setOpen(false)}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center
                       rounded-xl hover:bg-gray-100" aria-label="Close menu">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map(item => (
            <a key={item.href} href={item.href}
               className="flex items-center gap-3 px-4 py-3 min-h-[52px] text-gray-700
                          hover:bg-gray-50 hover:text-blue-600 rounded-xl mx-2 transition-colors
                          data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700">
              <item.Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>
    </>
  );
};
```

**Pattern B — Bottom Tab Bar (3–5 items — 2025 preferred for dashboards)**

Sits in the thumb zone — most reachable area — and is the standard for mobile-first SaaS apps.

```jsx
const BottomTabBar = ({ tabs, activeTab, onTabChange }) => (
  <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm
                  border-t border-gray-100 flex sm:hidden
                  pb-[env(safe-area-inset-bottom)]">
    {tabs.map(tab => {
      const isActive = activeTab === tab.key;
      return (
        <button key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex flex-col items-center justify-center flex-1 py-2 gap-1
                      min-h-[56px] transition-colors active:bg-gray-50
                      ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          aria-label={tab.label}
          aria-current={isActive ? 'page' : undefined}>
          <tab.Icon className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">{tab.label}</span>
        </button>
      );
    })}
  </nav>
);
```

---

#### PROGRESSIVE DISCLOSURE — Expandable Sections

Hide secondary data on mobile behind "Show more". Critical for data-heavy dashboards.

```jsx
const ProgressiveSection = ({ title, summary, children }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button
            onClick={() => setExpanded(!expanded)}
            className="sm:hidden flex items-center gap-1 text-sm text-blue-600 font-medium
                       min-h-[44px] px-2 -mr-2"
            aria-expanded={expanded}>
            {expanded ? 'Less' : 'More'}
            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200
                                        ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {summary}
      </div>

      {/* Toggle on mobile, always visible on desktop */}
      <div className={`overflow-hidden transition-all duration-300
                       ${expanded ? 'max-h-screen' : 'max-h-0'} sm:max-h-none`}>
        <div className="px-4 pb-4 sm:px-6 sm:pb-6 border-t border-gray-50 pt-4">
          {children}
        </div>
      </div>
    </div>
  );
};
```

---

#### SKELETON LOADERS

Shape-matched skeletons prevent CLS (Core Web Vitals) and reduce perceived load time.

```jsx
// Generic content skeleton
const ContentSkeleton = ({ lines = 3 }) => (
  <div className="animate-pulse space-y-3">
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className={`h-4 bg-gray-200 rounded ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
    ))}
  </div>
);

// Chart skeleton
const ChartSkeleton = ({ height = 200 }) => (
  <div className="animate-pulse bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
    <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
    <div className={`bg-gray-200 rounded-xl`} style={{ height }} />
    <div className="h-3 w-20 bg-gray-200 rounded mt-3 mx-auto" />
  </div>
);
```

---

#### FORMS — Mobile-Optimized

```jsx
const MobileForm = ({ onSubmit }) => (
  <form onSubmit={onSubmit} className="space-y-5">
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">First Name</label>
        <input type="text" inputMode="text" autoComplete="given-name"
               className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base
                          min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500
                          focus:border-transparent transition-shadow" />
      </div>
      <div className="flex-1 space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Last Name</label>
        <input type="text" inputMode="text" autoComplete="family-name"
               className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base
                          min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500
                          focus:border-transparent transition-shadow" />
      </div>
    </div>

    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">Email</label>
      <input type="email" inputMode="email" autoComplete="email"
             className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base
                        min-h-[48px] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" />
    </div>

    <button type="submit"
            className="w-full sm:w-auto sm:min-w-[160px] bg-blue-600 text-white font-semibold
                       px-6 py-3 rounded-xl min-h-[48px] hover:bg-blue-700
                       active:scale-[0.98] transition-all focus:outline-none
                       focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
      Save Changes
    </button>
  </form>
);
```

**`inputMode` Reference:**

| Input context | `inputMode` | `autoComplete` |
|---|---|---|
| Numbers only | `"numeric"` | `"off"` |
| Phone | `"tel"` | `"tel"` |
| Email | `"email"` | `"email"` |
| Decimal | `"decimal"` | `"off"` |
| URL | `"url"` | `"url"` |
| Search | `"search"` | `"off"` |
| Name | `"text"` | `"given-name"` / `"family-name"` |

---

#### BUTTONS & TOUCH TARGETS

Minimum 44×44px per WCAG 2.1 AAA and Apple HIG. 48px preferred for primary actions (Material Design).

```jsx
// Primary CTA
<button className="flex items-center justify-center gap-2 px-5 py-3 min-h-[44px]
                   bg-blue-600 text-white font-semibold rounded-xl
                   hover:bg-blue-700 active:scale-[0.98] transition-all
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
  <PlusIcon className="w-5 h-5" />
  Add Item
</button>

// Icon-only button — must have aria-label
<button className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center
                   rounded-xl hover:bg-gray-100 transition-colors"
        aria-label="Delete item">
  <TrashIcon className="w-5 h-5 text-red-500" />
</button>

// FAB — Floating Action Button (primary action, above bottom nav + safe area)
<button className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4
                   sm:bottom-6 sm:right-6 z-20
                   w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-200
                   flex items-center justify-center
                   hover:bg-blue-700 active:scale-95 transition-all"
        aria-label="Add new item">
  <PlusIcon className="w-6 h-6" />
</button>

// Destructive action pair — stacked on mobile, row on desktop
<div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
  <button className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl
                     border border-gray-200 text-gray-700 font-medium hover:bg-gray-50">
    Cancel
  </button>
  <button className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl
                     bg-red-600 text-white font-medium hover:bg-red-700">
    Delete
  </button>
</div>
```

---

#### MODALS & BOTTOM SHEETS

Modals on mobile should be bottom sheets — they slide up from the bottom and respect natural thumb interaction.

```jsx
const BottomSheetModal = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl
                      max-h-[92vh] flex flex-col shadow-2xl z-10
                      pb-[env(safe-area-inset-bottom)] sm:pb-0">

        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1.5 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center
                       rounded-xl hover:bg-gray-100 -mr-2" aria-label="Close">
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* overscroll-contain prevents page scrolling behind modal */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-gray-100">{footer}</div>
        )}
      </div>
    </div>
  );
};
```

---

#### SAFE AREA INSETS — Notch / Dynamic Island / Home Indicator

Required for any fixed/sticky UI elements. Ensures content is never hidden behind device hardware.

```html
<!-- index.html — required for env() to work on iOS -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
/* global.css — define CSS variables for reuse */
:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
}
```

```jsx
// Tailwind arbitrary values for safe areas
<header className="sticky top-0 pt-[env(safe-area-inset-top)]" />
<nav    className="fixed bottom-0 pb-[env(safe-area-inset-bottom)]" />
<aside  className="fixed left-0 pl-[env(safe-area-inset-left)]" />

// FAB above bottom nav + home indicator
<button className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4" />

// Page main content above bottom tab bar
<main className="pb-[calc(env(safe-area-inset-bottom)+64px)] sm:pb-0" />
```

---

#### CUSTOM HOOK — useMediaQuery

For cases where you need to render fundamentally different components (not just different styles).

```jsx
// hooks/useMediaQuery.js
import { useState, useEffect } from 'react';

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
};

// Common breakpoints
const isMobile  = useMediaQuery('(max-width: 639px)');
const isTablet  = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
const isDesktop = useMediaQuery('(min-width: 1024px)');

// Render completely different layouts
return isMobile ? <MobileView /> : <DesktopView />;
```

---

#### TYPOGRAPHY & SPACING

```jsx
<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight tracking-tight">
<h2 className="text-lg sm:text-xl font-semibold text-gray-800">
<p  className="text-base leading-relaxed text-gray-600">   {/* 16px — never go below */}
<p  className="text-sm leading-relaxed text-gray-500">     {/* 14px — secondary only */}
<p  className="break-words overflow-wrap-anywhere">         {/* Long strings */}

{/* Container */}
<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

{/* Section rhythm */}
<div className="space-y-4 sm:space-y-6">

{/* Card padding */}
<div className="p-4 sm:p-6">
```

---

#### IMAGES

```jsx
// Responsive image
<img src={src} alt={alt} loading="lazy" className="w-full h-auto object-cover rounded-xl" />

// Aspect-ratio preserved (prevents CLS)
<div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100">
  <img src={src} alt={alt} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
</div>

// Responsive srcset (bandwidth optimization)
<img
  src={`${src}?w=640`}
  srcSet={`${src}?w=320 320w, ${src}?w=640 640w, ${src}?w=1280 1280w`}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  alt={alt} loading="lazy" className="w-full h-auto rounded-xl"
/>
```

---

## Step 4 — Quality Checklist

**Information Architecture**
- [ ] Critical KPI/action visible within first mobile screenful (3-Second Rule)
- [ ] Content order: KPIs → Charts → Tables (inverted pyramid)
- [ ] Progressive disclosure used for secondary data on mobile
- [ ] Status/alerts use colored badge pills, not buried text

**Layout**
- [ ] No fixed pixel widths overflowing 320px
- [ ] All `flex-row` / `grid-cols-N` have `flex-col` / `grid-cols-1` mobile base
- [ ] `px-4` minimum mobile padding

**Touch & Interaction**
- [ ] Every interactive element ≥ 44×44px (WCAG AAA / Apple HIG)
- [ ] Adjacent targets have ≥ 8px gap
- [ ] All icon-only buttons have `aria-label`
- [ ] Primary action reachable via FAB or bottom tab (one tap from anywhere)

**Tables & Charts**
- [ ] All `<table>` use card-stack (≤ 4 cols) or horizontal scroll (5+ cols) on mobile
- [ ] All charts wrapped in `ResponsiveContainer` — no fixed pixel dimensions
- [ ] Chart legends below chart, not right-aligned
- [ ] All data-fetching sections have shape-matched skeleton loaders

**Forms**
- [ ] All inputs `w-full` on mobile, `min-h-[48px]`
- [ ] Correct `inputMode` on non-text inputs
- [ ] `autoComplete` on all form fields
- [ ] Submit `w-full` on mobile

**Navigation**
- [ ] Mobile nav uses hamburger drawer OR bottom tab bar (not both)
- [ ] Bottom tab bar has `pb-[env(safe-area-inset-bottom)]`

**Safe Areas & PWA**
- [ ] `viewport-fit=cover` in meta viewport
- [ ] Fixed bottom bars: `pb-[env(safe-area-inset-bottom)]`
- [ ] Fixed headers: `pt-[env(safe-area-inset-top)]`
- [ ] FAB positioned above bottom nav + safe area

**Typography**
- [ ] All input/body text ≥ 16px (`text-base`)
- [ ] Paragraphs use `leading-relaxed` (≥ 1.5× — WCAG)
- [ ] Long strings use `break-words`

**Performance / Core Web Vitals**
- [ ] All loading sections show shape-matched skeletons (CLS prevention)
- [ ] Off-screen images: `loading="lazy"`
- [ ] Charts lazy-loaded via `React.lazy` + `Suspense` if large bundle

---

## Step 5 — Output Format

Return:
1. **Audit Summary** — 3–8 bullets of what changed and why
2. **Transformation Plan** — one line per change
3. **Complete rewritten JSX** — full file, drop-in ready, no `...existing code` placeholders
4. **Any new CSS** needed (prefer Tailwind; use inline `<style>` only for `env()` safe areas)
5. **Assumptions** — note any icon libs, dependencies assumed present

---

## Anti-Pattern Reference

| ❌ Anti-Pattern | ✅ 2025 Standard | Why |
|---|---|---|
| Fixed `w-[500px]` | `w-full sm:max-w-lg` | Overflows mobile |
| `h-8` / `h-10` buttons | `min-h-[44px]` | WCAG AAA / Apple HIG |
| `text-xs` inputs | `text-base` (16px) | iOS auto-zoom |
| `<table>` on mobile | Card stack or horizontal scroll | Unusable on small screens |
| Fixed `width={500}` on chart | `<ResponsiveContainer width="100%">` | Will not scale |
| Legend right of chart | Legend below chart | No horizontal space on mobile |
| Centered modal on mobile | Bottom sheet `rounded-t-3xl` | Thumb-friendly, natural |
| Spinners on data load | Shape-matched skeleton | Prevents CLS, better UX |
| Fixed bottom bar no safe area | `pb-[env(safe-area-inset-bottom)]` | Hides behind home indicator |
| Top nav 4+ links mobile | Bottom tab bar or hamburger | Thumb zone UX |
| `grid-cols-4` KPIs | `grid-cols-2 sm:grid-cols-4` | 4 cols too narrow on mobile |
| All content visible at once | Progressive disclosure | Reduces cognitive load |
| Hover-only chart/table actions | Tap-accessible alternatives | Touch has no hover |
| `p-2` containers | `p-4 sm:p-6` | Too cramped |
| Missing `inputMode` | Always specify | Correct keyboard on mobile |
| Missing `autoComplete` | Always specify | Critical for mobile UX |
| No `loading="lazy"` | Always on off-screen images | Bandwidth on mobile |
| KPIs below charts | KPIs first, above fold | 3-Second Rule |
| All metrics same visual weight | Hero KPI large + bento hierarchy | Visual priority |
| `overscroll` bleed in modal | `overscroll-contain` on scroll div | Page scrolls behind modal |

---

## Standards Reference

| Standard | Requirement | Tailwind Implementation |
|---|---|---|
| WCAG 2.2 AA — Target Size (2.5.8) | 24×24px min + spacing | `min-h-6 min-w-6` + gap |
| WCAG 2.1 AAA — Target Size | 44×44px min | `min-h-[44px] min-w-[44px]` |
| Apple HIG | 44×44pt min touch target | `min-h-[44px]` |
| Google Material Design | 48dp min touch target | `min-h-[48px]` (recommended) |
| WCAG 1.4.12 — Line Height | ≥ 1.5× font-size | `leading-relaxed` (1.625) |
| iOS Safari — Auto-zoom | Inputs ≥ 16px | `text-base` on all inputs |
| Core Web Vitals — CLS | Reserve space before load | Skeleton loaders |
| Core Web Vitals — INP | Respond to touch < 200ms | Avoid sync JS in handlers |
| Google web.dev — PWA Safe Areas | `viewport-fit=cover` + `env()` | Meta tag + Tailwind arbitrary |
| WCAG 1.4.3 — Contrast AA | 4.5:1 text, 3:1 large | `text-gray-700+` on white |