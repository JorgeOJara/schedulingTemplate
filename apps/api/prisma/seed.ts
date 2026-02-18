import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/services/authService';

const prisma = new PrismaClient();

async function main() {
  // Create organization
  const org = await prisma.organization.upsert({
    where: { name: 'HealthCare Solutions' },
    update: {},
    create: {
      name: 'HealthCare Solutions',
      timezone: 'America/New_York',
      dailyOtcThreshold: 8,
      weeklyOtcThreshold: 40,
      minRestBetweenShifts: 8,
      maxHoursPerWeek: 40,
    },
  });
  console.log('Organization created:', org.name);

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@healthcare.com' },
    update: {},
    create: {
      email: 'admin@healthcare.com',
      passwordHash: adminPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: 'ADMIN',
      orgId: org.id,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log('Admin created:', admin.email);

  // Create manager user
  const managerPassword = await hashPassword('manager123');
  const manager = await prisma.user.upsert({
    where: { email: 'manager@healthcare.com' },
    update: {},
    create: {
      email: 'manager@healthcare.com',
      passwordHash: managerPassword,
      firstName: 'Michael',
      lastName: 'Chen',
      role: 'MANAGER',
      orgId: org.id,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log('Manager created:', manager.email);

  // Create employee users
  const employees = [
    { email: 'emily.davis@healthcare.com', firstName: 'Emily', lastName: 'Davis' },
    { email: 'james.wilson@healthcare.com', firstName: 'James', lastName: 'Wilson' },
    { email: 'amber.taylor@healthcare.com', firstName: 'Amber', lastName: 'Taylor' },
  ];

  for (const emp of employees) {
    const empPassword = await hashPassword('employee123');
    await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        passwordHash: empPassword,
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: 'EMPLOYEE',
        orgId: org.id,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log('Employee created:', emp.email);
  }

  // Create departments
  const departments = [
    { name: 'Front Office', description: 'Reception and administrative' },
    { name: 'Treatment Rooms', description: 'Patient care and procedures' },
    { name: 'Storage', description: 'Supply storage and preparation' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { name: dept.name, orgId: org.id },
      update: {},
      create: {
        name: dept.name,
        description: dept.description,
        orgId: org.id,
        active: true,
      },
    });
    console.log('Department created:', dept.name);
  }

  // Create locations
  const locations = [
    { name: 'Main Clinic', address: '123 Medical Plaza, Suite 100', phone: '555-1234' },
    { name: 'Satellite Office', address: '456 Health Way, Suite 200', phone: '555-5678' },
  ];

  for (const loc of locations) {
    await prisma.location.upsert({
      where: { name: loc.name, orgId: org.id },
      update: {},
      create: {
        name: loc.name,
        address: loc.address,
        phone: loc.phone,
        orgId: org.id,
        active: true,
      },
    });
    console.log('Location created:', loc.name);
  }

  // Get employee IDs
  const employeeUsers = await prisma.user.findMany({
    where: { orgId: org.id, role: 'EMPLOYEE' },
  });

  const employeeIds = employeeUsers.map(e => e.id);

  // Create current week schedule
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const week = await prisma.scheduleWeek.upsert({
    where: { orgId_startDate_endDate: { orgId: org.id, startDate: startOfWeek, endDate: endOfWeek } },
    update: {},
    create: {
      orgId: org.id,
      startDate: startOfWeek,
      endDate: endOfWeek,
      state: 'PUBLISHED',
      publishedAt: new Date(),
      version: 1,
    },
  });

  console.log('Schedule week created:', week.id);

  // Generate shifts for employees
  const shifts = [
    { employeeId: employeeIds[0], day: 0, startHour: 9, endHour: 17, dept: 0, loc: 0 },
    { employeeId: employeeIds[0], day: 1, startHour: 9, endHour: 17, dept: 0, loc: 0 },
    { employeeId: employeeIds[0], day: 2, startHour: 9, endHour: 17, dept: 0, loc: 0 },
    { employeeId: employeeIds[1], day: 0, startHour: 8, endHour: 16, dept: 1, loc: 0 },
    { employeeId: employeeIds[1], day: 1, startHour: 8, endHour: 16, dept: 1, loc: 0 },
    { employeeId: employeeIds[1], day: 2, startHour: 8, endHour: 16, dept: 1, loc: 1 },
    { employeeId: employeeIds[2], day: 0, startHour: 10, endHour: 18, dept: 2, loc: 0 },
    { employeeId: employeeIds[2], day: 1, startHour: 10, endHour: 18, dept: 2, loc: 0 },
    { employeeId: employeeIds[2], day: 3, startHour: 12, endHour: 20, dept: 1, loc: 0 },
  ];

  for (const shiftData of shifts) {
    const start = new Date(startOfWeek);
    start.setDate(startOfWeek.getDate() + shiftData.day);
    start.setHours(shiftData.startHour, 0, 0, 0);

    const end = new Date(start);
    end.setHours(shiftData.endHour, 0, 0, 0);

    const shift = await prisma.shift.create({
      data: {
        scheduleWeekId: week.id,
        employeeId: shiftData.employeeId,
        departmentId: (await prisma.department.findFirst({
          where: { orgId: org.id },
          skip: shiftData.dept,
          take: 1,
        }))?.id,
        locationId: (await prisma.location.findFirst({
          where: { orgId: org.id },
          skip: shiftData.loc,
          take: 1,
        }))?.id,
        startTime: start,
        endTime: end,
        breakDurationMinutes: 30,
        breakIsPaid: true,
        shiftType: 'REGULAR',
      },
    });
    console.log('Shift created for', shiftData.employeeId, ':', shiftData.day);
  }

  // Create sample time-off requests
  const timeOffRequests = [
    { startDate: new Date(), endDate: new Date(), type: 'VACATION', reason: 'Family vacation', status: 'PENDING' },
    { startDate: new Date(), endDate: new Date(), type: 'SICK', reason: 'Flu recovery', status: 'APPROVED' },
  ];

  for (const tor of timeOffRequests) {
    const request = await prisma.timeOffRequest.create({
      data: {
        orgId: org.id,
        employeeId: employeeIds[0],
        startDate: tor.startDate,
        endDate: tor.endDate,
        type: tor.type as any,
        reason: tor.reason,
        status: tor.status as any,
        approvedById: tor.status === 'APPROVED' ? admin.id : null,
      },
    });
    console.log('Time-off request created:', request.id);
  }

  // Create sample shift swap request
  const swap = await prisma.shiftSwapRequest.create({
    data: {
      orgId: org.id,
      requestorId: employeeIds[1],
      responderId: employeeIds[2],
      proposedShiftIds: JSON.stringify([shifts[4].id]), // Wednesday shift
      requestedShiftIds: JSON.stringify([shifts[6].id]), // Saturday shift
      type: 'FULL_DAY',
      reason: 'Need to swap shifts for personal reason',
      status: 'PENDING',
    },
  });
  console.log('Shift swap request created:', swap.id);

  console.log('\n✅ Seed completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
