/**
 * Seed data for FairShift Demo
 * Two fictional organizations:
 * 1. BuildRight Infrastructure Ltd (Construction Site - Heavy civil / metro station)
 * 2. Apex Heights College Facilities (Higher Ed Support - Housekeeping & maintenance)
 * 
 * Uses Indian Rupee (INR ₹) representing frontline construction & campus operations.
 */

export const INITIAL_DATA = {
  organizations: [
    {
      id: "org-buildright",
      name: "BuildRight Infrastructure Ltd",
      industry: "Metro Rail & Civil Construction",
      currency: "INR",
      symbol: "₹",
      settings: {
        standardDailyHours: 8,
        overtimeMultiplier: 1.5,
        defaultHourlyRate: 120.00, // ₹120/hr base rate (~₹960/standard 8h day)
        maxDailyHoursThreshold: 10,
        minRestHoursThreshold: 11,
        maxWeeklyHoursThreshold: 48
      }
    },
    {
      id: "org-apexcollege",
      name: "Apex Heights College Facilities",
      industry: "Campus Housekeeping & Support Services",
      currency: "INR",
      symbol: "₹",
      settings: {
        standardDailyHours: 7.5,
        overtimeMultiplier: 1.5,
        defaultHourlyRate: 95.00, // ₹95/hr base rate (~₹712.50/standard 7.5h day)
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
      role: "Rebar & Scaffold Lead",
      hourlyRate: 130.00,
      activeShiftId: null,
      phone: "+91-98401-23456"
    },
    {
      id: "w-c2",
      orgId: "org-buildright",
      name: "Ramesh Kumar",
      role: "Concrete Pouring Technician",
      hourlyRate: 125.00,
      activeShiftId: null,
      phone: "+91-98402-34567"
    },
    {
      id: "w-c3",
      orgId: "org-buildright",
      name: "Priya Sundaram",
      role: "Crane Signal & Safety Spotter",
      hourlyRate: 135.00,
      activeShiftId: null,
      phone: "+91-98403-45678"
    },

    // College Housekeeping Staff
    {
      id: "w-h1",
      orgId: "org-apexcollege",
      name: "Anandhi Raman",
      role: "Senior Sanitation Attendant",
      hourlyRate: 100.00,
      activeShiftId: null,
      phone: "+91-97101-56789"
    },
    {
      id: "w-h2",
      orgId: "org-apexcollege",
      name: "Murugan Selvam",
      role: "Hostel & Lab Maintenance Staff",
      hourlyRate: 95.00,
      activeShiftId: null,
      phone: "+91-97102-67890"
    }
  ],
  shifts: [
    // BuildRight Construction Shifts (Shows overtime & fatigue risk)
    {
      id: "sh-101",
      orgId: "org-buildright",
      workerId: "w-c1",
      workerName: "Muthu Velan",
      startTime: "2026-10-24T07:00:00Z",
      endTime: "2026-10-24T18:00:00Z",
      hours: 11.0,
      hourlyRate: 130.0,
      standardHours: 8,
      regularHours: 8,
      overtimeHours: 3.0,
      regularPay: 1040.0, // 8 * 130
      overtimePay: 585.0,  // 3 * (130 * 1.5 = 195)
      totalEstimatedEarnings: 1625.0,
      notes: "Station box foundation raft concrete pour"
    },
    {
      id: "sh-102",
      orgId: "org-buildright",
      workerId: "w-c1",
      workerName: "Muthu Velan",
      startTime: "2026-10-25T04:30:00Z",
      endTime: "2026-10-25T15:00:00Z",
      hours: 10.5,
      hourlyRate: 130.0,
      standardHours: 8,
      regularHours: 8,
      overtimeHours: 2.5,
      regularPay: 1040.0,
      overtimePay: 487.5, // 2.5 * 195
      totalEstimatedEarnings: 1527.5,
      notes: "Emergency scaffold de-shuttering (Short 10.5h rest gap)"
    },
    {
      id: "sh-103",
      orgId: "org-buildright",
      workerId: "w-c2",
      workerName: "Ramesh Kumar",
      startTime: "2026-10-25T08:00:00Z",
      endTime: "2026-10-25T16:30:00Z",
      hours: 8.5,
      hourlyRate: 125.0,
      standardHours: 8,
      regularHours: 8,
      overtimeHours: 0.5,
      regularPay: 1000.0,
      overtimePay: 93.75, // 0.5 * (125 * 1.5 = 187.5)
      totalEstimatedEarnings: 1093.75,
      notes: "Curing inspection on Pier 14"
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
      hourlyRate: 100.0,
      standardHours: 7.5,
      regularHours: 7.5,
      overtimeHours: 0.5,
      regularPay: 750.0, // 7.5 * 100
      overtimePay: 75.0,  // 0.5 * (100 * 1.5 = 150)
      totalEstimatedEarnings: 825.0,
      notes: "Chemistry Laboratory deep clean and waste segregation"
    },
    {
      id: "sh-202",
      orgId: "org-apexcollege",
      workerId: "w-h2",
      workerName: "Murugan Selvam",
      startTime: "2026-10-25T13:30:00Z",
      endTime: "2026-10-25T21:00:00Z",
      hours: 7.5,
      hourlyRate: 95.0,
      standardHours: 7.5,
      regularHours: 7.5,
      overtimeHours: 0,
      regularPay: 712.5,
      overtimePay: 0,
      totalEstimatedEarnings: 712.5,
      notes: "Dining hall and hostel corridor sanitization"
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
      title: "Missing safety toe-board & perimeter tether on 3rd tier scaffold",
      description: "Scaffold staging adjacent to Pillar B2 has no guard edge toe-board. High risk of heavy dropped tools hitting workers below during girder lift.",
      status: "OPEN",
      submittedAt: "2026-10-25T09:15:00Z",
      resolutionNote: ""
    },
    {
      id: "rep-302",
      orgId: "org-buildright",
      workerId: "w-c2",
      workerName: "Ramesh Kumar",
      category: "EQUIPMENT_ISSUE",
      severity: "MEDIUM",
      title: "Transit mixer chute lever hydraulic oil leak",
      description: "Hydraulic oil dripping onto walkway ramp creating slip hazard near batching plant.",
      status: "RESOLVED",
      submittedAt: "2026-10-24T11:30:00Z",
      resolvedAt: "2026-10-24T16:00:00Z",
      resolutionNote: "Hydraulic seal gasket replaced by mechanical team. Area sand-spread and degreased."
    },
    {
      id: "rep-401",
      orgId: "org-apexcollege",
      workerId: "w-h1",
      workerName: "Anandhi Raman",
      category: "CHEMICAL_EXPOSURE",
      severity: "HIGH",
      title: "Broken exhaust ventilation in Science Block chemical dilution closet",
      description: "Blower exhaust fan in Room 102 is dead. Heavy chlorine and ammonia fumes accumulate when preparing floor sanitizing concentrate.",
      status: "IN_REVIEW",
      submittedAt: "2026-10-25T08:30:00Z",
      resolutionNote: "Estate electrical engineer dispatched work order #4491 to replace capacitor."
    }
  ]
};
