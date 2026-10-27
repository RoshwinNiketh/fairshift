/**
 * Seed data for FairShift Demo
 * Two fictional organizations:
 * 1. BuildRight Infra Ltd (Construction Site)
 * 2. Apex Heights College (Housekeeping & Facility Maintenance)
 */

export const INITIAL_DATA = {
  organizations: [
    {
      id: "org-buildright",
      name: "BuildRight Infrastructure Ltd",
      industry: "Construction & Heavy Civil",
      currency: "USD",
      symbol: "$",
      settings: {
        standardDailyHours: 8,
        overtimeMultiplier: 1.5,
        defaultHourlyRate: 22.50,
        maxDailyHoursThreshold: 10,
        minRestHoursThreshold: 11,
        maxWeeklyHoursThreshold: 48
      }
    },
    {
      id: "org-apexcollege",
      name: "Apex Heights College Facilities",
      industry: "Higher Ed Support & Housekeeping",
      currency: "USD",
      symbol: "$",
      settings: {
        standardDailyHours: 7.5,
        overtimeMultiplier: 1.5,
        defaultHourlyRate: 18.00,
        maxDailyHoursThreshold: 9.5,
        minRestHoursThreshold: 12,
        maxWeeklyHoursThreshold: 45
      }
    }
  ],
  workers: [
    // Construction Workers
    {
      id: "w-c1",
      orgId: "org-buildright",
      name: "Muthu Velan",
      role: "Rebar & Scaffold Worker",
      hourlyRate: 24.00,
      activeShiftId: null,
      phone: "+1-555-0192"
    },
    {
      id: "w-c2",
      orgId: "org-buildright",
      name: "David Chen",
      role: "Concrete Paving Specialist",
      hourlyRate: 23.00,
      activeShiftId: null,
      phone: "+1-555-0143"
    },
    {
      id: "w-c3",
      orgId: "org-buildright",
      name: "Elena Rostova",
      role: "Heavy Equipment Crane Spotter",
      hourlyRate: 25.00,
      activeShiftId: null,
      phone: "+1-555-0188"
    },

    // College Housekeeping Staff
    {
      id: "w-h1",
      orgId: "org-apexcollege",
      name: "Anandhi Raman",
      role: "Senior Sanitation Technician",
      hourlyRate: 19.50,
      activeShiftId: null,
      phone: "+1-555-0321"
    },
    {
      id: "w-h2",
      orgId: "org-apexcollege",
      name: "Marcus Miller",
      role: "Residence Hall Custodian",
      hourlyRate: 18.00,
      activeShiftId: null,
      phone: "+1-555-0344"
    }
  ],
  shifts: [
    // BuildRight Construction Shifts (Overtime & Fatigue Examples)
    {
      id: "sh-101",
      orgId: "org-buildright",
      workerId: "w-c1",
      workerName: "Muthu Velan",
      startTime: "2026-10-24T07:00:00Z",
      endTime: "2026-10-24T18:00:00Z",
      hours: 11.0,
      hourlyRate: 24.0,
      standardHours: 8,
      regularHours: 8,
      overtimeHours: 3.0,
      regularPay: 192.0,
      overtimePay: 108.0,
      totalEstimatedEarnings: 300.0,
      notes: "Basement structural pour continuous shift"
    },
    {
      id: "sh-102",
      orgId: "org-buildright",
      workerId: "w-c1",
      workerName: "Muthu Velan",
      startTime: "2026-10-25T04:00:00Z",
      endTime: "2026-10-25T14:30:00Z",
      hours: 10.5,
      hourlyRate: 24.0,
      standardHours: 8,
      regularHours: 8,
      overtimeHours: 2.5,
      regularPay: 192.0,
      overtimePay: 90.0,
      totalEstimatedEarnings: 282.0,
      notes: "Early inspection cycle - minimal rest recovery"
    },
    {
      id: "sh-103",
      orgId: "org-buildright",
      workerId: "w-c2",
      workerName: "David Chen",
      startTime: "2026-10-25T07:30:00Z",
      endTime: "2026-10-25T16:00:00Z",
      hours: 8.5,
      hourlyRate: 23.0,
      standardHours: 8,
      regularHours: 8,
      overtimeHours: 0.5,
      regularPay: 184.0,
      overtimePay: 17.25,
      totalEstimatedEarnings: 201.25,
      notes: "North access driveway paving"
    },

    // College Housekeeping Shifts
    {
      id: "sh-201",
      orgId: "org-apexcollege",
      workerId: "w-h1",
      workerName: "Anandhi Raman",
      startTime: "2026-10-25T06:00:00Z",
      endTime: "2026-10-25T14:00:00Z",
      hours: 8.0,
      hourlyRate: 19.5,
      standardHours: 7.5,
      regularHours: 7.5,
      overtimeHours: 0.5,
      regularPay: 146.25,
      overtimePay: 14.63,
      totalEstimatedEarnings: 160.88,
      notes: "Science Hall laboratories sanitation schedule"
    },
    {
      id: "sh-202",
      orgId: "org-apexcollege",
      workerId: "w-h2",
      workerName: "Marcus Miller",
      startTime: "2026-10-25T14:00:00Z",
      endTime: "2026-10-25T21:30:00Z",
      hours: 7.5,
      hourlyRate: 18.0,
      standardHours: 7.5,
      regularHours: 7.5,
      overtimeHours: 0,
      regularPay: 135.0,
      overtimePay: 0,
      totalEstimatedEarnings: 135.0,
      notes: "West Dormitory commons turnaround"
    }
  ],
  reports: [
    {
      id: "rep-301",
      orgId: "org-buildright",
      workerId: "w-c1",
      workerName: "Muthu Velan",
      category: "SAFETY_HAZARD",
      severity: "CRITICAL",
      title: "Missing perimeter safety guardrail on 4th floor edge",
      description: "Scaffold decking on Sector B North has no toe-boards or tether anchors. Strong wind gusts created high fall hazard during afternoon lift.",
      status: "OPEN",
      submittedAt: "2026-10-25T09:15:00Z",
      resolutionNote: ""
    },
    {
      id: "rep-302",
      orgId: "org-buildright",
      workerId: "w-c2",
      workerName: "David Chen",
      category: "EQUIPMENT_ISSUE",
      severity: "MEDIUM",
      title: "Hydraulic leak on mixer truck discharge chute",
      description: "Hydraulic fluid dripping near operator walkway causing slippery footing.",
      status: "RESOLVED",
      submittedAt: "2026-10-24T11:30:00Z",
      resolvedAt: "2026-10-24T16:00:00Z",
      resolutionNote: "Chute pressure valve hose replaced by on-site maintenance contractor. Area degreased."
    },
    {
      id: "rep-401",
      orgId: "org-apexcollege",
      workerId: "w-h1",
      workerName: "Anandhi Raman",
      category: "CHEMICAL_EXPOSURE",
      severity: "HIGH",
      title: "Faulty exhaust in chemical dilution supply closet",
      description: "Ventilation duct in East Wing supply room is non-functional. Strong ammonia fumes accumulate when preparing floor stripper solution.",
      status: "IN_REVIEW",
      submittedAt: "2026-10-25T08:30:00Z",
      resolutionNote: "Facilities engineering dispatched work order #4491 to replace blower motor."
    }
  ]
};
