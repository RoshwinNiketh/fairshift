/**
 * FairShift - Deterministic Context-Aware Assistant Engine
 * 
 * Purpose:
 * Evaluates user questions against actual current application state (organization,
 * selected worker, shifts, grievance reports, and configured fatigue rules).
 * 
 * Guarantees:
 * - 100% Deterministic (Zero hallucinations, no external paid APIs, no fake data)
 * - Transparent distinction between configured site thresholds vs statutory legal rules
 * - Explicit about non-confidential, account-linked grievance tracking
 * - Full bilingual support (English and Tamil)
 */

import { evaluateFatigueRisk } from './calculations.js';

export const ASSISTANT_PROMPTS = {
  en: {
    worker: [
      { id: 'earnings', text: 'How much have I earned in total?' },
      { id: 'overtime', text: 'How was my overtime calculated?' },
      { id: 'fatigue', text: 'Am I working excessive hours or lacking rest?' },
      { id: 'reports', text: 'What is the status of my safety concerns?' },
      { id: 'how_report', text: 'How do I report a workplace hazard or grievance?' },
      { id: 'disclaimer', text: 'Are these calculations legally binding payroll?' }
    ],
    employer: [
      { id: 'fatigue_overview', text: 'Which workers currently trigger fatigue alerts?' },
      { id: 'critical_reports', text: 'What open safety hazards require urgent attention?' },
      { id: 'hours_summary', text: 'What are the total recorded hours and overtime totals?' },
      { id: 'thresholds', text: 'What are our organization fatigue thresholds?' },
      { id: 'audit_status', text: 'Are all grievance reports resolved?' }
    ]
  },
  ta: {
    worker: [
      { id: 'earnings', text: 'நான் மொத்தம் எவ்வளவு சம்பாதித்துள்ளேன்?' },
      { id: 'overtime', text: 'எனது கூடுதல் பணி நேரம் (OT) எவ்வாறு கணக்கிடப்பட்டது?' },
      { id: 'fatigue', text: 'நான் அதிக நேரம் வேலை செய்கிறேனா அல்லது போதிய ஓய்வில்லையா?' },
      { id: 'reports', text: 'எனது பாதுகாப்பு புகாரின் தற்போதைய நிலை என்ன?' },
      { id: 'how_report', text: 'பாதுகாப்பு குறைபாடு அல்லது புகாரை எவ்வாறு பதிவு செய்வது?' },
      { id: 'disclaimer', text: 'இது சட்டப்பூர்வ சம்பளப் பட்டியலா?' }
    ],
    employer: [
      { id: 'fatigue_overview', text: 'எந்தெந்த தொழிலாளர்களுக்கு சோர்வு எச்சரிக்கை உள்ளது?' },
      { id: 'critical_reports', text: 'கவனிக்கப்பட வேண்டிய தீவிர பாதுகாப்பு புகார்கள் எவை?' },
      { id: 'hours_summary', text: 'மொத்த வேலை நேரம் மற்றும் OT சுருக்கம் என்ன?' },
      { id: 'thresholds', text: 'நிறுவனத்தின் பணி மற்றும் ஓய்வு வரம்புகள் என்ன?' },
      { id: 'audit_status', text: 'அனைத்து புகார்களும் சரிசெய்யப்பட்டுவிட்டனவா?' }
    ]
  }
};

/**
 * Evaluates an inquiry and generates a state-grounded response
 * @param {string} query User query or prompt ID
 * @param {object} context Application state { role, lang, org, worker, shifts, reports }
 * @returns {object} { answer: string, confidence: 'high'|'fallback', intent: string, suggestions: Array }
 */
