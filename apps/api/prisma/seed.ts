import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/services/authService';

const prisma = new PrismaClient();

const now = new Date();
const startOfCurrentWeek = new Date(now);
startOfCurrentWeek.setDate(now.getDate() - now.getDay());
startOfCurrentWeek.setHours(0, 0, 0, 0);

const startOfNextWeek = new Date(startOfCurrentWeek);
startOfNextWeek.setDate(startOfCurrentWeek.getDate() + 7);

const endOfCurrentWeek = new Date(startOfCurrentWeek);
endOfCurrentWeek.setDate(startOfCurrentWeek.getDate() + 7);

const endOfNextWeek = new Date(startOfNextWeek);
endOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

async function upsertUser(orgId: string, input: {
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      orgId,
      isActive: true,
      emailVerified: true,
    },
    create: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      orgId,
      isActive: true,
      emailVerified: true,
    },
  });
}

async function ensureDepartment(orgId: string, name: string, description: string) {
  const existing = await prisma.department.findFirst({ where: { orgId, name } });
  if (existing) {
    return prisma.department.update({ where: { id: existing.id }, data: { description, active: true } });
  }
  return prisma.department.create({
    data: { orgId, name, description, active: true },
  });
}

async function ensureLocation(orgId: string, name: string, address: string, phone: string) {
  const existing = await prisma.location.findFirst({ where: { orgId, name } });
  if (existing) {
    return prisma.location.update({ where: { id: existing.id }, data: { address, phone, active: true } });
  }
  return prisma.location.create({
    data: { orgId, name, address, phone, active: true },
  });
}

