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
  role: string;
  department: string; // Changed from Enum to string to support dynamic departments
  departmentId?: string; // Link to Department entity
  projectIds?: string[]; // Link to Project entities
  joinDate: string;
  status: EmployeeStatus;
  salary: number;
  avatar: string;
  managerId?: string; 
  // Added optional fields for Profile/Map features
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
  checkIn: string; // Display string e.g., "09:00 AM"
  checkOut: string; // Display string e.g., "06:00 PM"
  checkInTime?: string; // ISO string for calculation
  checkOutTime?: string; // ISO string for calculation
  status: 'Present' | 'Absent' | 'Late';
  notes?: string; // For early logout reasons
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
  departmentId?: string; // Added for Organization component
  projectIds?: string[]; // Added for Organization component
  // Optional for UI compatibility
  phone?: string;
  location?: { latitude: number; longitude: number; address: string };
  hireDate?: string;
  email?: string; // Added for Profile compatibility
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
  month: string;
  year: number;
  amount: number;
  pdfUrl: string; // Blob URL
  uploadedAt: string;
}