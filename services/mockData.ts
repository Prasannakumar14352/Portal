
import { Employee, Department, Project, LeaveRequest, LeaveTypeConfig, AttendanceRecord, TimeEntry, Notification, Holiday, Payslip, UserRole, DepartmentType, EmployeeStatus, LeaveStatus } from '../types';

// Mock Departments
export const mockDepartments: Department[] = [
  { id: 'd1', name: 'Engineering', description: 'Software Development and DevOps', managerId: 'u3' },
  { id: 'd2', name: 'Human Resources', description: 'People Operations and Recruitment', managerId: 'super1' },
  { id: 'd3', name: 'Sales', description: 'Global Sales and Partnerships', managerId: 'u4' }
];

// Mock Projects
export const mockProjects: Project[] = [
  { 
    id: 'p1', 
    name: 'Website Redesign', 
    description: 'Overhaul of corporate website', 
    status: 'Active', 
    tasks: ['Design Mockups', 'Frontend Dev', 'Backend API', 'Testing'],
    dueDate: '2024-12-31'
  },
  { 
    id: 'p2', 
    name: 'Mobile App Launch', 
    description: 'iOS and Android app release', 
    status: 'On Hold', 
    tasks: ['User Research', 'Prototyping'],
    dueDate: '2025-03-15'
  },
  { 
    id: 'p3', 
    name: 'Internal HR Tool', 
    description: 'Employee management system', 
    status: 'Active', 
    tasks: ['Requirements', 'Database Design'],
    dueDate: '2024-10-01'
  }
];

// Mock Employees
export const mockEmployees: Employee[] = [
  {
    id: 'super1',
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'superadmin@empower.com',
    password: 'password123',
    role: 'HR Manager',
    department: DepartmentType.HR,
    departmentId: 'd2',
    joinDate: '2020-01-15',
    status: EmployeeStatus.ACTIVE,
    salary: 95000,
    avatar: 'https://i.pravatar.cc/150?u=super1',
    location: { latitude: 40.7128, longitude: -74.0060, address: 'New York, NY' },
    phone: '+1 (555) 010-1010',
    jobTitle: 'Head of HR',
    projectIds: []
  },
  {
    id: 'u2',
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.j@empower.com',
    password: 'password123',
    role: 'Employee',
    department: DepartmentType.IT,
    departmentId: 'd1',
    joinDate: '2021-03-10',
    status: EmployeeStatus.ACTIVE,
    salary: 85000,
    avatar: 'https://i.pravatar.cc/150?u=u2',
    managerId: 'u3',
    location: { latitude: 37.7749, longitude: -122.4194, address: 'San Francisco, CA' },
    phone: '+1 (555) 020-2020',
    jobTitle: 'Frontend Developer',
    projectIds: ['p1', 'p3']
  },
  {
    id: 'u3',
    firstName: 'Bob',
    lastName: 'Smith',
    email: 'bob.smith@empower.com',
    password: 'password123',
    role: 'Team Manager',
    department: DepartmentType.IT,
    departmentId: 'd1',
    joinDate: '2019-06-20',
    status: EmployeeStatus.ACTIVE,
    salary: 110000,
    avatar: 'https://i.pravatar.cc/150?u=u3',
    location: { latitude: 34.0522, longitude: -118.2437, address: 'Los Angeles, CA' },
    phone: '+1 (555) 030-3030',
    jobTitle: 'Engineering Manager',
    projectIds: ['p1', 'p2']
  },
  {
    id: 'u4',
    firstName: 'David',
    lastName: 'Chen',
    email: 'david.c@empower.com',
    password: 'password123',
    role: 'Team Manager',
    department: DepartmentType.SALES,
    departmentId: 'd3',
    joinDate: '2022-01-05',
    status: EmployeeStatus.ACTIVE,
    salary: 90000,
    avatar: 'https://i.pravatar.cc/150?u=u4',
    location: { latitude: 41.8781, longitude: -87.6298, address: 'Chicago, IL' },
    phone: '+1 (555) 040-4040',
    jobTitle: 'Sales Lead',
    projectIds: []
  }
];

// Mock Leave Types
export const mockLeaveTypes: LeaveTypeConfig[] = [
  { id: 'lt1', name: 'Annual Leave', days: 20, description: 'Standard paid time off', isActive: true, color: 'text-emerald-600' },
  { id: 'lt2', name: 'Sick Leave', days: 10, description: 'Medical leave', isActive: true, color: 'text-red-600' },
  { id: 'lt3', name: 'Casual Leave', days: 5, description: 'Personal errands', isActive: true, color: 'text-blue-600' },
  { id: 'lt4', name: 'Unpaid Leave', days: 365, description: 'Leave without pay', isActive: true, color: 'text-gray-600' }
];