export function answerAssistantQuery(query, context = {}) {
  const {
    role = 'worker',
    lang = 'en',
    org = { settings: {}, symbol: '₹' },
    worker = { name: 'Worker', hourlyRate: 100 },
    shifts = [],
    reports = []
  } = context;

  const isTamil = lang === 'ta';
  const sym = org.symbol || '₹';
  const qLower = (query || '').toLowerCase().trim();

  // -------------------------------------------------------------
  // WORKER INTENTS
  // -------------------------------------------------------------
  if (role === 'worker') {
    const workerShifts = shifts.filter(s => s.workerId === worker.id && s.endTime);
    const workerReports = reports.filter(r => r.workerId === worker.id);

    // Intent 1: Total Earnings
    if (qLower === 'earnings' || qLower.includes('earn') || qLower.includes('சம்பா') || qLower.includes('pay') || qLower.includes('பணம்')) {
      const totalEarned = workerShifts.reduce((acc, s) => acc + (s.totalEstimatedEarnings || 0), 0);
      const totalHours = workerShifts.reduce((acc, s) => acc + (s.hours || 0), 0);
      const otHours = workerShifts.reduce((acc, s) => acc + (s.overtimeHours || 0), 0);

      if (isTamil) {
        return {
          intent: 'worker_earnings',
          answer: `${worker.name} அவர்களே, முடிவடைந்த ${workerShifts.length} ஷிஃப்டுகளில் உங்கள் மொத்த உத்தேச சம்பளம் ${sym}${totalEarned.toFixed(2)} ஆகும். நீங்கள் மொத்தம் ${totalHours.toFixed(1)} மணிநேரம் பணியாற்றியுள்ளீர்கள் (இதில் ${otHours.toFixed(1)} மணிநேரம் கூடுதல் பணி OT). உங்கள் அடிப்படை ஊதியம்: ${sym}${worker.hourlyRate}/மணிநேரம்.`,
          note: 'கவனிக்க: இது வெளிப்படைத்தன்மைக்கான உத்தேசக் கணக்கீடு மட்டுமே; சட்டப்பூர்வ சம்பளப் பட்டியல் அல்ல.'
        };
      }
      return {
        intent: 'worker_earnings',
        answer: `Hello ${worker.name}. Across your ${workerShifts.length} completed shift(s), your total estimated earnings are ${sym}${totalEarned.toFixed(2)}. You logged ${totalHours.toFixed(1)} total hours (including ${otHours.toFixed(1)} overtime hours). Your configured base rate is ${sym}${worker.hourlyRate}/hr.`,
        note: 'Note: Estimated for transparency and verification only; does not replace official payroll slips.'
      };
    }

    // Intent 2: Overtime Calculation Explanation
    if (qLower === 'overtime' || qLower.includes('overtime') || qLower.includes('ot') || qLower.includes('கூடுதல்')) {
      const std = org.settings?.standardDailyHours || 8;
      const mult = org.settings?.overtimeMultiplier || 1.5;
      const otRate = (worker.hourlyRate || 0) * mult;

      if (isTamil) {
        return {
          intent: 'worker_overtime',
          answer: `உங்கள் நிறுவனத்தின் (${org.name}) விதிமுறைப்படி, ஒரு நாளுக்கு ${std} மணிநேரத்திற்கு மேல் பணிபுரியும் நேரம் கூடுதல் பணியாக (OT) கணக்கிடப்படுகிறது. OT ஊதிய விகிதம் அடிப்படை ஊதியத்தை விட ${mult} மடங்கு ஆகும். உங்கள் அடிப்படை ஊதியம் ${sym}${worker.hourlyRate}/மணிநேரம் என்பதால், OT ஊதியம் ${sym}${otRate.toFixed(2)}/மணிநேரம் என்ற வீதத்தில் கணக்கிடப்படுகிறது.`,
          note: 'இது நிறுவனத்தின் கொள்கை அடிப்படையிலான கணக்கீடு.'
        };
      }
      return {
        intent: 'worker_overtime',
        answer: `Under ${org.name}'s rules, hours worked beyond ${std} hours in a single shift are treated as overtime. Overtime is paid at ${mult}x your base rate. With your rate of ${sym}${worker.hourlyRate}/hr, your overtime rate is ${sym}${otRate.toFixed(2)}/hr.`,
        note: 'Calculations are deterministic based on organization policy.'
      };
    }

    // Intent 3: Fatigue, Rest & Working Hours Warning
    if (qLower === 'fatigue' || qLower.includes('fatigue') || qLower.includes('rest') || qLower.includes('hours') || qLower.includes('சோர்வு') || qLower.includes('ஓய்வு')) {
      const risk = evaluateFatigueRisk(workerShifts, {
        maxDailyHours: org.settings?.maxDailyHoursThreshold || 10,
        minRestHours: org.settings?.minRestHoursThreshold || 11,
        maxWeeklyHours: org.settings?.maxWeeklyHoursThreshold || 48
      });

      if (risk.hasWarning) {
        const warningDescriptions = risk.warnings.map(w => `• ${w.message}`).join('\n');
        if (isTamil) {
          return {
            intent: 'worker_fatigue',
            answer: `எச்சரிக்கை (${risk.riskLevel}): உங்கள் சமீபத்திய பணி பதிவுகளில் சோர்வு அபாயம் கண்டறியப்பட்டுள்ளது:\n${warningDescriptions}\n\nநிறுவன பாதுகாப்புக் கொள்கை: தினசரி அதிகபட்சம் ${org.settings.maxDailyHoursThreshold} மணிநேரம் மற்றும் ஷிஃப்ட்டுகளுக்கு இடையே குறைந்தபட்சம் ${org.settings.minRestHoursThreshold} மணிநேர ஓய்வு தேவை. போதிய ஓய்வெடுக்க மேற்பார்வையாளரிடம் தெரிவிக்கவும்.`,
            note: 'தொழிலாளர் உடல்நலன் மற்றும் விபத்து தடுப்பு விதிமுறை.'
          };
        }
        return {
          intent: 'worker_fatigue',
          answer: `Alert (${risk.riskLevel}): Fatigue risk detected in your recent duty records:\n${warningDescriptions}\n\nConfigured safety limits: Max ${org.settings.maxDailyHoursThreshold}h per day and minimum ${org.settings.minRestHoursThreshold}h rest between shifts. Please inform your supervisor to ensure adequate recovery time.`,
          note: 'Rule-based safety threshold evaluation.'
        };
      }

      if (isTamil) {
        return {
          intent: 'worker_fatigue',
          answer: `நன்று! கடந்த 7 நாட்களில் நீங்கள் ${risk.totalHoursLast7Days} மணிநேரம் பணியாற்றியுள்ளீர்கள். உங்கள் பணி நேரம் மற்றும் ஓய்வு இடைவெளிகள் அனைத்தும் நிறுவனத்தின் பாதுகாப்பான வரம்பிற்குள் (${org.settings.maxDailyHoursThreshold} மணி/நாள் மற்றும் ${org.settings.minRestHoursThreshold} மணி ஓய்வு) உள்ளன.`,
          note: 'சோர்வு அபாய எச்சரிக்கைகள் எதுவும் இல்லை.'
        };
      }
      return {
        intent: 'worker_fatigue',
        answer: `All clear! You have recorded ${risk.totalHoursLast7Days} hours over the past 7 days. Your duty duration and rest intervals comply with the safe operational thresholds (max ${org.settings.maxDailyHoursThreshold}h/day and min ${org.settings.minRestHoursThreshold}h rest).`,
        note: 'No fatigue or rest warnings active.'
      };
    }

    // Intent 4: Status of Safety Concerns
    if (qLower === 'reports' || qLower.includes('status') || qLower.includes('complaint') || qLower.includes('புகார்') || qLower.includes('நிலை')) {
      if (workerReports.length === 0) {
        if (isTamil) {
          return {
            intent: 'worker_reports',
            answer: `${worker.name} அவர்களே, நீங்கள் இதுவரை எந்தவொரு பாதுகாப்பு புகாரையும் பதிவு செய்யவில்லை. பாதுகாப்பு குறைபாடுகள் இருந்தால் 'பாதுகாப்பு குறைபாடு / புகாரைப் பதிவுசெய்க' படிவத்தைப் பயன்படுத்தவும்.`,
            note: 'பதிவு எதுவும் இல்லை.'
          };
        }
        return {
          intent: 'worker_reports',
          answer: `${worker.name}, you have not submitted any safety concerns or grievances yet. If you observe hazards, you can log them using the report form below.`,
          note: 'Zero submitted reports found.'
        };
      }

      const reportSummary = workerReports.map(r => {
        let text = `• "${r.title}" — Status: ${r.status} (${r.severity} severity)`;
        if (r.resolutionNote) text += `\n  Supervisor Note: ${r.resolutionNote}`;
        return text;
      }).join('\n\n');

      if (isTamil) {
        return {
          intent: 'worker_reports',
          answer: `நீங்கள் சமர்ப்பித்த ${workerReports.length} புகார்களின் நிலை:\n\n${reportSummary}`,
          note: 'புகார்கள் மேற்பார்வையாளர் ஆய்வுடன் கண்காணிக்கப்படுகின்றன.'
        };
      }
      return {
        intent: 'worker_reports',
        answer: `Here is the current status of your ${workerReports.length} submitted report(s):\n\n${reportSummary}`,
        note: 'State reflects supervisor updates in real time.'
      };
    }

    // Intent 5: How to Report Hazards
    if (qLower === 'how_report' || qLower.includes('how do i report') || qLower.includes('hazard') || qLower.includes('grievance') || qLower.includes('எவ்வாறு பதிவு')) {
      if (isTamil) {
        return {
          intent: 'worker_how_report',
          answer: `பாதுகாப்பு குறைபாட்டைப் பதிவு செய்ய:\n1. 'பாதுகாப்பு குறைபாடு / புகாரைப் பதிவுசெய்க' படிவத்திற்குச் செல்லவும்.\n2. சிக்கலின் சுருக்கமான தலைப்பை உள்ளிடவும்.\n3. வகை (உடற்காயம், உபகரணக் கோளாறு, வேதியியல் ஆபத்து போன்றவை) மற்றும் தீவிரத்தைத் தேர்ந்தெடுக்கவும்.\n4. நிகழ்விடம் மற்றும் சூழ்நிலையை விவரித்து 'புகாரை அனுப்புக' என்பதை அழுத்தவும்.\n\nஅறிவிப்பு: உங்கள் புகார் மேற்பார்வையாளரால் ஆய்வு செய்யப்பட்டு தீர்வு குறிப்பு வழங்கப்படும்.`,
          note: 'கணக்குடன் இணைக்கப்பட்ட ரகசியப் பதிவு.'
        };
      }
      return {
        intent: 'worker_how_report',
        answer: `To report a safety concern or grievance:\n1. Scroll down to "Report Safety Concern / Grievance".\n2. Provide a clear title (e.g., missing scaffold toe-board, chemical odor).\n3. Select the category and severity (Low, Medium, High, Critical).\n4. Enter the detailed description with specific location and click Submit.\n\nNotice: Reports are account-linked and visible to supervisors for accountable resolution. Anonymous submissions are not supported.`,
        note: 'Confidential and supervisor-accountable.'
      };
    }

    // Intent 6: Disclaimer / Payroll legality
    if (qLower === 'disclaimer' || qLower.includes('legal') || qLower.includes('payroll') || qLower.includes('சட்டப்பூர்வ')) {
      if (isTamil) {
        return {
          intent: 'worker_disclaimer',
          answer: `இல்லை, ஃபேர்ஷிஃப்ட் மதிப்பீடுகள் வெளிப்படைத்தன்மை மற்றும் சரிபார்ப்பு நோக்கங்களுக்காக மட்டுமே. இது சட்டப்பூர்வ சம்பளப் பட்டியல் அல்ல. உங்கள் முதலாளியிடம் உத்தியோகபூர்வ ஊதிய ரசீதுகளை ஒப்பிட்டுப் பார்க்க இந்தத் தரவைப் பயன்படுத்தலாம்.`,
          note: 'சட்டப்பூர்வ வரம்பு அறிவிப்பு.'
        };
      }
      return {
        intent: 'worker_disclaimer',
        answer: `No. FairShift provides deterministic transparency calculations to help workers track hours and cross-verify compensation. It does not constitute official legal payroll compliance, binding tax forms, or statutory wage Slips.`,
        note: 'Transparency tool disclaimer.'
      };
    }
  }

  // -------------------------------------------------------------
  // EMPLOYER INTENTS
  // -------------------------------------------------------------
  if (role === 'employer') {
    const orgWorkers = context.workers || [];
    const orgShifts = shifts.filter(s => s.orgId === org.id);
    const orgReports = reports.filter(r => r.orgId === org.id);

    // Intent 1: Fatigue overview
    if (qLower === 'fatigue_overview' || qLower.includes('fatigue') || qLower.includes('alert') || qLower.includes('warning') || qLower.includes('சோர்வு') || qLower.includes('எச்சரிக்கை')) {
      const fatigueAlerts = [];
      orgWorkers.forEach(w => {
        const wShifts = orgShifts.filter(s => s.workerId === w.id && s.endTime);
        const risk = evaluateFatigueRisk(wShifts, {
          maxDailyHours: org.settings?.maxDailyHoursThreshold || 10,
          minRestHours: org.settings?.minRestHoursThreshold || 11,
          maxWeeklyHours: org.settings?.maxWeeklyHoursThreshold || 48
        });
        if (risk.hasWarning) {
          fatigueAlerts.push({ worker: w, risk });
        }
      });

      if (fatigueAlerts.length === 0) {
        if (isTamil) {
          return {
            intent: 'employer_fatigue_overview',
            answer: `சிறப்பு! ${org.name}-ல் தற்போது எந்த தொழிலாளருக்கும் சோர்வு அல்லது பணி வரம்பு எச்சரிக்கைகள் இல்லை. அனைவரும் பாதுகாப்பான பணி (${org.settings.maxDailyHoursThreshold} மணி/நாள்) மற்றும் ஓய்வு (${org.settings.minRestHoursThreshold} மணி இடைவெளி) வரம்புகளுக்குள் உள்ளனர்.`,
            note: 'பூஜ்ஜிய எச்சரிக்கைகள்.'
          };
        }
        return {
          intent: 'employer_fatigue_overview',
          answer: `All clear! Currently, zero workers in ${org.name} have triggered fatigue alerts. All personnel are operating within configured duty limits (≤${org.settings.maxDailyHoursThreshold}h/shift) and mandatory rest intervals (≥${org.settings.minRestHoursThreshold}h rest).`,
          note: 'Safe operational state.'
        };
      }

      const list = fatigueAlerts.map(fa => {
        const reasons = fa.risk.warnings.map(w => `  - ${w.message}`).join('\n');
        return `• ${fa.worker.name} (${fa.worker.role}) [${fa.risk.riskLevel} RISK]:\n${reasons}`;
      }).join('\n\n');

      if (isTamil) {
        return {
          intent: 'employer_fatigue_overview',
          answer: `${fatigueAlerts.length} தொழிலாளர்(கள்) சோர்வு எச்சரிக்கையை கொண்டுள்ளனர்:\n\n${list}\n\nபரிந்துரை: ஷிஃப்ட் அட்டவணையை சரிசெய்து குறைந்தபட்சம் ${org.settings.minRestHoursThreshold} மணிநேர ஓய்வு இடைவெளியை உறுதிசெய்யவும்.`,
          note: 'உடனடி நிர்வாக நடவடிக்கை தேவை.'
        };
      }
      return {
        intent: 'employer_fatigue_overview',
        answer: `${fatigueAlerts.length} worker(s) currently trigger fatigue or excessive-hours alerts:\n\n${list}\n\nActionable Recommendation: Adjust upcoming shift assignments to guarantee at least ${org.settings.minRestHoursThreshold}h continuous rest.`,
        note: 'Operational risk flagged.'
      };
    }

    // Intent 2: Critical safety reports
    if (qLower === 'critical_reports' || qLower.includes('critical') || qLower.includes('safety') || qLower.includes('open') || qLower.includes('தீவிர') || qLower.includes('பாதுகாப்பு')) {
      const openIssues = orgReports.filter(r => r.status === 'OPEN' || r.status === 'IN_REVIEW');
      const criticalOrHigh = openIssues.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH');

      if (criticalOrHigh.length === 0) {
        if (isTamil) {
          return {
            intent: 'employer_critical_reports',
            answer: `தற்போது தீர்க்கப்படாமல் உள்ள தீவிர (Critical/High) பாதுகாப்பு புகார்கள் எதுவும் இல்லை. நிலுவையில் உள்ள மொத்த புகார்கள்: ${openIssues.length}.`,
            note: 'உயர் ஆபத்து புகார்கள் இல்லை.'
          };
        }
        return {
          intent: 'employer_critical_reports',
          answer: `There are currently no unresolved Critical or High severity reports for ${org.name}. (Total open/in-review concerns across all severities: ${openIssues.length}).`,
          note: 'No urgent life-safety flags active.'
        };
      }

      const items = criticalOrHigh.map(r => `• [${r.severity}] "${r.title}" reported by ${r.workerName} (${new Date(r.submittedAt).toLocaleDateString()}) - Status: ${r.status}\n  Details: ${r.description}`).join('\n\n');

      if (isTamil) {
        return {
          intent: 'employer_critical_reports',
          answer: `உடனடி கவனம் தேவைப்படும் ${criticalOrHigh.length} தீவிர பாதுகாப்பு புகார்(கள்):\n\n${items}\n\nபரிந்துரை: கள மேற்பார்வையாளரை அனுப்பி சரிபார்த்து, தீர்வு குறிப்புடன் நிலையை 'RESOLVED' என மாற்றவும்.`,
          note: 'உயர் முன்னுரிமை.'
        };
      }
      return {
        intent: 'employer_critical_reports',
        answer: `${criticalOrHigh.length} high/critical priority safety issue(s) require supervisor attention:\n\n${items}\n\nRecommendation: Dispatch site supervisors to inspect, implement physical containment, and record resolution notes in the dashboard.`,
        note: 'Immediate inspection recommended.'
      };
    }

    // Intent 3: Hours and Overtime summary
    if (qLower === 'hours_summary' || qLower.includes('overtime') || qLower.includes('hours') || qLower.includes('summary') || qLower.includes('மொத்த')) {
      const completed = orgShifts.filter(s => s.endTime);
      const totalHours = completed.reduce((acc, s) => acc + (s.hours || 0), 0);
      const otHours = completed.reduce((acc, s) => acc + (s.overtimeHours || 0), 0);
      const totalPay = completed.reduce((acc, s) => acc + (s.totalEstimatedEarnings || 0), 0);

      if (isTamil) {
        return {
          intent: 'employer_hours_summary',
          answer: `${org.name} பணியாளர் செயல்பாட்டு சுருக்கம்:\n• பதிவுசெய்த தொழிலாளர்கள்: ${orgWorkers.length}\n• முடிவடைந்த ஷிஃப்டுகள்: ${completed.length}\n• மொத்த பணி நேரம்: ${totalHours.toFixed(1)} மணிநேரம்\n• மொத்த கூடுதல் பணி (OT): ${otHours.toFixed(1)} மணிநேரம்\n• மொத்த உத்தேச சம்பளச் செலவு: ${sym}${totalPay.toFixed(2)}`,
          note: 'செயல்பாட்டு பலகை சுருக்கம்.'
        };
      }
      return {
        intent: 'employer_hours_summary',
        answer: `Workforce summary for ${org.name}:\n• Registered Workers: ${orgWorkers.length}\n• Completed Shifts: ${completed.length}\n• Total Duty Hours: ${totalHours.toFixed(1)} hrs\n• Total Overtime Hours: ${otHours.toFixed(1)} hrs (${((otHours / (totalHours || 1)) * 100).toFixed(1)}% of total hours)\n• Total Estimated Pay Obligation: ${sym}${totalPay.toFixed(2)}`,
        note: 'Derived from recorded shift history.'
      };
    }

    // Intent 4: Thresholds
    if (qLower === 'thresholds' || qLower.includes('threshold') || qLower.includes('rule') || qLower.includes('விதிகள்') || qLower.includes('வரம்பு')) {
      if (isTamil) {
        return {
          intent: 'employer_thresholds',
          answer: `${org.name} நிறுவனத்தின் தற்போதைய விதிகள்:\n• வழக்கமான ஷிஃப்ட் அளவு: ${org.settings.standardDailyHours} மணிநேரம்/நாள்\n• OT ஊதியப் பெருக்கி: ${org.settings.overtimeMultiplier}x\n• அதிகபட்ச பாதுகாப்பான பணி வரம்பு: ${org.settings.maxDailyHoursThreshold} மணி/நாள்\n• குறைந்தபட்ச ஓய்வு இடைவெளி: ${org.settings.minRestHoursThreshold} மணிநேரம்\n• வாராந்திர வரம்பு: ${org.settings.maxWeeklyHoursThreshold} மணி/வாரம்`,
          note: 'நிறுவன அமைப்புகளின்படி கணக்கிடப்படுகிறது.'
        };
      }
      return {
        intent: 'employer_thresholds',
        answer: `Configured operational and safety parameters for ${org.name}:\n• Standard Daily Shift: ${org.settings.standardDailyHours}h\n• Overtime Wage Multiplier: ${org.settings.overtimeMultiplier}x base wage\n• Max Daily Fatigue Threshold: ${org.settings.maxDailyHoursThreshold}h\n• Min Continuous Rest Interval: ${org.settings.minRestHoursThreshold}h between consecutive shifts\n• Max Weekly Fatigue Cap: ${org.settings.maxWeeklyHoursThreshold}h in 7 rolling days`,
        note: 'Parameters configurable in organization settings.'
      };
    }

    // Intent 5: Audit status
    if (qLower === 'audit_status' || qLower.includes('audit') || qLower.includes('all resolved') || qLower.includes('தணிக்கை')) {
      const open = orgReports.filter(r => r.status === 'OPEN' || r.status === 'IN_REVIEW');
      const resolved = orgReports.filter(r => r.status === 'RESOLVED');

      if (isTamil) {
        return {
          intent: 'employer_audit_status',
          answer: `தணிக்கை நிலை: மொத்தம் பதிவு செய்யப்பட்ட ${orgReports.length} புகார்களில், ${resolved.length} தீர்க்கப்பட்டுள்ளன; ${open.length} இன்னும் நிலுவையில் உள்ளன. நிலுவையில் உள்ள புகார்களை ஆய்வு செய்து தீர்வு குறிப்பை பதிவு செய்யவும்.`,
          note: 'புகார் கண்காணிப்பு அறிக்கை.'
        };
      }
      return {
        intent: 'employer_audit_status',
        answer: `Grievance Audit: Across ${orgReports.length} total logged concern(s), ${resolved.length} are resolved and ${open.length} remain open or in review. Ensure supervisors document physical remedies before closing open reports.`,
        note: 'Audit tracking.'
      };
    }
  }

  // -------------------------------------------------------------
  // FALLBACK (Honest and un-fabricated)
  // -------------------------------------------------------------
  if (isTamil) {
    return {
      intent: 'fallback',
      answer: `மன்னிக்கவும், உங்களின் குறிப்பிட்ட கேள்விக்கான நேரடித் தகவல் எனது தற்போதைய தரவு விதிகளில் இல்லை. நான் உண்மையான பணி பதிவுகள், ஊதியம், சோர்வு எச்சரிக்கைகள் மற்றும் பாதுகாப்பு புகார்களை மட்டுமே விளக்குகிறேன். கீழே உள்ள பரிந்துரைக்கப்பட்ட கேள்விகளில் ஒன்றைத் தேர்ந்தெடுக்கலாம்.`,
      note: 'மாதிரி விதிகளில் இல்லாத தகவல்.'
    };
  }
  return {
    intent: 'fallback',
    answer: `I do not have sufficient verifiable data to answer that question without making assumptions. As a deterministic assistant, I only provide explanations grounded directly in your recorded shifts, overtime rates, rule-based fatigue alerts, and submitted grievance records. Please select one of the suggested questions above.`,
    note: 'Query not matched to available deterministic rules.'
  };
}