async function seedOrganization(input: {
  name: string;
  timezone: string;
  users: Array<{ email: string; firstName: string; lastName: string; role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'; password: string }>;
  departments: Array<{ name: string; description: string }>;
  locations: Array<{ name: string; address: string; phone: string }>;
}) {
  const org = await prisma.organization.upsert({
    where: { name: input.name },
    update: {
      timezone: input.timezone,
      setupCompleted: true,
      schedulingMode: 'PROACTIVE',
    },
    create: {
      name: input.name,
      timezone: input.timezone,
      dailyOtcThreshold: 8,
      weeklyOtcThreshold: 40,
      minRestBetweenShifts: 8,
      maxHoursPerWeek: 40,
      setupCompleted: true,
      schedulingMode: 'PROACTIVE',
    },
  });

  const users = [];
  for (const userInput of input.users) {
    users.push(await upsertUser(org.id, userInput));
  }

  const departments = [];
  for (const dept of input.departments) {
    departments.push(await ensureDepartment(org.id, dept.name, dept.description));
  }

  const locations = [];
  for (const location of input.locations) {
    locations.push(await ensureLocation(org.id, location.name, location.address, location.phone));
  }

  await prisma.businessHour.deleteMany({ where: { orgId: org.id } });
  await prisma.businessHour.createMany({
    data: Array.from({ length: 7 }).map((_, dayOfWeek) => ({
      orgId: org.id,
      dayOfWeek,
      openTime: dayOfWeek === 0 ? null : '08:00',
      closeTime: dayOfWeek === 0 ? null : '18:00',
      isClosed: dayOfWeek === 0,
    })),
  });

  await prisma.defaultShiftTemplate.deleteMany({ where: { orgId: org.id } });
  await prisma.defaultShiftTemplate.createMany({
    data: [
      {
        orgId: org.id,
        name: 'Morning Coverage',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '16:00',
        requiredHeadcount: 2,
        departmentId: departments[0]?.id ?? null,
        locationId: locations[0]?.id ?? null,
      },
      {
        orgId: org.id,
        name: 'Afternoon Coverage',
        dayOfWeek: 3,
        startTime: '12:00',
        endTime: '20:00',
        requiredHeadcount: 2,
        departmentId: departments[1]?.id ?? null,
        locationId: locations[1]?.id ?? null,
      },
      {
        orgId: org.id,
        name: 'Weekend Support',
        dayOfWeek: 6,
        startTime: '09:00',
        endTime: '15:00',
        requiredHeadcount: 1,
        departmentId: departments[2]?.id ?? departments[0]?.id ?? null,
        locationId: locations[0]?.id ?? null,
      },
    ],
  });

  const currentWeek = await prisma.scheduleWeek.upsert({
    where: {
      orgId_startDate_endDate: {
        orgId: org.id,
        startDate: startOfCurrentWeek,
        endDate: endOfCurrentWeek,
      },
    },
    update: { state: 'PUBLISHED', publishedAt: new Date() },
    create: {
      orgId: org.id,
      startDate: startOfCurrentWeek,
      endDate: endOfCurrentWeek,
      state: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  const nextWeek = await prisma.scheduleWeek.upsert({
    where: {
      orgId_startDate_endDate: {
        orgId: org.id,
        startDate: startOfNextWeek,
        endDate: endOfNextWeek,
      },
    },
    update: { state: 'DRAFT' },
    create: {
      orgId: org.id,
      startDate: startOfNextWeek,
      endDate: endOfNextWeek,
      state: 'DRAFT',
    },
  });

  await prisma.shift.deleteMany({
    where: { scheduleWeekId: { in: [currentWeek.id, nextWeek.id] } },
  });

  const employees = users.filter((u) => u.role === 'EMPLOYEE');

  const makeShiftTime = (baseWeekStart: Date, dayOffset: number, startHour: number, endHour: number) => {
    const startTime = new Date(baseWeekStart);
    startTime.setDate(baseWeekStart.getDate() + dayOffset);
    startTime.setHours(startHour, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(endHour, 0, 0, 0);

    return { startTime, endTime };
  };

  const shiftRows: Array<{
    scheduleWeekId: string;
    employeeId: string | null;
    departmentId: string | null;
    locationId: string | null;
    startTime: Date;
    endTime: Date;
    breakDurationMinutes: number;
    breakIsPaid: boolean;
    shiftType: string;
    status: string;
    notes: string;
  }> = [];

  for (let day = 1; day <= 5; day += 1) {
    const morning = makeShiftTime(startOfCurrentWeek, day, 8, 16);
    const afternoon = makeShiftTime(startOfCurrentWeek, day, 12, 20);

    shiftRows.push({
      scheduleWeekId: currentWeek.id,
      employeeId: employees[day % Math.max(employees.length, 1)]?.id ?? null,
      departmentId: departments[0]?.id ?? null,
      locationId: locations[day % Math.max(locations.length, 1)]?.id ?? null,
      startTime: morning.startTime,
      endTime: morning.endTime,
      breakDurationMinutes: 30,
      breakIsPaid: false,
      shiftType: 'REGULAR',
      status: 'SCHEDULED',
      notes: 'Seeded test shift (current week)',
    });

    shiftRows.push({
      scheduleWeekId: currentWeek.id,
      employeeId: day % 3 === 0 ? null : employees[(day + 1) % Math.max(employees.length, 1)]?.id ?? null,
      departmentId: departments[1]?.id ?? null,
      locationId: locations[(day + 1) % Math.max(locations.length, 1)]?.id ?? null,
      startTime: afternoon.startTime,
      endTime: afternoon.endTime,
      breakDurationMinutes: 30,
      breakIsPaid: false,
      shiftType: 'REGULAR',
      status: 'SCHEDULED',
      notes: 'Seeded test shift (current week)',
    });
  }

  for (let day = 1; day <= 5; day += 1) {
    const morning = makeShiftTime(startOfNextWeek, day, 9, 17);

    shiftRows.push({
      scheduleWeekId: nextWeek.id,
      employeeId: null,
      departmentId: departments[day % Math.max(departments.length, 1)]?.id ?? null,
      locationId: locations[day % Math.max(locations.length, 1)]?.id ?? null,
      startTime: morning.startTime,
      endTime: morning.endTime,
      breakDurationMinutes: 30,
      breakIsPaid: false,
      shiftType: 'REGULAR',
      status: 'SCHEDULED',
      notes: 'Seeded test shift (next week, unassigned)',
    });
  }

  await prisma.shift.createMany({ data: shiftRows });

  const createdCurrentShifts = await prisma.shift.findMany({
    where: { scheduleWeekId: currentWeek.id },
    orderBy: { startTime: 'asc' },
    select: { id: true, employeeId: true },
  });

  const admin = users.find((u) => u.role === 'ADMIN');

  await prisma.timeOffRequest.deleteMany({ where: { orgId: org.id, reason: { startsWith: 'Seed:' } } });
  if (employees[0]) {
    await prisma.timeOffRequest.createMany({
      data: [
        {
          orgId: org.id,
          employeeId: employees[0].id,
          startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
          endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6),
          type: 'VACATION',
          reason: 'Seed: Family trip',
          status: 'PENDING',
          approvedById: null,
        },
        {
          orgId: org.id,
          employeeId: employees[0].id,
          startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 12),
          endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 12),
          type: 'SICK',
          reason: 'Seed: Sick day',
          status: 'APPROVED',
          approvedById: admin?.id ?? null,
        },
      ],
    });
  }

  await prisma.shiftSwapRequest.deleteMany({ where: { orgId: org.id, reason: { startsWith: 'Seed:' } } });
  if (employees.length >= 2 && createdCurrentShifts.length >= 2) {
    const requestorShift = createdCurrentShifts.find((s) => s.employeeId === employees[0].id) ?? createdCurrentShifts[0];
    const requestedShift = createdCurrentShifts.find((s) => s.employeeId === employees[1].id) ?? createdCurrentShifts[1];

    await prisma.shiftSwapRequest.create({
      data: {
        orgId: org.id,
        requestorId: employees[0].id,
        responderId: employees[1].id,
        proposedShiftIds: JSON.stringify([requestorShift.id]),
        requestedShiftIds: JSON.stringify([requestedShift.id]),
        type: 'FULL_DAY',
        reason: 'Seed: Need schedule change for appointment',
        status: 'PENDING',
      },
    });
  }

  console.log(`Seeded org: ${org.name}`);
  console.log(`  Users: ${users.length} (employees: ${employees.length})`);
  console.log(`  Departments: ${departments.length}`);
  console.log(`  Locations: ${locations.length}`);
  console.log(`  Weeks: 2 (current + next)`);
  console.log(`  Shifts created: ${shiftRows.length}`);
}

async function main() {
  await seedOrganization({
    name: 'HealthCare Solutions',
    timezone: 'America/New_York',
    users: [
      { email: 'admin@healthcare.com', firstName: 'Sarah', lastName: 'Johnson', role: 'ADMIN', password: 'admin12345' },
      { email: 'manager@healthcare.com', firstName: 'Michael', lastName: 'Chen', role: 'MANAGER', password: 'manager12345' },
      { email: 'emily.davis@healthcare.com', firstName: 'Emily', lastName: 'Davis', role: 'EMPLOYEE', password: 'employee12345' },
      { email: 'james.wilson@healthcare.com', firstName: 'James', lastName: 'Wilson', role: 'EMPLOYEE', password: 'employee12345' },
      { email: 'amber.taylor@healthcare.com', firstName: 'Amber', lastName: 'Taylor', role: 'EMPLOYEE', password: 'employee12345' },
      { email: 'nora.garcia@healthcare.com', firstName: 'Nora', lastName: 'Garcia', role: 'EMPLOYEE', password: 'employee12345' },
    ],
    departments: [
      { name: 'Front Office', description: 'Reception and administration' },
      { name: 'Patient Care', description: 'Primary care and treatment' },
      { name: 'Operations', description: 'Back-office operations and support' },
    ],
    locations: [
      { name: 'Main Clinic', address: '123 Medical Plaza, Suite 100, Miami, FL', phone: '305-555-1001' },
      { name: 'Downtown Office', address: '456 Health Way, Suite 200, Miami, FL', phone: '305-555-2002' },
      { name: 'West Branch', address: '789 Wellness Blvd, Miami, FL', phone: '305-555-3003' },
    ],
  });

  await seedOrganization({
    name: 'Sunrise Dental Group',
    timezone: 'America/Chicago',
    users: [
      { email: 'admin@sunrisedental.com', firstName: 'Olivia', lastName: 'Martinez', role: 'ADMIN', password: 'admin12345' },
      { email: 'manager@sunrisedental.com', firstName: 'Liam', lastName: 'Brooks', role: 'MANAGER', password: 'manager12345' },
      { email: 'ava.reed@sunrisedental.com', firstName: 'Ava', lastName: 'Reed', role: 'EMPLOYEE', password: 'employee12345' },
      { email: 'noah.king@sunrisedental.com', firstName: 'Noah', lastName: 'King', role: 'EMPLOYEE', password: 'employee12345' },
      { email: 'mia.ward@sunrisedental.com', firstName: 'Mia', lastName: 'Ward', role: 'EMPLOYEE', password: 'employee12345' },
    ],
    departments: [
      { name: 'Dental Assistants', description: 'Chairside support' },
      { name: 'Hygiene', description: 'Cleanings and preventive care' },
      { name: 'Front Desk', description: 'Scheduling and billing' },
    ],
    locations: [
      { name: 'Northside Clinic', address: '101 Smile Ave, Austin, TX', phone: '512-555-1101' },
      { name: 'Southside Clinic', address: '202 Bright St, Austin, TX', phone: '512-555-2202' },
    ],
  });

  console.log('\nSeed completed successfully with fake test data.');
  console.log('Sample login: admin@healthcare.com / admin12345');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
