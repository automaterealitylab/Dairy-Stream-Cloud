// Sample Units (from the image)
export const UNITS = [
  { id: 'A507', building: 'Vardhman Vihar', room: 'A 507', charges: 910 },
  { id: 'A606', building: 'Vardhman Vihar', room: 'A 606', charges: 1250 },
  { id: 'G B04', building: 'Vardhman Vihar', room: 'G B04', charges: 800 },
  { id: 'A1201', building: 'Vardhman Vihar', room: 'A 1201', charges: 1050 },
  { id: 'A1204', building: 'Vardhman Vihar', room: 'A 1204', charges: 1050 },
  { id: 'B505', building: 'Vardhman Vihar', room: 'B 505', charges: 1010 },
];

// Mock daily delivery status: 1 = Delivered, 0 = Absent/Not Delivered
// In a real app, this would come from a database.
const createMonthlyData = (unitList) => {
  const data = {};
  unitList.forEach(unit => {
    data[unit.id] = {};
    // Simulate daily status for 30 days
    for (let day = 1; day <= 30; day++) {
      // Randomly set a status
      data[unit.id][day] = Math.random() > 0.1 ? 1 : 0;
    }
    // Simulate monthly financial summary
    const deliveredDays = Object.values(data[unit.id]).filter(status => status === 1).length;
    data[unit.id].summary = {
      totalDays: deliveredDays,
      advance: Math.floor(Math.random() * 5) * 100, // Mock advance
      balance: (deliveredDays * (unit.charges / 30)) - (Math.floor(Math.random() * 5) * 100),
      paymentStatus: deliveredDays > 25 ? 'Paid GP' : 'Due',
      monthlyCharge: unit.charges
    };
  });
  return data;
};

export const MONTHLY_DATA = createMonthlyData(UNITS);