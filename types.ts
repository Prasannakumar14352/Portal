

export enum DepartmentType {
  IT = 'IT',
  HR = 'HR',
  SALES = 'Sales',
  MARKETING = 'Marketing',
  FINANCE = 'Finance',
  OPERATIONS = 'Operations'
}

export enum EmployeeStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  ON_LEAVE = 'On Leave'
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface Department {
  id: string | number;
  name: string;
  description: string;
  managerId: string | number;
}

export interface Role {
  id: string | number;
  name: string;
  description: string;
}

export interface Project {
  id: string | number;
  name: string;
  description?: string;
  status: 'Active' | 'On Hold' | 'Completed';
  tasks: string[];
  dueDate?: string;
}

export interface Employee {
  /* Updated id to support both string and number */
  id: number | string;
  employeeId: string; // Business ID like EMP001
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: string;
  department: string; 
  departmentId?: string | number; 
  projectIds?: (string | number)[]; 
  joinDate: string;
  status: EmployeeStatus;
  salary: number;
  avatar: string;
  managerId?: string | number; 
  location?: { latitude: number; longitude: number; address: string };
  workLocation?: string;
  phone?: string;
  jobTitle?: string;
}

export interface LeaveTypeConfig {
  id: string | number;
  name: string;
  days: number;
  description: string;
  isActive: boolean;
  color?: string;
}

export enum LeaveStatus {
  PENDING = 'Pending', 
  PENDING_MANAGER = 'Pending Manager',
  PENDING_HR = 'Pending HR',
  APPROVED = 'Approved',
  REJECTED = 'Rejected'
}

export interface LeaveRequest {
  id: string | number;
  userId: string | number;
  userName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  attachmentUrl?: string;
  managerConsent?: boolean;
  notifyUserIds?: (string | number)[];
  approverId?: string | number;
  isUrgent?: boolean;
  managerComment?: string;
  hrComment?: string;
  createdAt?: string;
  employeeId?: string | number; 
  employeeName?: string;
}

export interface AttendanceRecord {
  id: string | number;
  employeeId: string | number;
  employeeName: string;
  date: string;
  checkIn: string; 
  checkOut: string; 
  checkInTime?: string; 
  checkOutTime?: string; 
  status: 'Present' | 'Absent' | 'Late';
  notes?: string; 
  workLocation?: string;
}

export interface TimeEntry {
  id: string | number;
  userId: string | number;
  projectId: string | number;
  task: string;
  date: string;
  durationMinutes: number; 
  extraMinutes?: number;   
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  isBillable: boolean;
  isExtra?: boolean; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
}

export enum UserRole {
  HR = 'HR Manager',
  MANAGER = 'Team Manager',
  EMPLOYEE = 'Employee'
}

export interface User {
  /* Updated id to support both string and number */
  id: number | string;
  employeeId: string;
  name: string;
  role: UserRole;
  avatar: string;
  managerId?: string | number;
  jobTitle?: string;
  departmentId?: string | number; 
  projectIds?: (string | number)[]; 
  phone?: string;
  location?: { latitude: number; longitude: number; address: string };
  workLocation?: string;
  hireDate?: string;
  email?: string; 
}

export interface Notification {
  id: string | number;
  userId: string | number; 
  title: string;
  message: string;
  time: string;
  read: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface Payslip {
  id: string | number;
  userId: string | number;
  userName: string;
  month: string;
  amount: number;
  currency?: string;
  status: 'Paid' | 'Processing';
  generatedDate: string;
  fileData?: string;
  fileName?: string;
}

export interface Holiday {
  id: string | number;
  name: string;
  date: string;
  type: 'Public' | 'Company';
}