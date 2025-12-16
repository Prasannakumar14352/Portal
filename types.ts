
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
  id: string;
  name: string;
  description: string;
  managerId: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'Active' | 'On Hold' | 'Completed';
  tasks: string[];
  dueDate?: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string; // Added password field
  role: string;
  department: string; 
  departmentId?: string; 
  projectIds?: string[]; 
  joinDate: string;
  status: EmployeeStatus;
  salary: number;
  avatar: string;
  managerId?: string; 
  location?: { latitude: number; longitude: number; address: string };
  phone?: string;
  jobTitle?: string;
}

export interface LeaveTypeConfig {
  id: string;
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
  id: string;
  userId: string;
  userName: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  attachmentUrl?: string;
  managerConsent?: boolean;
  notifyUserIds?: string[];
  approverId?: string;
  isUrgent?: boolean;
  managerComment?: string;
  hrComment?: string;
  createdAt?: string;
  employeeId?: string; 
  employeeName?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
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
  id: string;
  userId: string;
  projectId: string;
  task: string;
  date: string;
  durationMinutes: number;
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  isBillable: boolean;
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
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  managerId?: string;
  jobTitle?: string;
  departmentId?: string; 
  projectIds?: string[]; 
  phone?: string;
  location?: { latitude: number; longitude: number; address: string };
  hireDate?: string;
  email?: string; 
}

export interface Notification {
  id: string;
  userId: string; 
  title: string;
  message: string;
  time: string;
  read: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface Payslip {
  id: string;
  userId: string;
  userName: string;
  month: string; // "May 2024"
  amount: number;
  currency?: string; // e.g. "₹", "$", "€"
  status: 'Paid' | 'Processing';
  generatedDate: string;
  fileData?: string; // Base64 Data URL for the PDF
  fileName?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: 'Public' | 'Company';
}
