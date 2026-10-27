import React, { useState, useEffect, useRef } from 'react';
import { translations } from '../shared/i18n.js';
import { calculateShiftEarnings, evaluateFatigueRisk } from '../shared/calculations.js';
import {
  getStoredState,
  resetStoredState,
  getLocalOrgData,
  localCheckIn,
  localCheckOut,
  localSubmitReport,
  localUpdateReportStatus
} from '../shared/storage.js';
import AssistantWidget from './components/AssistantWidget.jsx';
import Icon from './components/Icon.jsx';

export default function App() {
  const [lang, setLang] = useState('en');
  const t = translations[lang] || translations.en;

  // Global State (Managed through verified versioned local demo storage)
  const [currentOrgId, setCurrentOrgId] = useState('org-buildright');
  const [role, setRole] = useState('worker'); // 'worker' or 'employer' (Demonstration switch only)
  
  const [orgData, setOrgData] = useState(() => getLocalOrgData('org-buildright'));
  const [currentWorkerId, setCurrentWorkerId] = useState('w-c1');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // Live Timer for active shift
  const [liveElapsedHours, setLiveElapsedHours] = useState(0);

  // Safety report form state
  const [reportTitle, setReportTitle] = useState('');
  const [reportCategory, setReportCategory] = useState('SAFETY_HAZARD');
  const [reportSeverity, setReportSeverity] = useState('MEDIUM');
  const [reportDescription, setReportDescription] = useState('');

  // Supervisor resolution modal state
  const [selectedReportToResolve, setSelectedReportToResolve] = useState(null);
  const [resolutionStatus, setResolutionStatus] = useState('RESOLVED');
  const [resolutionText, setResolutionText] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Sync state from storage whenever orgId or language changes
  const refreshCurrentOrg = (orgId = currentOrgId) => {
    const data = getLocalOrgData(orgId);
    setOrgData(data);
    // P0/P2 Fix: Ensure currentWorkerId belongs to this organization
    setCurrentWorkerId(prevId => {
      const stillBelongs = data.workers.some(w => w.id === prevId);
      return stillBelongs ? prevId : (data.workers[0]?.id || '');
    });
  };

  useEffect(() => {
    refreshCurrentOrg(currentOrgId);
  }, [currentOrgId, lang]);

  const { organization: currentOrg, workers, shifts, reports, fatigueAlerts: storedFatigueAlerts } = orgData;
  // Use the existing calculation engine's translated messages without changing its rules.
  const fatigueAlerts = lang === 'ta' ? storedFatigueAlerts.map(alert => ({
    ...alert,
    warnings: evaluateFatigueRisk(shifts.filter(s => s.workerId === alert.workerId && s.endTime), {
      maxDailyHours: currentOrg.settings.maxDailyHoursThreshold,
      minRestHours: currentOrg.settings.minRestHoursThreshold,
      maxWeeklyHours: currentOrg.settings.maxWeeklyHoursThreshold,
      lang
    }).warnings
  })) : storedFatigueAlerts;
  const currentWorker = workers.find(w => w.id === currentWorkerId) || workers[0];
  const activeShift = shifts.find(s => s.id === (currentWorker?.activeShiftId) || (s.workerId === currentWorker?.id && !s.endTime));
  const sym = currentOrg?.symbol || '₹';

  // Live elapsed counter
  useEffect(() => {
    if (!activeShift || !activeShift.startTime) {
      setLiveElapsedHours(0);
      return;
    }
    const updateTimer = () => {
      const start = new Date(activeShift.startTime).getTime();
      const diffMs = Date.now() - start;
      setLiveElapsedHours(Math.max(0, diffMs / (1000 * 60 * 60)));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeShift]);

  // Worker Check In Action (Guaranteed synchronous state persistence)
  const handleCheckIn = () => {
    if (!currentWorker) return;
    setActionLoading(true);
    try {
      localCheckIn(currentWorker.id, currentOrgId);
      refreshCurrentOrg(currentOrgId);
      showToast(lang === 'ta' ? 'பணி வெற்றிகரமாக தொடங்கியது!' : 'Checked in successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to check in', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Worker Check Out Action (Guaranteed synchronous state persistence & earnings calculation)
  const handleCheckOut = () => {
    if (!currentWorker) return;
    setActionLoading(true);
    try {
      const { earnings } = localCheckOut(currentWorker.id, 'Completed full scheduled duties');
      refreshCurrentOrg(currentOrgId);
      showToast(
        lang === 'ta'
          ? `பணி முடிந்தது! கணக்கிடப்பட்ட ஊதியம்: ${sym}${earnings.totalEstimatedEarnings}`
          : `Checked out successfully! Estimated Earnings: ${sym}${earnings.totalEstimatedEarnings}`,
        'success'
      );
    } catch (err) {
      showToast(err.message || 'Check out failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Safety Report Action
  const handleSubmitReport = (e) => {
    e.preventDefault();
    if (!reportTitle.trim() || !reportDescription.trim()) {
      showToast(lang === 'ta' ? 'புகாரின் தலைப்பு மற்றும் விவரத்தை வழங்கவும்.' : 'Please provide both an issue title and description.', 'error');
      return;
    }
    setActionLoading(true);
    try {
      localSubmitReport({
        workerId: currentWorker.id,
        orgId: currentOrgId,
        category: reportCategory,
        severity: reportSeverity,
        title: reportTitle,
        description: reportDescription
      });
      setReportTitle('');
      setReportDescription('');
      refreshCurrentOrg(currentOrgId);
      showToast(lang === 'ta' ? 'பாதுகாப்பு குறைபாடு பதிவு செய்யப்பட்டது!' : 'Safety concern submitted successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to submit report', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Supervisor Status Update Action
  const handleUpdateReportStatus = () => {
    if (!selectedReportToResolve) return;
    try {
      localUpdateReportStatus(selectedReportToResolve.id, resolutionStatus, resolutionText);
      setSelectedReportToResolve(null);
      setResolutionText('');
      refreshCurrentOrg(currentOrgId);
      showToast(lang === 'ta' ? 'புகாரின் நிலை மற்றும் தீர்வு குறிப்பு சேமிக்கப்பட்டது.' : 'Report status and resolution note saved.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update report', 'error');
    }
  };

  // Reset Demo Data
  const handleResetData = () => {
    setResetDialogOpen(true);
  };

  // Calculated Metrics for Worker View
  const liveEarnings = activeShift
    ? calculateShiftEarnings(
        liveElapsedHours,
        currentWorker?.hourlyRate || currentOrg.settings.defaultHourlyRate,
        currentOrg.settings.standardDailyHours,
        currentOrg.settings.overtimeMultiplier
      )
    : null;

  const workerPastShifts = shifts.filter(s => s.workerId === currentWorker?.id && s.endTime).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  const workerReports = reports.filter(r => r.workerId === currentWorker?.id);

  // Employer Aggregations
  const totalCompletedHours = shifts.filter(s => s.endTime).reduce((acc, s) => acc + (s.hours || 0), 0);
  const totalOvertimeHoursSum = shifts.filter(s => s.endTime).reduce((acc, s) => acc + (s.overtimeHours || 0), 0);
  const openReportsCount = reports.filter(r => r.status === 'OPEN' || r.status === 'IN_REVIEW').length;

  const storedState = getStoredState();
  const allOrgs = storedState.organizations || [];

  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const money = value => `${sym}${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const time = value => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const date = value => new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const statusLabel = status => ({ OPEN: t.statusOpen, IN_REVIEW: t.statusInReview, RESOLVED: t.statusResolved, DISMISSED: t.statusDismissed }[status] || status);
  const severityLabel = severity => ({ LOW: t.severityLow, MEDIUM: t.severityMedium, HIGH: t.severityHigh, CRITICAL: t.severityCritical, WARNING: t.severityHigh }[severity] || severity);
  const categoryLabel = category => ({ SAFETY_HAZARD: t.catSafetyHazard, EQUIPMENT_ISSUE: t.catEquipment, EXCESSIVE_FATIGUE: t.catExcessiveFatigue, CHEMICAL_EXPOSURE: t.catChemicalExposure, PAY_DISCREPANCY: t.catPayDiscrepancy, WORKPLACE_HARASSMENT: t.catWorkplaceHarassment }[category] || category);
  const priorityReports = [...reports].sort((a, b) => {
    const priority = r => (['OPEN', 'IN_REVIEW'].includes(r.status) ? 10 : 0) + ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[r.severity] || 0);
    return priority(b) - priority(a);
  });
  const criticalCount = reports.filter(r => ['OPEN', 'IN_REVIEW'].includes(r.status) && r.severity === 'CRITICAL').length;
  const personalFatigue = fatigueAlerts.find(a => a.workerId === currentWorker?.id);
  const workerRecordedPay = workerPastShifts.reduce((sum, s) => sum + (s.totalEstimatedEarnings || 0), 0);
  const contextKey = `${role}_${lang}_${currentOrgId}_${currentWorker?.id}`;

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    setSelectedReportToResolve(null);
    setReportTitle('');
    setReportDescription('');
  }, [currentOrgId, currentWorkerId, role]);

  return (
    <div className="app-shell" lang={lang}>
      <a className="skip-link" href="#main-content">{t.skipContent}</a>
      <header className="app-header">
        <div className="header-inner">
          <a href="#main-content" className="brand" aria-label="FairShift">
            <span className="brand-mark" aria-hidden="true"><Icon name="shield" size={25}/></span>
            <span><strong>FairShift<span className="brand-dot">.</span></strong><small>{t.brandPromise}</small></span>
          </a>
          <nav className="role-nav" aria-label={t.switchRole}>
            <button type="button" aria-pressed={role === 'worker'} onClick={() => setRole('worker')}>{t.workerRole}</button>
            <button type="button" aria-pressed={role === 'employer'} onClick={() => setRole('employer')}>{t.employerRole}</button>
          </nav>
          <div className="language-switch" aria-label={t.languageLabel} role="group">
            <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
            <button type="button" lang="ta" aria-pressed={lang === 'ta'} onClick={() => setLang('ta')}>தமிழ்</button>
          </div>
        </div>
      </header>

      <div className="workspace-bar">
        <div className="workspace-inner">
          <label className="org-select"><span>{t.activeOrg}</span><select value={currentOrgId} onChange={e => setCurrentOrgId(e.target.value)} aria-label={t.activeOrg}>{allOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <details className="demo-settings"><summary>{t.demoSettings}<Icon name="chevron" size={16}/></summary><div className="demo-popover"><p>{t.syntheticDataNote}</p><p>{t.roleDemoNotice}</p><p>{t.storageModeBadge}</p><button className="button button-secondary" type="button" onClick={handleResetData}><Icon name="reset" size={16}/>{t.resetDemoData}</button></div></details>
          <span className="demo-label">{t.demoShort}</span>
        </div>
      </div>

      <main id="main-content" className="page-content" tabIndex={-1}>
        <div className="page-heading">
          <div><p className="eyebrow">{role === 'worker' ? t.workerWorkspace : t.employerWorkspace}</p><h1>{role === 'worker' ? t.yourWorkday : t.operationsTitle}</h1><p className="muted">{role === 'worker' ? t.workdaySubtitle : currentOrg.industry}</p></div>
          {role === 'worker' ? <label className="worker-select"><span>{t.selectWorker}</span><select value={currentWorkerId} onChange={e => setCurrentWorkerId(e.target.value)} aria-label={t.selectWorker}>{workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label> : <span className="org-caption">{currentOrg.name}</span>}
        </div>

        <nav className="section-nav" aria-label={t.pageSections}>
          {role === 'worker' ? <><a href="#shift"><Icon name="clock" size={17}/>{t.todayShift}</a><a href="#history"><Icon name="history" size={17}/>{t.historyShort}</a><a href="#safety"><Icon name="shield" size={17}/>{t.safetyShort}</a></> : <><a href="#overview">{t.overviewShort}</a><a href="#concerns">{t.safetyShort}{openReportsCount > 0 && <span className="nav-count">{openReportsCount}</span>}</a><a href="#fatigue">{t.fatigueShort}</a></>}
          <a href="#assistant"><Icon name="help" size={17}/>{t.helpShort}</a>
        </nav>

        {role === 'worker' ? <>
          <div className="worker-top-grid">
            <section id="shift" className="shift-card" aria-labelledby="shift-title">
              <div className="shift-top"><span className={`shift-status ${activeShift ? 'is-active' : ''}`}><span className="status-dot"/>{activeShift ? t.onShift : t.offShift}</span><span className="shift-date">{date(Date.now())}</span></div>
              <h2 id="shift-title">{activeShift ? t.shiftInProgress : t.readyToBegin}</h2>
              <p className="shift-subtitle">{activeShift ? `${t.shiftStartedAt} ${time(activeShift.startTime)}` : t.startShiftHelp}</p>
              <div className="live-metrics"><div><span>{t.elapsedTime}</span><strong>{activeShift ? liveElapsedHours.toFixed(2) : '0.00'}<small> {t.hoursUnit}</small></strong></div><div><span>{t.estimatedLivePay}</span><strong className="pay-value">{money(liveEarnings?.totalEstimatedEarnings)}</strong></div></div>
              {liveEarnings?.isOvertime && <p className="overtime-live">{t.overtimeBadge} · {liveEarnings.overtimeHours.toFixed(2)} {t.hoursUnit} × {currentOrg.settings.overtimeMultiplier}</p>}
              <button type="button" className="button shift-action" onClick={activeShift ? handleCheckOut : handleCheckIn} disabled={actionLoading}><Icon name="clock"/>{actionLoading ? (activeShift ? t.checkingOut : t.checkingIn) : (activeShift ? t.checkOut : t.checkIn)}<Icon name="arrow"/></button>
              <p className="shift-save-note"><Icon name="check" size={14}/>{t.shiftSavedLocally}</p>
            </section>
            <aside className="worker-summary">
              <section className="card pay-card"><div className="section-heading"><h2>{t.yourPayAtGlance}</h2><Icon name="clock" size={18}/></div><p className="muted worker-role">{currentWorker?.name} · {currentWorker?.role}</p><dl className="pay-rules"><div><dt>{t.hourlyRateLabel}</dt><dd>{money(currentWorker?.hourlyRate)}<small> / {t.hourUnit}</small></dd></div><div><dt>{t.standardHoursLimit}</dt><dd>{currentOrg.settings.standardDailyHours} {t.hoursUnit}</dd></div><div><dt>{t.overtimeRate}</dt><dd>{currentOrg.settings.overtimeMultiplier}× <small>({money((currentWorker?.hourlyRate || 0) * currentOrg.settings.overtimeMultiplier)} / {t.hourUnit})</small></dd></div></dl><p className="info-note">{t.overtimeAfter} {currentOrg.settings.standardDailyHours} {t.hoursUnit}. {t.estimateNotice}</p></section>
              <a className="safety-shortcut" href="#safety"><span className="shortcut-icon"><Icon name="shield" size={22}/></span><span><strong>{t.speakUp}</strong><small>{t.safetyShortcutHelp}</small></span><Icon name="arrow" size={18}/></a>
            </aside>
          </div>
          {personalFatigue && <div className="notice notice-warning"><Icon name="warning"/><div><strong>{t.restReminder}</strong><p>{personalFatigue.warnings.map(w => w.message).join(' ')}</p></div></div>}
        </> : <>
          <section id="overview" className="metrics-grid" aria-label={t.employerDashboard}>
            <div className="metric-card"><span>{t.activeWorkers}</span><strong>{workers.length}</strong><small>{shifts.filter(s => !s.endTime).length} {t.currentlyOnShift}</small></div>
            <div className="metric-card"><span>{t.totalHoursWorked}</span><strong>{totalCompletedHours.toFixed(1)}<small> {t.hoursUnit}</small></strong><small>{t.completedShiftsOnly}</small></div>
            <div className="metric-card"><span>{t.totalOvertimeHours}</span><strong>{totalOvertimeHoursSum.toFixed(1)}<small> {t.hoursUnit}</small></strong><small>{currentOrg.settings.overtimeMultiplier}× {t.overtimeRate.toLowerCase()}</small></div>
            <a href="#concerns" className={`metric-card ${criticalCount ? 'metric-alert' : ''}`}><span>{t.pendingConcerns}</span><strong>{openReportsCount}</strong><small>{criticalCount} {t.criticalNeedAction} <Icon name="arrow" size={14}/></small></a>
          </section>
          {criticalCount > 0 && <a className="notice notice-danger" href="#concerns"><Icon name="warning"/><div><strong>{t.safetyNeedsAttention}</strong><p>{criticalCount} {t.criticalNeedAction}. {t.reviewSafetyHelp}</p></div><Icon name="arrow"/></a>}
        </>}

        <AssistantWidget key={contextKey} role={role} lang={lang} org={currentOrg} worker={currentWorker} workers={workers} shifts={shifts} reports={reports} t={t}/>

        {role === 'worker' ? <>
          <section id="history" className="card history-card" aria-labelledby="history-title"><div className="section-heading"><div><p className="eyebrow">{t.yourRecords}</p><h2 id="history-title">{t.recentShifts}</h2></div><div className="history-total"><span>{t.recordedEstimatedPay}</span><strong>{money(workerRecordedPay)}</strong></div></div>
            {workerPastShifts.length === 0 ? <p className="empty-state">{t.noShiftsRecorded}</p> : <div className="shift-list">{workerPastShifts.map(s => <article key={s.id} className="shift-row"><div className="shift-row-date"><span className="date-icon"><Icon name="history"/></span><div><h3>{date(s.startTime)}</h3><p>{time(s.startTime)} – {time(s.endTime)}</p></div></div><div className="shift-breakdown"><p><strong>{s.hours} {t.hoursUnit}</strong> · {t.regularHours}: {s.regularHours}h</p><p>{t.regularPay}: {money(s.regularPay)}{s.overtimeHours > 0 && <span className="ot-detail"> · {t.overtimeHours}: {s.overtimeHours}h ({money(s.overtimePay)})</span>}</p></div><div className="shift-row-pay"><strong>{money(s.totalEstimatedEarnings)}</strong><small>{s.overtimeHours > 0 ? t.overtimeBadge : t.totalEstimatedEarnings}</small></div></article>)}</div>}
          </section>
          <div id="safety" className="safety-grid">
            <section className="card" aria-labelledby="report-title"><div className="section-heading"><div><p className="eyebrow">{t.workerSafety}</p><h2 id="report-title">{t.reportSafetyIssue}</h2></div><Icon name="shield"/></div><p className="muted section-description">{t.reportDescriptionHelp}</p>
              <form onSubmit={handleSubmitReport} className="report-form"><div><label htmlFor="issue-title-input">{t.issueTitle} <span aria-hidden="true">*</span></label><input id="issue-title-input" type="text" required maxLength={180} value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder={t.titlePlaceholder}/></div><div className="form-columns"><div><label htmlFor="issue-category-select">{t.issueCategory}</label><select id="issue-category-select" value={reportCategory} onChange={e => setReportCategory(e.target.value)}>{['SAFETY_HAZARD','EQUIPMENT_ISSUE','EXCESSIVE_FATIGUE','CHEMICAL_EXPOSURE','PAY_DISCREPANCY','WORKPLACE_HARASSMENT'].map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div><div><label htmlFor="issue-severity-select">{t.severity}</label><select id="issue-severity-select" value={reportSeverity} onChange={e => setReportSeverity(e.target.value)}>{['LOW','MEDIUM','HIGH','CRITICAL'].map(s => <option key={s} value={s}>{severityLabel(s)}</option>)}</select></div></div><div><label htmlFor="issue-description-input">{t.description} <span aria-hidden="true">*</span></label><textarea id="issue-description-input" required rows={4} value={reportDescription} onChange={e => setReportDescription(e.target.value)} placeholder={t.descriptionPlaceholder} aria-describedby="report-privacy"/></div><p id="report-privacy" className="form-help">{t.confidentialNotice}</p><button type="submit" className="button button-primary" disabled={actionLoading}>{actionLoading ? t.submittingReport : t.submitReport}<Icon name="arrow" size={18}/></button></form>
            </section>
            <section className="card" aria-labelledby="my-reports-title"><div className="section-heading"><div><p className="eyebrow">{t.followThrough}</p><h2 id="my-reports-title">{t.myReports}</h2></div><span className="count-label">{workerReports.length}</span></div>{workerReports.length === 0 ? <p className="empty-state">{t.noReportsYet}</p> : <div className="report-list">{workerReports.map(r => <article className="personal-report" key={r.id}><div className="report-meta"><span className={`status-label status-${r.status.toLowerCase()}`}>{statusLabel(r.status)}</span><time>{date(r.submittedAt)}</time></div><h3>{r.title}</h3><p>{r.description}</p>{r.resolutionNote && <div className="resolution-note"><strong>{t.resolutionNotes}</strong><p>{r.resolutionNote}</p></div>}<small>{categoryLabel(r.category)}</small></article>)}</div>}</section>
          </div>
        </> : <div className="operations-grid">
          <section id="concerns" className="card" aria-labelledby="concerns-title"><div className="section-heading"><div><p className="eyebrow">{t.actionQueue}</p><h2 id="concerns-title">{t.manageReports}</h2></div><Icon name="shield"/></div><p className="muted section-description">{t.priorityExplanation}</p>{priorityReports.length === 0 ? <p className="empty-state">{t.noOrgReports}</p> : <div className="report-list">{priorityReports.map(rep => <article className="employer-report" key={rep.id}><div className="report-meta"><span className={`severity-label severity-${rep.severity.toLowerCase()}`}>{severityLabel(rep.severity)}</span><span className={`status-label status-${rep.status.toLowerCase()}`}>{statusLabel(rep.status)}</span></div><h3>{rep.title}</h3><p>{rep.description}</p><p className="report-byline">{rep.workerName} · {date(rep.submittedAt)}</p><small>{categoryLabel(rep.category)}</small>{rep.resolutionNote && <div className="resolution-note"><strong>{t.resolutionNotes}</strong><p>{rep.resolutionNote}</p></div>}<button type="button" className="button button-secondary" onClick={() => { setSelectedReportToResolve(rep); setResolutionStatus(rep.status === 'RESOLVED' ? 'IN_REVIEW' : 'RESOLVED'); setResolutionText(rep.resolutionNote || ''); }}>{t.updateStatus}<Icon name="arrow" size={16}/></button></article>)}</div>}</section>
          <div className="operations-side"><section id="fatigue" className="card" aria-labelledby="fatigue-title"><div className="section-heading"><div><p className="eyebrow">{t.prevention}</p><h2 id="fatigue-title">{t.fatigueRiskAlerts}</h2></div><span className="count-label">{fatigueAlerts.length}</span></div><p className="muted section-description">{t.fatigueAlertSummary}</p>{fatigueAlerts.length === 0 ? <p className="notice notice-success">{t.noFatigueAlerts}</p> : <div className="fatigue-list">{fatigueAlerts.map((alert, idx) => <article className="fatigue-item" key={idx}><div className="report-meta"><strong>{alert.workerName}</strong><span className="severity-label severity-high">{severityLabel(alert.riskLevel)}</span></div><p className="muted">{alert.role}</p><ul>{alert.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul><p className="rolling-hours">{t.rollingWork}: <strong>{alert.totalHoursLast7Days} {t.hoursUnit}</strong></p></article>)}</div>}</section><section className="card work-rules"><h2>{t.orgConfigTitle}</h2><dl className="pay-rules"><div><dt>{t.dailyThreshold}</dt><dd>{currentOrg.settings.standardDailyHours}h</dd></div><div><dt>{t.otMultiplier}</dt><dd>{currentOrg.settings.overtimeMultiplier}×</dd></div><div><dt>{t.maxDailyThreshold}</dt><dd>{currentOrg.settings.maxDailyHoursThreshold}h</dd></div><div><dt>{t.minRestInterval}</dt><dd>{currentOrg.settings.minRestHoursThreshold}h</dd></div></dl></section></div>
        </div>}
      </main>
      <footer className="app-footer"><div><strong>FairShift.</strong><span>{t.sdgBadge}</span></div><p>{t.syntheticDataNote} · {t.storageModeBadge}</p><p>{t.disclaimer}</p></footer>
      {toast && <div className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`} role={toast.type === 'error' ? 'alert' : 'status'}><Icon name={toast.type === 'error' ? 'warning' : 'check'}/><span>{toast.message}</span><button type="button" aria-label={t.dismiss} onClick={() => setToast(null)}>×</button></div>}
      {selectedReportToResolve && <ResolutionDialog report={selectedReportToResolve} t={t} status={resolutionStatus} setStatus={setResolutionStatus} note={resolutionText} setNote={setResolutionText} onClose={() => setSelectedReportToResolve(null)} onSave={handleUpdateReportStatus}/>}
      {resetDialogOpen && <ResetDialog t={t} lang={lang} onClose={() => setResetDialogOpen(false)} onReset={() => { resetStoredState(); refreshCurrentOrg(currentOrgId); setResetDialogOpen(false); showToast(t.demoResetSuccess); }}/>}
    </div>
  );
}

function ResolutionDialog({ report, t, status, setStatus, note, setNote, onClose, onSave }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={dialogRef} className="resolution-dialog" aria-labelledby="modal-status-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><form onSubmit={e => { e.preventDefault(); onSave(); }}><div className="section-heading"><h2 id="modal-status-title">{t.updateStatus}</h2><button className="close-button" type="button" aria-label={t.cancel} onClick={onClose}>×</button></div><p className="muted">{report.title}</p><div><label htmlFor="resolve-status-select">{t.status}</label><select autoFocus id="resolve-status-select" value={status} onChange={e => setStatus(e.target.value)}><option value="OPEN">{t.statusOpen}</option><option value="IN_REVIEW">{t.statusInReview}</option><option value="RESOLVED">{t.statusResolved}</option><option value="DISMISSED">{t.statusDismissed}</option></select></div><div><label htmlFor="resolve-notes-textarea">{t.addResolutionNote}</label><textarea id="resolve-notes-textarea" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder={t.resolutionPlaceholder}/></div><div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onClose}>{t.cancel}</button><button className="button button-primary" type="submit">{t.saveUpdate}</button></div></form></dialog>;
}

function ResetDialog({ t, lang, onClose, onReset }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className="resolution-dialog" aria-labelledby="reset-title" onCancel={onClose}><div className="report-form"><h2 id="reset-title">{t.resetDemoData}</h2><p>{lang === 'ta' ? 'அனைத்து மாதிரி பணிப் பதிவுகளையும் புகார்களையும் ஆரம்ப நிலைக்கு மீட்டமைக்கவா?' : 'Reset all demonstration shifts and safety records to their initial state? Your changes in this browser will be removed.'}</p><div className="dialog-actions"><button type="button" className="button button-secondary" autoFocus onClick={onClose}>{t.cancel}</button><button type="button" className="button button-primary" onClick={onReset}>{t.resetDemoData}</button></div></div></dialog>;
}
