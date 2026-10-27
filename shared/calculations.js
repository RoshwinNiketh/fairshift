/**
 * FairShift - Core Calculation Engine & Types
 * SDG 8: Decent Work and Economic Growth
 */

export const DISCLAIMER_TEXT = "Estimates are for transparency and verification purposes only. This tool does not constitute official legal payroll compliance or binding tax documentation.";

/**
 * Calculates shift duration in hours
 * @param {string|Date} startTime 
 * @param {string|Date} endTime 
 * @returns {number} duration in decimal hours (rounded to 2 decimal places)
 */
export function calculateDurationHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  const diffHours = (end - start) / (1000 * 60 * 60);
  return Math.round(diffHours * 100) / 100;
}

/**
 * Calculates earnings breakdown including regular and overtime pay
 * @param {number} totalHours Total hours worked
 * @param {number} hourlyRate Base hourly wage rate
 * @param {number} standardHours Standard daily shift threshold (default 8)
 * @param {number} overtimeMultiplier Overtime wage multiplier (default 1.5)
 */
export function calculateShiftEarnings(totalHours, hourlyRate, standardHours = 8, overtimeMultiplier = 1.5) {
  const rate = Number(hourlyRate) || 0;
  const hours = Math.max(0, Number(totalHours) || 0);
  const stdThreshold = Math.max(0, Number(standardHours) || 8);
  const otMult = Math.max(1, Number(overtimeMultiplier) || 1.5);

  const regularHours = Math.min(hours, stdThreshold);
  const overtimeHours = Math.max(0, hours - stdThreshold);

  const regularPay = Math.round(regularHours * rate * 100) / 100;
  const overtimeRate = Math.round(rate * otMult * 100) / 100;
  const overtimePay = Math.round(overtimeHours * overtimeRate * 100) / 100;
  const totalEstimatedEarnings = Math.round((regularPay + overtimePay) * 100) / 100;

  return {
    totalHours: Math.round(hours * 100) / 100,
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    hourlyRate: rate,
    overtimeRate,
    regularPay,
    overtimePay,
    totalEstimatedEarnings,
    isOvertime: overtimeHours > 0
  };
}

/**
 * Evaluates fatigue and excessive hours risk
 * @param {Array<{startTime: string, endTime: string, hours?: number}>} workerShifts 
 * @param {object} config { maxDailyHours: 10, minRestHours: 11, maxWeeklyHours: 48, lang: 'en'|'ta' }
 */
export function evaluateFatigueRisk(workerShifts = [], config = {}) {
  const maxDailyHours = config.maxDailyHours || 10;
  const minRestHours = config.minRestHours || 11;
  const maxWeeklyHours = config.maxWeeklyHours || 48;
  const isTamil = config.lang === 'ta';

  const warnings = [];
  let totalHoursLast7Days = 0;
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Sort shifts chronologically
  const sorted = [...workerShifts]
    .filter(s => s.startTime && s.endTime)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  for (let i = 0; i < sorted.length; i++) {
    const shift = sorted[i];
    const shiftEnd = new Date(shift.endTime).getTime();
    const duration = shift.hours || calculateDurationHours(shift.startTime, shift.endTime);

    if (shiftEnd >= sevenDaysAgo) {
      totalHoursLast7Days += duration;
    }

    // Daily limit warning
    if (duration > maxDailyHours) {
      warnings.push({
        type: 'EXCESSIVE_DAILY_HOURS',
        severity: 'HIGH',
        message: isTamil
          ? `ஷிஃப்ட் அதிகபட்ச பரிந்துரைக்கப்பட்ட தினசரி வரம்பை தாண்டியது (${duration} மணிநேரம் வேலை vs ${maxDailyHours} மணிநேர வரம்பு).`
          : `Shift exceeded maximum recommended daily limit (${duration}h worked vs ${maxDailyHours}h threshold).`,
        shiftId: shift.id,
        date: shift.startTime
      });
    }

    // Rest interval warning between consecutive shifts
    if (i < sorted.length - 1) {
      const nextShift = sorted[i + 1];
      const nextStart = new Date(nextShift.startTime).getTime();
      const restPeriod = (nextStart - shiftEnd) / (1000 * 60 * 60);

      if (restPeriod > 0 && restPeriod < minRestHours) {
        warnings.push({
          type: 'INSUFFICIENT_REST',
          severity: 'CRITICAL',
          message: isTamil
            ? `ஷிஃப்ட்டுகளுக்கு இடையே போதிய ஓய்வு இடைவெளி இல்லை: வெறும் ${restPeriod.toFixed(1)} மணிநேர ஓய்வு மட்டுமே (தேவைப்படும் குறைந்தபட்சம்: ${minRestHours} மணிநேரம்).`
            : `Insufficient rest period between shifts: only ${restPeriod.toFixed(1)}h rest (minimum required: ${minRestHours}h).`,
          priorShiftId: shift.id,
          nextShiftId: nextShift.id,
          date: nextShift.startTime
        });
      }
    }
  }

  // Weekly fatigue threshold
  if (totalHoursLast7Days > maxWeeklyHours) {
    warnings.push({
      type: 'EXCESSIVE_WEEKLY_HOURS',
      severity: 'HIGH',
      message: isTamil
        ? `கடந்த 7 நாட்களில் பதிவுசெய்யப்பட்ட மொத்த பணி நேரம் (${totalHoursLast7Days.toFixed(1)} மணிநேரம்) ஆரோக்கிய வரம்பான ${maxWeeklyHours} மணிநேரத்தை தாண்டியுள்ளது.`
        : `Total recorded hours in the past 7 days (${totalHoursLast7Days.toFixed(1)}h) exceeds health threshold of ${maxWeeklyHours}h.`,
      rollingHours: totalHoursLast7Days
    });
  }

  return {
    totalHoursLast7Days: Math.round(totalHoursLast7Days * 100) / 100,
    hasWarning: warnings.length > 0,
    riskLevel: warnings.some(w => w.severity === 'CRITICAL') ? 'CRITICAL' : (warnings.length > 0 ? 'WARNING' : 'NORMAL'),
    warnings
  };
}
