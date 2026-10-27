import React, { useState, useEffect } from 'react';
import { translations } from '../shared/i18n.js';
import { calculateShiftEarnings, calculateDurationHours, DISCLAIMER_TEXT } from '../shared/calculations.js';
import { INITIAL_DATA } from '../shared/seedData.js';

export default function App() {
  const [lang, setLang] = useState('en');
  const t = translations[lang] || translations.en;

  // Global State
  const [orgs, setOrgs] = useState(INITIAL_DATA.organizations);
  const [currentOrgId, setCurrentOrgId] = useState('org-buildright');
  const [role, setRole] = useState('worker'); // 'worker' or 'employer'
  
  const [workers, setWorkers] = useState([]);
  const [currentWorkerId, setCurrentWorkerId] = useState('');
  const [shifts, setShifts] = useState([]);
  const [reports, setReports] = useState([]);
  const [fatigueAlerts, setFatigueAlerts] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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

  // Load organization data from API with fallback to local seed
  const fetchData = async (orgId) => {
    try {
      const res = await fetch(`/api/org/${orgId}/data`);
      if (res.ok) {
        const data = await res.json();
        setWorkers(data.workers || []);
        setShifts(data.shifts || []);
        setReports(data.reports || []);
        setFatigueAlerts(data.fatigueAlerts || []);
        if (data.workers && data.workers.length > 0 && !currentWorkerId) {
          setCurrentWorkerId(data.workers[0].id);
        }
      } else {
        fallbackLocalData(orgId);
      }
    } catch (err) {
      fallbackLocalData(orgId);
    } finally {
      setLoading(false);
    }
  };

  const fallbackLocalData = (orgId) => {
    const orgWorkers = INITIAL_DATA.workers.filter(w => w.orgId === orgId);
    setWorkers(orgWorkers);
    setShifts(INITIAL_DATA.shifts.filter(s => s.orgId === orgId));
    setReports(INITIAL_DATA.reports.filter(r => r.orgId === orgId));
    if (orgWorkers.length > 0) setCurrentWorkerId(orgWorkers[0].id);
  };

  useEffect(() => {
    fetchData(currentOrgId);
  }, [currentOrgId]);

  // Handle active worker switch
  const currentWorker = workers.find(w => w.id === currentWorkerId) || workers[0];
  const activeShift = shifts.find(s => s.id === (currentWorker?.activeShiftId) || (s.workerId === currentWorker?.id && !s.endTime));
  const currentOrg = orgs.find(o => o.id === currentOrgId) || orgs[0];

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

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Worker Check In Action
  const handleCheckIn = async () => {
    if (!currentWorker) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/shifts/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId: currentWorker.id, orgId: currentOrgId })
      });
      if (res.ok) {
        showToast(lang === 'ta' ? 'பணி வெற்றிகரமாக தொடங்கியது!' : 'Checked in successfully!');
        await fetchData(currentOrgId);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to check in');
      }
    } catch {
      // Local fallback simulation
      const newShift = {
        id: `sh-${Date.now()}`,
        orgId: currentOrgId,
        workerId: currentWorker.id,
        workerName: currentWorker.name,
        startTime: new Date().toISOString(),
        endTime: null,
        hours: 0,
        hourlyRate: currentWorker.hourlyRate,
        regularHours: 0,
        overtimeHours: 0,
        regularPay: 0,
        overtimePay: 0,
        totalEstimatedEarnings: 0
      };
      setShifts([newShift, ...shifts]);
      currentWorker.activeShiftId = newShift.id;
      showToast('Checked in (Local mode)');
    } finally {
      setActionLoading(false);
    }
  };

  // Worker Check Out Action
  const handleCheckOut = async () => {
    if (!currentWorker) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/shifts/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId: currentWorker.id, notes: 'Completed full scheduled duties' })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(lang === 'ta' ? `பணி முடிந்தது! ஈட்டிய ஊதியம்: $${data.earnings?.totalEstimatedEarnings}` : `Checked out! Estimated Earnings: $${data.earnings?.totalEstimatedEarnings}`);
        await fetchData(currentOrgId);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to check out');
      }
    } catch {
      showToast('Check out recorded');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Safety Report
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportTitle.trim() || !reportDescription.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: currentWorker.id,
          orgId: currentOrgId,
          category: reportCategory,
          severity: reportSeverity,
          title: reportTitle,
          description: reportDescription
        })
      });
      if (res.ok) {
        setReportTitle('');
        setReportDescription('');
        showToast(lang === 'ta' ? 'புகார் பதிவு செய்யப்பட்டது!' : 'Safety concern submitted successfully!');
        await fetchData(currentOrgId);
      }
    } catch {
      showToast('Report submitted (Local mode)');
    } finally {
      setActionLoading(false);
    }
  };

  // Supervisor Status Update
  const handleUpdateReportStatus = async () => {
    if (!selectedReportToResolve) return;
    try {
      const res = await fetch(`/api/reports/${selectedReportToResolve.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolutionStatus,
          resolutionNote: resolutionText
        })
      });
      if (res.ok) {
        showToast('Report status updated successfully.');
        setSelectedReportToResolve(null);
        setResolutionText('');
        await fetchData(currentOrgId);
      }
    } catch {
      showToast('Updated report status');
    }
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

  const workerPastShifts = shifts.filter(s => s.workerId === currentWorker?.id && s.endTime);
  const workerReports = reports.filter(r => r.workerId === currentWorker?.id);

  // Employer Aggregations
  const totalCompletedHours = shifts.filter(s => s.endTime).reduce((acc, s) => acc + (s.hours || 0), 0);
  const totalOvertimeHoursSum = shifts.filter(s => s.endTime).reduce((acc, s) => acc + (s.overtimeHours || 0), 0);
  const openReportsCount = reports.filter(r => r.status === 'OPEN' || r.status === 'IN_REVIEW').length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 font-sans">
      {/* Top Banner / Notice */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded mb-4 flex flex-wrap justify-between items-center text-xs text-amber-900 gap-2">
        <div className="flex items-center space-x-2">
          <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wide">
            {t.syntheticDataNote}
          </span>
          <span>{t.disclaimer}</span>
        </div>
        <div className="font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
          {t.sdgBadge}
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-md">
              FS
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t.appName}</h1>
              <p className="text-xs text-slate-500">{t.tagline}</p>
            </div>
          </div>
        </div>

        {/* Global Controls: Language, Organization, Role */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Language Switch */}
          <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-100 text-xs font-medium">
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 rounded-md transition ${lang === 'en' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600'}`}
            >
              English
            </button>
            <button
              onClick={() => setLang('ta')}
              className={`px-2.5 py-1 rounded-md transition ${lang === 'ta' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-600'}`}
            >
              தமிழ் (Tamil)
            </button>
          </div>

          {/* Org Selector */}
          <select
            value={currentOrgId}
            onChange={(e) => {
              setCurrentOrgId(e.target.value);
              setLoading(true);
            }}
            className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700 shadow-sm focus:border-emerald-500"
          >
            {orgs.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>

          {/* Role Switcher */}
          <div className="inline-flex rounded-lg border border-slate-300 p-1 bg-white text-xs font-bold">
            <button
              onClick={() => setRole('worker')}
              className={`px-3 py-1.5 rounded-md transition ${role === 'worker' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
            >
              👷 {t.workerRole}
            </button>
            <button
              onClick={() => setRole('employer')}
              className={`px-3 py-1.5 rounded-md transition ${role === 'employer' ? 'bg-slate-900 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
            >
              🏢 {t.employerRole}
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 text-sm border border-slate-700 animate-bounce">
          <span className="text-emerald-400">✔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WORKER VIEW (Mobile-First, Large Targets, Tamil Capable) */}
      {/* ========================================================================= */}
      {role === 'worker' && (
        <div className="space-y-6">
          {/* Worker Identity Strip */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.selectWorker}</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="font-bold text-slate-800 text-lg">{currentWorker?.name}</span>
                <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {currentWorker?.role}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={currentWorkerId}
                onChange={(e) => setCurrentWorkerId(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-700 font-medium w-full sm:w-auto"
              >
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.role})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Module 1: Live Shift Check In / Out Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-slate-700">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800">
                  {t.activeShift}
                </span>
                <h2 className="text-xl sm:text-2xl font-black mt-3">
                  {activeShift ? t.shiftStartedAt + ' ' + new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t.noActiveShift}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">{t.hourlyRateLabel}</div>
                <div className="text-lg font-bold text-emerald-400">
                  ${currentWorker?.hourlyRate?.toFixed(2)}/hr
                </div>
              </div>
            </div>

            {/* Live Counter Display */}
            {activeShift && (
              <div className="grid grid-cols-2 gap-4 my-6 bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
                <div>
                  <div className="text-xs text-slate-400">{t.elapsedTime}</div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-white mt-1">
                    {liveElapsedHours.toFixed(2)} <span className="text-sm font-sans text-slate-400">hrs</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">{t.estimatedLivePay}</div>
                  <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400 mt-1">
                    ${liveEarnings?.totalEstimatedEarnings?.toFixed(2)}
                  </div>
                  {liveEarnings?.isOvertime && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/40 mt-1 inline-block">
                      {t.overtimeBadge} ({liveEarnings.overtimeHours.toFixed(1)}h)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Check In / Check Out Touch Targets */}
            <div className="mt-6">
              {!activeShift ? (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] transition rounded-2xl font-black text-lg text-slate-950 shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2"
                >
                  <span className="text-2xl">⏱</span>
                  <span>{actionLoading ? t.checkingIn : t.checkIn}</span>
                </button>
              ) : (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="w-full py-4 px-6 bg-rose-500 hover:bg-rose-400 active:scale-[0.99] transition rounded-2xl font-black text-lg text-white shadow-lg shadow-rose-500/20 flex items-center justify-center space-x-2"
                >
                  <span className="text-2xl">🛑</span>
                  <span>{actionLoading ? t.checkingOut : t.checkOut}</span>
                </button>
              )}
            </div>
          </div>

          {/* Module 1: Shift & Earnings History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <span>📅</span>
              <span>{t.recentShifts}</span>
            </h3>

            {workerPastShifts.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">{t.noShiftsRecorded}</p>
            ) : (
              <div className="space-y-3">
                {workerPastShifts.map((s) => (
                  <div key={s.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-500">
                        {new Date(s.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="font-semibold text-slate-800 text-sm mt-0.5">
                        {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="ml-2 font-mono text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                          {s.hours} hrs
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {t.regularHours}: {s.regularHours}h (${s.regularPay})
                        {s.overtimeHours > 0 && (
                          <span className="ml-2 text-amber-700 font-semibold">
                            | {t.overtimeHours}: {s.overtimeHours}h (${s.overtimePay})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">{t.totalEstimatedEarnings}</div>
                      <div className="text-lg font-black text-slate-900 font-mono">
                        ${s.totalEstimatedEarnings?.toFixed(2)}
                      </div>
                      {s.overtimeHours > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                          {t.overtimeBadge}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Module 2: Safety & Grievance Reporting (Worker) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center space-x-2">
                <span>🛡️</span>
                <span>{t.reportSafetyIssue}</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4">{t.reportDescriptionHelp}</p>

              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.issueTitle} *</label>
                  <input
                    type="text"
                    required
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    placeholder="e.g. Broken ladder hinge on 2nd floor"
                    className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.issueCategory}</label>
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white"
                    >
                      <option value="SAFETY_HAZARD">{t.catSafetyHazard}</option>
                      <option value="EQUIPMENT_ISSUE">{t.catEquipment}</option>
                      <option value="EXCESSIVE_FATIGUE">{t.catExcessiveFatigue}</option>
                      <option value="CHEMICAL_EXPOSURE">{t.catChemicalExposure}</option>
                      <option value="PAY_DISCREPANCY">{t.catPayDiscrepancy}</option>
                      <option value="WORKPLACE_HARASSMENT">{t.catWorkplaceHarassment}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t.severity}</label>
                    <select
                      value={reportSeverity}
                      onChange={(e) => setReportSeverity(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold"
                    >
                      <option value="LOW">🟢 {t.severityLow}</option>
                      <option value="MEDIUM">🟡 {t.severityMedium}</option>
                      <option value="HIGH">🟠 {t.severityHigh}</option>
                      <option value="CRITICAL">🔴 {t.severityCritical}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.description} *</label>
                  <textarea
                    rows={3}
                    required
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Provide specific details, exact location, and hazards present..."
                    className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:border-emerald-500"
                  />
                </div>

                <p className="text-[11px] text-slate-400 italic">
                  {t.confidentialNotice}
                </p>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white rounded-xl font-bold text-sm transition"
                >
                  {actionLoading ? t.submittingReport : t.submitReport}
                </button>
              </form>
            </div>

            {/* Worker's Past Submitted Reports */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center space-x-2">
                <span>📋</span>
                <span>{t.myReports}</span>
              </h3>

              {workerReports.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm py-10">
                  {t.noReportsYet}
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
                  {workerReports.map((r) => (
                    <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-slate-900 text-sm leading-snug">{r.title}</h4>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          r.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' :
                          r.status === 'IN_REVIEW' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">{r.description}</p>
                      
                      {/* Resolution note from supervisor if present */}
                      {r.resolutionNote && (
                        <div className="bg-emerald-50 border-l-2 border-emerald-500 p-2 text-xs rounded text-emerald-950 mt-2">
                          <span className="font-bold">{t.resolutionNotes}: </span>
                          {r.resolutionNote}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span>{new Date(r.submittedAt).toLocaleDateString()}</span>
                        <span className="font-semibold text-slate-500">{r.category}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EMPLOYER VIEW (Operations, Fatigue Monitoring & Report Resolution) */}
      {/* ========================================================================= */}
      {role === 'employer' && (
        <div className="space-y-6">
          {/* Operations Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.employerDashboard}</span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">{currentOrg.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{currentOrg.industry}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-600">Standard Shift: {currentOrg.settings.standardDailyHours}h</span>
                <span className="text-slate-300">|</span>
                <span className="text-xs font-semibold text-slate-600">OT Multiplier: {currentOrg.settings.overtimeMultiplier}x</span>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-xs font-semibold text-slate-500">{t.activeWorkers}</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{workers.length}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-xs font-semibold text-slate-500">{t.totalHoursWorked}</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{totalCompletedHours.toFixed(1)} <span className="text-xs font-normal">hrs</span></div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-xs font-semibold text-amber-700">{t.totalOvertimeHours}</div>
                <div className="text-2xl font-black text-amber-600 mt-1 font-mono">{totalOvertimeHoursSum.toFixed(1)} <span className="text-xs font-normal">hrs</span></div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-xs font-semibold text-rose-700">{t.pendingConcerns}</div>
                <div className="text-2xl font-black text-rose-600 mt-1">{openReportsCount}</div>
              </div>
            </div>
          </div>

          {/* Module 3: Rule-Based Fatigue & Excessive Hours Warnings */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                  <span>⚠️</span>
                  <span>{t.fatigueRiskAlerts}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{t.fatigueAlertSummary}</p>
              </div>
              <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                Limits: &gt;{currentOrg.settings.maxDailyHoursThreshold}h/day, &lt;{currentOrg.settings.minRestHoursThreshold}h rest
              </span>
            </div>

            {fatigueAlerts.length === 0 ? (
              <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-200 text-sm flex items-center space-x-2">
                <span>✔</span>
                <span>{t.noFatigueAlerts}</span>
              </div>
            ) : (
              <div className="space-y-3">
                {fatigueAlerts.map((alert, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-rose-200 bg-rose-50/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-rose-950 text-sm">{alert.workerName}</span>
                        <span className="text-xs text-rose-700 font-medium">({alert.role})</span>
                        <span className="text-[10px] font-black uppercase bg-rose-200 text-rose-900 px-2 py-0.5 rounded">
                          {alert.riskLevel}
                        </span>
                      </div>
                      <div className="text-xs text-rose-800 mt-1 space-y-1">
                        {alert.warnings.map((w, wIdx) => (
                          <div key={wIdx} className="flex items-start space-x-1">
                            <span>•</span>
                            <span>{w.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-rose-600 font-semibold">7-Day Rolling Work</div>
                      <div className="font-mono font-bold text-rose-950 text-base">{alert.totalHoursLast7Days} hrs</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Module 2: Employer Safety Concern & Grievance Management */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <span>🛠️</span>
              <span>{t.manageReports}</span>
            </h3>

            {reports.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No reports logged for this organization.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {reports.map((rep) => (
                  <div key={rep.id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 text-base">{rep.title}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          rep.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' :
                          rep.severity === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {rep.severity}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          rep.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {rep.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{rep.description}</p>
                      <div className="text-[11px] text-slate-400 flex items-center space-x-3 pt-1">
                        <span>Reported by: <strong className="text-slate-600">{rep.workerName}</strong></span>
                        <span>•</span>
                        <span>{new Date(rep.submittedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{rep.category}</span>
                      </div>
                      {rep.resolutionNote && (
                        <div className="bg-slate-50 p-2 rounded text-xs text-slate-700 border-l-2 border-emerald-500 mt-2">
                          <strong>Resolution Note:</strong> {rep.resolutionNote}
                        </div>
                      )}
                    </div>

                    <div className="w-full md:w-auto">
                      <button
                        onClick={() => {
                          setSelectedReportToResolve(rep);
                          setResolutionStatus(rep.status === 'RESOLVED' ? 'IN_REVIEW' : 'RESOLVED');
                          setResolutionText(rep.resolutionNote || '');
                        }}
                        className="w-full md:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200"
                      >
                        {t.updateStatus}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supervisor Resolution Modal */}
      {selectedReportToResolve && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-lg text-slate-900">{t.updateStatus}</h3>
            <p className="text-xs text-slate-600 font-medium">{selectedReportToResolve.title}</p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.status}</label>
              <select
                value={resolutionStatus}
                onChange={(e) => setResolutionStatus(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white font-semibold"
              >
                <option value="OPEN">{t.statusOpen}</option>
                <option value="IN_REVIEW">{t.statusInReview}</option>
                <option value="RESOLVED">{t.statusResolved}</option>
                <option value="DISMISSED">{t.statusDismissed}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.addResolutionNote}</label>
              <textarea
                rows={3}
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                placeholder="Document safety action taken, maintenance dispatched, or worker notification..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setSelectedReportToResolve(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateReportStatus}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow"
              >
                {t.saveUpdate}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400 space-y-2">
        <p>FairShift 2026 — Addressing United Nations Sustainable Development Goal 8 (Decent Work and Economic Growth).</p>
        <p className="text-[11px] text-slate-400">All data displayed is synthetic and created exclusively for hackathon evaluation.</p>
      </footer>
    </div>
  );
}