// Mock Leaves
export const mockLeaves: LeaveRequest[] = [
  {
    id: 'l1',
    userId: 'u2',
    userName: 'Alice Johnson',
    type: 'Annual Leave',
    startDate: '2024-05-10',
    endDate: '2024-05-15',
    reason: 'Family Vacation',
    status: LeaveStatus.APPROVED,
    createdAt: '2024-04-20T10:00:00Z',
    approverId: 'u3'
  },
  {
    id: 'l2',
    userId: 'u2',
    userName: 'Alice Johnson',
    type: 'Sick Leave',
    startDate: '2024-06-01',
    endDate: '2024-06-02',
    reason: 'Flu',
    status: LeaveStatus.PENDING_MANAGER,
    createdAt: '2024-05-30T08:00:00Z',
    approverId: 'u3'
  },
  {
    id: 'l3',
    userId: 'u3',
    userName: 'Bob Smith',
    type: 'Annual Leave',
    startDate: '2024-07-01',
    endDate: '2024-07-10',
    reason: 'Summer Trip',
    status: LeaveStatus.PENDING_HR,
    createdAt: '2024-06-15T09:00:00Z',
    approverId: 'super1'
  }
];

// Mock Attendance
const today = new Date().toISOString().split('T')[0];
export const mockAttendance: AttendanceRecord[] = [
  {
    id: 'a1',
    employeeId: 'u2',
    employeeName: 'Alice Johnson',
    date: today,
    checkIn: '09:00 AM',
    checkInTime: new Date(new Date().setHours(9, 0, 0)).toISOString(),
    checkOut: '',
    status: 'Present'
  },
  {
    id: 'a2',
    employeeId: 'u3',
    employeeName: 'Bob Smith',
    date: today,
    checkIn: '08:30 AM',
    checkInTime: new Date(new Date().setHours(8, 30, 0)).toISOString(),
    checkOut: '05:30 PM',
    status: 'Present'
  }
];

// Mock Time Entries
export const mockTimeEntries: TimeEntry[] = [
  {
    id: 't1',
    userId: 'u2',
    projectId: 'p1',
    task: 'Frontend Dev',
    date: today,
    durationMinutes: 240,
    description: 'Working on React components',
    status: 'Pending',
    isBillable: true
  },
  {
    id: 't2',
    userId: 'u3',
    projectId: 'p1',
    task: 'Backend API',
    date: today,
    durationMinutes: 120,
    description: 'API endpoint optimization',
    status: 'Approved',
    isBillable: true
  }
];

// Mock Notifications
export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    userId: 'u2',
    title: 'Leave Approved',
    message: 'Your leave request for May 10-15 has been approved.',
    time: '2 days ago',
    read: true,
    type: 'success'
  },
  {
    id: 'n2',
    userId: 'u3',
    title: 'New Leave Request',
    message: 'Alice Johnson has requested Sick Leave.',
    time: '1 hour ago',
    read: false,
    type: 'info'
  }
];

// Mock Holidays
export const mockHolidays: Holiday[] = [
  { id: 'h1', name: 'New Year Day', date: '2024-01-01', type: 'Public' },
  { id: 'h2', name: 'Independence Day', date: '2024-07-04', type: 'Public' },
  { id: 'h3', name: 'Thanksgiving', date: '2024-11-28', type: 'Public' },
  { id: 'h4', name: 'Christmas', date: '2024-12-25', type: 'Public' },
  { id: 'h5', name: 'Company Founder Day', date: '2024-08-15', type: 'Company' }
];

// Mock Payslips
export const mockPayslips: Payslip[] = [
  {
    id: 'pay1',
    userId: 'u2',
    userName: 'Alice Johnson',
    month: 'April 2024',
    amount: 7083,
    currency: '$',
    status: 'Paid',
    generatedDate: '2024-04-30T10:00:00Z'
  },
  {
    id: 'pay2',
    userId: 'u3',
    userName: 'Bob Smith',
    month: 'April 2024',
    amount: 9166,
    currency: '$',
    status: 'Paid',
    generatedDate: '2024-04-30T10:00:00Z'
  }
];
