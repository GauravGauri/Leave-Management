const { calculateLeaveDays } = require('../src/services/policyEngine');

describe('Leave Policy Engine Calculations', () => {
  const mockHolidayDates = [
    { date: new Date('2026-08-15'), name: 'Independence Day' } // Saturday in 2026
  ];

  test('Exclude Weekends Rule - Should count Friday to Monday as 2 days', () => {
    const startDate = new Date('2026-07-17'); // Friday
    const endDate = new Date('2026-07-20'); // Monday
    const rule = {
      weekendRules: 'Exclude',
      holidayRules: 'Exclude',
      sandwichPolicy: false
    };

    const result = calculateLeaveDays(startDate, endDate, rule, []);
    expect(result.duration).toBe(2);
    // Dates applied should only be Friday and Monday
    expect(result.datesApplied.length).toBe(2);
  });

  test('Include Weekends Rule - Should count Friday to Monday as 4 days', () => {
    const startDate = new Date('2026-07-17'); // Friday
    const endDate = new Date('2026-07-20'); // Monday
    const rule = {
      weekendRules: 'Include',
      holidayRules: 'Exclude',
      sandwichPolicy: false
    };

    const result = calculateLeaveDays(startDate, endDate, rule, []);
    expect(result.duration).toBe(4);
  });

  test('Sandwich Policy Enabled - Should count intermediate weekends even if weekendRules is Exclude', () => {
    const startDate = new Date('2026-07-17'); // Friday
    const endDate = new Date('2026-07-20'); // Monday
    const rule = {
      weekendRules: 'Exclude',
      holidayRules: 'Exclude',
      sandwichPolicy: true // Sandwich policy is active!
    };

    const result = calculateLeaveDays(startDate, endDate, rule, []);
    // Under sandwich policy, the weekend (Saturday + Sunday) is sandwiched between Friday and Monday,
    // so it counts as 4 days.
    expect(result.duration).toBe(4);
  });

  test('Sandwich Policy Enabled - Should not count weekend if it is at the start of leave (not sandwiched)', () => {
    const startDate = new Date('2026-07-19'); // Sunday
    const endDate = new Date('2026-07-21'); // Tuesday
    const rule = {
      weekendRules: 'Exclude',
      holidayRules: 'Exclude',
      sandwichPolicy: true
    };

    const result = calculateLeaveDays(startDate, endDate, rule, []);
    // Sunday is at the start (not sandwiched between leaves), so it is excluded.
    // Mon and Tue are counted. Total = 2.
    expect(result.duration).toBe(2);
  });

  test('Exclude Holiday Rule - Should exclude holiday from count', () => {
    const startDate = new Date('2026-08-14'); // Friday
    const endDate = new Date('2026-08-17'); // Monday
    // Independence Day is 2026-08-15 (Saturday), let's mock a holiday on Monday 2026-08-17
    const mockHolidays = [
      { date: new Date('2026-08-17'), name: 'Mock Holiday' }
    ];
    const rule = {
      weekendRules: 'Exclude',
      holidayRules: 'Exclude',
      sandwichPolicy: false
    };

    const result = calculateLeaveDays(startDate, endDate, rule, mockHolidays);
    // Friday is active (1), Sat and Sun are excluded, Mon is holiday so excluded. Total = 1.
    expect(result.duration).toBe(1);
  });
});
