
import { Employee, Department, Project, LeaveRequest, LeaveTypeConfig, AttendanceRecord, TimeEntry, Notification, Holiday, Payslip, Role, DepartmentType, EmployeeStatus, LeaveStatus } from '../types';

// Helper to generate consistent dates
const getMockDate = () => {
    const now = new Date();
    // Set check-in to 9 AM
    const checkIn = new Date(now);
    checkIn.setHours(9, 0, 0, 0);
    
    // If 9 AM is in the future (e.g., currently 2 AM), assume the session started yesterday at 9 AM
    if (checkIn > now) {
        checkIn.setDate(checkIn.getDate() - 1);
    }
    
    return {
        dateStr: checkIn.toLocaleDateString('en-CA'), // YYYY-MM-DD local
        checkInIso: checkIn.toISOString()
    };
};

const { dateStr: todayStr, checkInIso } = getMockDate();

// Mock Departments - Using numeric IDs
export const mockDepartments: Department[] = [
  { id: 1, name: 'Engineering', description: 'Software Development and DevOps', managerId: 3 },
  { id: 2, name: 'Human Resources', description: 'People Operations and Recruitment', managerId: 1 },
  { id: 3, name: 'Sales', description: 'Global Sales and Partnerships', managerId: 4 }
];

// Mock Roles - Using numeric IDs
export const mockRoles: Role[] = [
  { id: 1, name: 'HR Manager', description: 'Manages human resources, recruitment, and employee relations.' },
  { id: 2, name: 'Team Manager', description: 'Leads a specific team or department unit.' },
  { id: 3, name: 'Employee', description: 'Standard employee role with basic access.' },
  { id: 4, name: 'Software Engineer', description: 'Develops and maintains software applications.' },
  { id: 5, name: 'Sales Manager', description: 'Oversees sales strategies and client relationships.' },
  { id: 6, name: 'Marketing Lead', description: 'Coordinates marketing campaigns and branding.' }
];

// Mock Projects - Using numeric IDs
export const mockProjects: Project[] = [
  { 
    id: 1, 
    name: 'Website Redesign', 
    description: 'Overhaul of corporate website', 
    status: 'Active', 
    tasks: ['Design Mockups', 'Frontend Dev', 'Backend API', 'Testing'],
    dueDate: '2024-12-31'
  },
  { 
    id: 2, 
    name: 'Mobile App Launch', 
    description: 'iOS and Android app release', 
    status: 'On Hold', 
    tasks: ['User Research', 'Prototyping'],
    dueDate: '2025-03-15'
  },
  { 
    id: 3, 
    name: 'Internal HR Tool', 
    description: 'Employee management system', 
    status: 'Active', 
    tasks: ['Requirements', 'Database Design'],
    dueDate: '2024-10-01'
  }
];

// Mock Employees - Using numeric IDs
export const mockEmployees: Employee[] = [
  {
    id: 1,
    employeeId: 'EMP001',
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'superadmin@empower.com',
    password: 'password123',
    role: 'HR Manager',
    department: DepartmentType.HR,
    departmentId: 2,
    joinDate: '2020-01-15',
    status: EmployeeStatus.ACTIVE,
    salary: 95000,
    avatar: 'https://i.pravatar.cc/150?u=1',
    location: { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY' },
    workLocation: 'USA',
    phone: '+1 (555) 010-1010',
    jobTitle: 'Head of HR',
    projectIds: [],
    settings: {
        notifications: { emailLeaves: true, emailAttendance: true, pushWeb: true, pushMobile: true, systemAlerts: true },
        appConfig: { aiAssistant: true, azureSync: true, strictSso: false }
    }
  },
  {
    id: 2,
    employeeId: 'EMP002',
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.j@empower.com',
    password: 'password123',
    role: 'Employee',
    department: DepartmentType.IT,
    departmentId: 1,
    joinDate: '2021-03-10',
    status: EmployeeStatus.ACTIVE,
    salary: 85000,
    avatar: 'https://i.pravatar.cc/150?u=2',
    managerId: 3,
    location: { latitude: 37.7749, longitude: -122.4194, address: 'San Francisco, CA' },
    workLocation: 'WFH India',
    phone: '+1 (555) 020-2020',
    jobTitle: 'Frontend Developer',
    projectIds: [1, 3],
    settings: {
        notifications: { emailLeaves: true, emailAttendance: false, pushWeb: true, pushMobile: true, systemAlerts: false },
        appConfig: { aiAssistant: true, azureSync: false, strictSso: false }
    }
  },
  {
    id: 3,
    employeeId: 'EMP003',
    firstName: 'Bob',
    lastName: 'Smith',
    email: 'bob.smith@empower.com',
    password: 'password123',
    role: 'Team Manager',
    department: DepartmentType.IT,
    departmentId: 1,
    joinDate: '2019-06-20',
    status: EmployeeStatus.ACTIVE,
    salary: 110000,
    avatar: 'https://i.pravatar.cc/150?u=3',
    location: { latitude: 34.0522, longitude: -118.2437, address: 'Los Angeles, CA' },
    workLocation: 'Office HQ India',
    phone: '+1 (555) 030-3030',
    jobTitle: 'Engineering Manager',
    projectIds: [1, 2],
    settings: {
        notifications: { emailLeaves: true, emailAttendance: true, pushWeb: true, pushMobile: false, systemAlerts: true },
        appConfig: { aiAssistant: true, azureSync: false, strictSso: false }
    }
  },
  {
    id: 4,
    employeeId: 'EMP004',
    firstName: 'David',
    lastName: 'Chen',
    email: 'david.c@empower.com',
    password: 'password123',
    role: 'Team Manager',
    department: DepartmentType.SALES,
    departmentId: 3,
    joinDate: '2022-01-05',
    status: EmployeeStatus.ACTIVE,
    salary: 90000,
    avatar: 'https://i.pravatar.cc/150?u=4',
    location: { latitude: 41.8781, longitude: -87.6298, address: 'Chicago, IL' },
    workLocation: 'UAE Office',
    phone: '+1 (555) 040-4040',
    jobTitle: 'Sales Lead',
    projectIds: [],
    settings: {
        notifications: { emailLeaves: true, emailAttendance: false, pushWeb: false, pushMobile: true, systemAlerts: true },
        appConfig: { aiAssistant: false, azureSync: false, strictSso: false }
    }
  }
];

// Mock Leave Types
export const mockLeaveTypes: LeaveTypeConfig[] = [
  { id: 1, name: 'Annual Leave', days: 20, description: 'Standard paid time off', isActive: true, color: 'text-emerald-600' },
  { id: 2, name: 'Sick Leave', days: 10, description: 'Medical leave', isActive: true, color: 'text-red-600' },
  { id: 3, name: 'Casual Leave', days: 5, description: 'Personal errands', isActive: true, color: 'text-blue-600' },
  { id: 4, name: 'Unpaid Leave', days: 365, description: 'Leave without pay', isActive: true, color: 'text-gray-600' }
];

// Mock Leaves
export const mockLeaves: LeaveRequest[] = [
  {
    id: 1,
    userId: 2,
    userName: 'Alice Johnson',
    type: 'Annual Leave',
    startDate: '2024-05-10',
    endDate: '2024-05-15',
    reason: 'Family Vacation',
    status: LeaveStatus.APPROVED,
    createdAt: '2024-04-20T10:00:00Z',
    approverId: 3
  },
  {
    id: 2,
    userId: 2,
    userName: 'Alice Johnson',
    type: 'Sick Leave',
    startDate: '2024-06-01',
    endDate: '2024-06-02',
    reason: 'Flu',
    status: LeaveStatus.PENDING_MANAGER,
    createdAt: '2024-05-30T08:00:00Z',
    approverId: 3
  },
  {
    id: 3,
    userId: 3,
    userName: 'Bob Smith',
    type: 'Annual Leave',
    startDate: '2024-07-01',
    endDate: '2024-07-10',
    reason: 'Summer Trip',
    status: LeaveStatus.PENDING_HR,
    createdAt: '2024-06-15T09:00:00Z',
    approverId: 1
  }
];

// Mock Attendance
export const mockAttendance: AttendanceRecord[] = [
  {
    id: 1,
    employeeId: 2,
    employeeName: 'Alice Johnson',
    date: todayStr,
    checkIn: '09:00 AM',
    checkInTime: checkInIso,
    checkOut: '',
    status: 'Present',
    workLocation: 'WFH India'
  },
  {
    id: 2,
    employeeId: 3,
    employeeName: 'Bob Smith',
    date: todayStr,
    checkIn: '08:30 AM',
    checkInTime: checkInIso,
    checkOut: '05:30 PM',
    status: 'Present',
    workLocation: 'Office HQ India'
  }
];

// Mock Time Entries
export const mockTimeEntries: TimeEntry[] = [
  {
    id: 1,
    userId: 2,
    projectId: 1,
    task: 'Frontend Dev',
    date: todayStr,
    durationMinutes: 240,
    description: 'Working on React components',
    status: 'Pending',
    isBillable: true
  },
  {
    id: 2,
    userId: 3,
    projectId: 1,
    task: 'Backend API',
    date: todayStr,
    durationMinutes: 120,
    description: 'API endpoint optimization',
    status: 'Approved',
    isBillable: true
  }
];

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: 1,
    userId: 2,
    title: 'Leave Approved',
    message: 'Your leave request for May 10-15 has been approved.',
    time: '2 days ago',
    read: true,
    type: 'success'
  },
  {
    id: 2,
    userId: 3,
    title: 'New Leave Request',
    message: 'Alice Johnson has requested Sick Leave.',
    time: '1 hour ago',
    read: false,
    type: 'info'
  }
];

// Mock Holidays
export const mockHolidays: Holiday[] = [
  { id: 1, name: 'New Year Day', date: '2024-01-01', type: 'Public' },
  { id: 2, name: 'Independence Day', date: '2024-07-04', type: 'Public' },
  { id: 3, name: 'Thanksgiving', date: '2024-11-28', type: 'Public' },
  { id: 4, name: 'Christmas', date: '2024-12-25', type: 'Public' },
  { id: 5, name: 'Company Founder Day', date: '2024-08-15', type: 'Company' }
];

// Mock Payslips
export const mockPayslips: Payslip[] = [
  {
    id: 1,
    userId: 2,
    userName: 'Alice Johnson',
    month: 'April 2024',
    amount: 7083,
    currency: '$',
    status: 'Paid',
    generatedDate: '2024-04-30T10:00:00Z'
  },
  {
    id: 2,
    userId: 3,
    userName: 'Bob Smith',
    month: 'April 2024',
    amount: 9166,
    currency: '$',
    status: 'Paid',
    generatedDate: '2024-04-30T10:00:00Z'
  }
];
