import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Download, CheckCircle2, UploadCloud, Info, FileText, Search, Eye, EyeOff, ChevronLeft, ChevronRight, Edit2, Save, X, Trash2, AlertTriangle, Lock, FileSearch } from 'lucide-react';
import { UserRole, Payslip } from '../types';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import DraggableModal from './DraggableModal';

// Handle ES Module import structure
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Use the worker from esm.sh to ensure version compatibility with the main library
if (pdfjs.GlobalWorkerOptions) {
  // Dynamically use the library's version to fetch the matching worker
  // This prevents mismatch errors when the library version updates (e.g. via ^4.0.379 resolving to 4.10.38)
  const workerVersion = pdfjs.version || '4.10.38';
  pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${workerVersion}/build/pdf.worker.min.mjs`;
}

const Payslips = () => {
  const { payslips, currentUser, employees, showToast, manualAddPayslip, updatePayslip, deletePayslip } = useAppContext();
  const [month, setMonth] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isHR = currentUser?.role === UserRole.HR || currentUser?.role === UserRole.ADMIN;
  
  // View State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  // Default showValues to TRUE if not HR (Employees see their own data by default), FALSE for HR (Privacy by default)
  const [showValues, setShowValues] = useState(!isHR); 

  // Edit Amount State
  const [editingSlip, setEditingSlip] = useState<Payslip | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');

  // Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [payslipToDelete, setPayslipToDelete] = useState<Payslip | null>(null);

  const currentYear = new Date().getFullYear();

  // Helper for ID comparison robustness
  const isOwner = (slipUserId: string | number, currentUserId?: string | number) => {
      if (!currentUserId || !slipUserId) return false;
      return String(slipUserId).trim() === String(currentUserId).trim();
  };

  // Helper to extract text from PDF ArrayBuffer
  const extractNetPay = async (arrayBuffer: ArrayBuffer): Promise<{ amount: number, currency: string } | null> => {
    try {
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        // Scan first page mostly sufficient for Net Pay
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];
        
        // Strategy 1: Iterate items to find label and subsequent number (Reading Order)
        for (let i = 0; i < items.length; i++) {
            const itemStr = items[i].str;
            const str = itemStr.trim().toLowerCase();
            
            if (str.includes('net pay') || str.includes('net salary') || str.includes('take home') || str.includes('net payable') || str.includes('rounded total')) {
                const sameLineMatch = itemStr.match(/[\d,]+\.?\d{0,2}/g);
                if (sameLineMatch) {
                     const candidate = sameLineMatch[sameLineMatch.length - 1];
                     const val = parseFloat(candidate.replace(/,/g, ''));
                     if (!isNaN(val) && val > 0) {
                         let currency = '₹';
                         if (itemStr.toUpperCase().includes('USD') || itemStr.includes('$')) currency = '$';
                         else if (itemStr.toUpperCase().includes('EUR') || itemStr.includes('€')) currency = '€';
                         return { amount: val, currency };
                     }
                }

                for (let j = 1; j <= 6; j++) { 
                    if (i + j >= items.length) break;
                    const nextStr = items[i + j].str.trim();
                    if (!nextStr) continue; 

                    const cleanStr = nextStr.replace(/,/g, '').replace(/[^0-9.]/g, ''); 
                    if (cleanStr && !isNaN(parseFloat(cleanStr))) {
                        const amount = parseFloat(cleanStr);
                        let currency = '₹'; 
                        const combinedContext = (itemStr + nextStr).toUpperCase();
                        
                        if (combinedContext.includes('$') || combinedContext.includes('USD')) currency = '$';
                        else if (combinedContext.includes('€') || combinedContext.includes('EUR')) currency = '€';
                        else if (combinedContext.includes('£') || combinedContext.includes('GBP')) currency = '£';
                        
                        if (amount > 0) {
                            return { amount, currency };
                        }
                    }
                }
            }
        }

        return null;
    } catch (e) {
        console.error("PDF Parsing Error:", e);
        return null;
    }
  };

  // Import Handler
  const handleZipImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || !e.target.files[0]) return;
      
      const file = e.target.files[0];
      if (!month) {
          showToast("Please select a month first to tag imported payslips.", "warning");
          return;
      }

      setIsProcessing(true);
      try {
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);
          let importedCount = 0;
          let skippedCount = 0;
          let parsedAmounts = 0;
          let mismatchCount = 0;

          const filePromises: Promise<void>[] = [];
          
          const monthMap: Record<string, string> = {
              'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
              'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
              'january': '01', 'february': '02', 'march': '03', 'april': '04', 'june': '06',
              'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12'
          };

          contents.forEach((relativePath, zipEntry) => {
              if (!zipEntry.dir && (zipEntry.name.endsWith('.pdf') || zipEntry.name.endsWith('.PDF'))) {
                  filePromises.push((async () => {
                      const normalizedName = zipEntry.name;
                      let matchedEmployee;
                      let fileDateKey: string | null = null;

                      // 1. Strict Parsing: Try to extract Month, Year, and Name from specific format
                      // Format: IST Salary Slip Month Of [Mmm-YYYY]_[FirstName] [LastName].pdf
                      const strictMatch = normalizedName.match(/Month\s+Of\s+([A-Za-z]+)[-_](\d{4})[_\s](.+?)\.pdf$/i);

                      if (strictMatch) {
                          const fileMonthStr = strictMatch[1].toLowerCase();
                          const fileYear = strictMatch[2];
                          const namePart = strictMatch[3].trim().toLowerCase();
                          
                          const fileMonthNum = monthMap[fileMonthStr];
                          if (fileMonthNum) {
                              fileDateKey = `${fileYear}-${fileMonthNum}`;
                          }

                          // Attempt precise name match first
                          matchedEmployee = employees.find(emp => {
                              const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
                              // Match "First Last" OR "First" (if only first provided)
                              return fullName === namePart || 
                                     namePart.includes(fullName) || 
                                     (namePart.includes(emp.firstName.toLowerCase()) && namePart.includes(emp.lastName.toLowerCase()));
                          });
                      }

                      // 2. Loose Parsing Fallback: If name not found by strict pattern
                      if (!matchedEmployee) {
                          const normalizedNameLower = normalizedName.toLowerCase();
                          matchedEmployee = employees.find(emp => {
                              const fname = emp.firstName.toLowerCase();
                              const lname = emp.lastName.toLowerCase();
                              // Simple inclusion check
                              return normalizedNameLower.includes(fname) && normalizedNameLower.includes(lname);
                          });
                      }

                      // 3. Date Validation Fallback: If date not extracted by strict pattern
                      if (!fileDateKey) {
                          const dateMatch = normalizedName.match(/Month\s+Of\s+([A-Za-z]+)[-_](\d{4})/i);
                          if (dateMatch) {
                              const fileMonthStr = dateMatch[1].toLowerCase();
                              const fileYear = dateMatch[2];
                              const fileMonthNum = monthMap[fileMonthStr];
                              if (fileMonthNum) {
                                  fileDateKey = `${fileYear}-${fileMonthNum}`;
                              }
                          }
                      }

                      // Check Mismatch
                      if (fileDateKey && fileDateKey !== month) {
                          mismatchCount++;
                          console.warn(`Skipping ${normalizedName}: Month mismatch (${fileDateKey} vs selected ${month})`);
                          return;
                      }

                      if (matchedEmployee) {
                          const exists = payslips.some(p => String(p.userId) === String(matchedEmployee.id) && p.month === month);
                          
                          if (!exists) {
                              const arrayBuffer = await zipEntry.async("arraybuffer");
                              const extractedData = await extractNetPay(arrayBuffer);
                              const netPay = extractedData ? extractedData.amount : null;
                              const currency = extractedData ? extractedData.currency : '₹';

                              if (netPay !== null) parsedAmounts++;

                              let dataUrl = undefined;
                              try {
                                const base64String = await zipEntry.async("base64");
                                dataUrl = `data:application/pdf;base64,${base64String}`;
                              } catch(e) {
                                console.warn("File too large to store in memory/storage", zipEntry.name);
                              }

                              await manualAddPayslip({
                                  id: `pay-imp-${Math.random().toString(36).substr(2,9)}`,
                                  userId: matchedEmployee.id,
                                  userName: `${matchedEmployee.firstName} ${matchedEmployee.lastName}`,
                                  month: month,
                                  amount: netPay !== null ? netPay : (matchedEmployee.salary ? (matchedEmployee.salary / 12) : 0),
                                  currency: currency,
                                  status: 'Paid',
                                  generatedDate: new Date().toISOString(),
                                  fileData: dataUrl,
                                  fileName: zipEntry.name
                              });
                              importedCount++;
                          } else {
                              skippedCount++;
                          }
                      }
                  })());
              }
          });

          await Promise.all(filePromises);
          
          if (mismatchCount > 0) {
             showToast(`Skipped ${mismatchCount} files that did not match the selected month (${month}).`, "error");
          }

          if (importedCount > 0) {
             let msg = `Successfully imported ${importedCount} payslips.`;
             if (parsedAmounts > 0) msg += ` Extracted Net Pay from ${parsedAmounts} files.`;
             showToast(msg, "success");
          } else if (skippedCount > 0 && mismatchCount === 0) {
             showToast(`No new payslips. ${skippedCount} duplicates found.`, "info");
          } else if (importedCount === 0 && mismatchCount === 0) {
             showToast("No matching employee payslips found in the ZIP.", "warning");
          }

      } catch (err: any) {
          console.error(err);
          showToast("Failed to process ZIP file.", "error");
      } finally {
          setIsProcessing(false);
          if(fileInputRef.current) fileInputRef.current.value = ''; 
      }
  };

  const handleDownload = (slip: Payslip) => {
    if (slip.fileData) {
        const link = document.createElement('a');
        link.href = slip.fileData;
        link.download = slip.fileName || `Payslip_${slip.userName}_${slip.month}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Download started.", "success");
    } else {
        showToast("File not available. This is likely a demo record.", "warning");
    }
  };

  const handleView = (slip: Payslip) => {
    if (slip.fileData) {
       const win = window.open();
       if(win) {
           win.document.write(`<iframe src="${slip.fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
       }
    } else {
       showToast("Preview not available", "warning");
    }
  };

  const openEditAmount = (slip: Payslip) => {
      setEditingSlip(slip);
      setEditAmount(slip.amount.toString());
  };

  const saveEditedAmount = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingSlip) return;
      const amount = parseFloat(editAmount);
      if (isNaN(amount) || amount < 0) {
          showToast("Please enter a valid amount", "error");
          return;
      }
      await updatePayslip({ ...editingSlip, amount });
      setEditingSlip(null);
      showToast("Payslip amount corrected", "success");
  };

  const handleDeleteClick = (slip: Payslip) => {
      setPayslipToDelete(slip);
      setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
      if (payslipToDelete) {
          await deletePayslip(payslipToDelete.id);
          setShowDeleteConfirm(false);
          setPayslipToDelete(null);
          showToast("Payslip deleted successfully", "success");
      }
  };

  // Filter and Pagination Logic
  const visiblePayslips = useMemo(() => {
    // If HR/Admin, show all. If Employee, show ONLY their own.
    // This filter is CRITICAL: Employees should never see the full list in 'filtered'.
    let filtered = isHR ? payslips : payslips.filter(p => isOwner(p.userId, currentUser?.id));
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.month.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (isHR && p.userName.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
    return filtered.sort((a, b) => new Date(b.generatedDate).getTime() - new Date(a.generatedDate).getTime());
  }, [payslips, currentUser, isHR, searchTerm]);

  const totalPages = Math.ceil(visiblePayslips.length / itemsPerPage);
  const paginatedPayslips = visiblePayslips.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  const summaryStats = useMemo(() => {
      // Robust calculation for current user only
      const userSlips = payslips.filter(p => isOwner(p.userId, currentUser?.id));
      
      const totalCount = userSlips.length;
      const totalAmount = userSlips.reduce((sum, p) => sum + p.amount, 0);
      const thisYearAmount = userSlips.reduce((sum, p) => {
          if (p.month.includes(currentYear.toString())) {
              return sum + p.amount;
          }
          return sum;
      }, 0);
      const thisYearCount = userSlips.filter(p => p.month.includes(currentYear.toString())).length;
      const displayCurrency = userSlips.length > 0 ? (userSlips[0].currency || '₹') : '₹';

      return { totalCount, totalAmount, thisYearAmount, thisYearCount, displayCurrency };
  }, [payslips, currentUser, currentYear]);

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Payslips</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">View and download your salary payslips.</p>
            </div>
            
            {isHR && (
                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-end sm:items-center">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-full sm:w-auto">
                        <input 
                            type="month" 
                            className="border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-emerald-500 bg-transparent dark:text-slate-100"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                        />
                        <div className="relative">
                            <input type="file" accept=".zip" ref={fileInputRef} onChange={handleZipImport} className="hidden" />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={!month || isProcessing}
                                className="bg-emerald-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                            >
                                <UploadCloud size={16}/> {isProcessing ? 'Processing...' : 'Import ZIP'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {isHR && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
                <Info className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                <div>
                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">File Naming Convention</h4>
                    <p className="text-xs text-blue-700 dark:text-blue-200 leading-relaxed mb-2">
                        Format: IST Salary Slip Month Of [Mmm-YYYY]_[FirstName] [LastName].pdf
                    </p>
                </div>
            </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">All Payslips</h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button 
                        onClick={() => setShowValues(!showValues)}
                        className={`p-2 rounded-lg transition-colors flex-shrink-0 border ${showValues ? 'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-900/30 dark:border-teal-800' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-600 hover:text-teal-600'}`}
                        title={showValues ? "Hide Amounts" : "Show Amounts"}
                    >
                        {showValues ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search payslips..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-transparent dark:text-slate-200"
                        />
                    </div>
                </div>
            </div>
            
            <div className="p-6">
                <div className="space-y-3">
                    {paginatedPayslips.map(slip => {
                        // Strict Visibility Check with Helper
                        const isOwn = isOwner(slip.userId, currentUser?.id);
                        
                        return (
                        <div key={slip.id} className="flex flex-col sm:flex-row items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-sm transition-all gap-4 bg-slate-50/30 dark:bg-slate-800/50">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-100">{slip.month}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Generated on {new Date(slip.generatedDate).toLocaleDateString()}</p>
                                    {isHR && <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">{slip.userName}</p>}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-right mr-2 group relative">
                                    <span className="block font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2 justify-end">
                                        {/* Logic: Show value ONLY if (GlobalToggle is ON) AND (User Owns this slip) */}
                                        {showValues && isOwn ? (
                                            <>
                                                {slip.currency || '₹'}{slip.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </>
                                        ) : (
                                            <span className="text-slate-400 dark:text-slate-500 tracking-widest text-sm flex items-center gap-1.5">
                                                {/* Show Lock icon if toggle is ON but user is NOT owner (e.g. HR viewing others) */}
                                                {showValues && !isOwn ? <Lock size={12} className="text-slate-400" /> : null}
                                                ••••••
                                            </span>
                                        )}
                                        
                                        {isHR && showValues && isOwn && (
                                            <button 
                                                onClick={() => openEditAmount(slip)} 
                                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                                                title="Correct Amount"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        )}
                                    </span>
                                    <span className="inline-block text-[10px] uppercase tracking-wide font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                                        {slip.status}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleView(slip)}
                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition"
                                        title="View PDF"
                                    >
                                        <FileSearch size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDownload(slip)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm"
                                    >
                                        <Download size={18} />
                                        <span className="hidden sm:inline">Download</span>
                                    </button>
                                    {isHR && (
                                        <button 
                                            onClick={() => handleDeleteClick(slip)}
                                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:bg-red-900/20 rounded-lg border border-slate-200 dark:border-slate-600 transition"
                                            title="Delete Payslip"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )})}
                    {paginatedPayslips.length === 0 && (
                        <div className="text-center py-10 text-slate-500 dark:text-slate-400">No payslips found.</div>
                    )}
                </div>

                {visiblePayslips.length > 0 && (
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                         <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                             <span>Show</span>
                             <select 
                               value={itemsPerPage}
                               onChange={(e) => setItemsPerPage(Number(e.target.value))}
                               className="border border-slate-300 dark:border-slate-600 rounded p-1 outline-none bg-white dark:bg-slate-800"
                             >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                             </select>
                             <span>items</span>
                         </div>
                         <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2">
                                 Page {currentPage} of {totalPages || 1}
                              </span>
                              <button 
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                              >
                                <ChevronRight size={16} />
                              </button>
                         </div>
                    </div>
                )}
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">My Earnings Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Payslips</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{summaryStats.totalCount}</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">This Year ({currentYear})</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                        {showValues ? `${summaryStats.displayCurrency}${summaryStats.thisYearAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '••••••'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{summaryStats.thisYearCount} payslips</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Earnings</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        {showValues ? `${summaryStats.displayCurrency}${summaryStats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '••••••'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">All time</p>
                </div>
            </div>
        </div>

        {/* Edit Amount Modal */}
        <DraggableModal isOpen={!!editingSlip} onClose={() => setEditingSlip(null)} title="Correct Payslip Amount" width="max-w-sm">
            <form onSubmit={saveEditedAmount} className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800 flex gap-2">
                    <Info className="text-amber-600 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-amber-700 dark:text-amber-400">Manual override. Updating this value does not change the PDF file itself, only the system record.</p>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Net Payable Amount</label>
                    <input 
                        type="number" 
                        step="0.01"
                        required
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-teal-500"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setEditingSlip(null)} className="px-4 py-2 text-sm text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-teal-600 text-white text-sm font-bold rounded-lg hover:bg-teal-700 flex items-center gap-2">
                        <Save size={16} /> Save
                    </button>
                </div>
            </form>
        </DraggableModal>

        {/* Delete Confirmation Modal */}
        <DraggableModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Delete" width="max-w-sm">
            <div className="text-center py-4">
                <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Are you sure?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    This will permanently delete the payslip for <strong>{payslipToDelete?.userName}</strong> ({payslipToDelete?.month}). This action cannot be undone.
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowDeleteConfirm(false)} 
                        className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold rounded-xl text-xs uppercase"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmDelete} 
                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl text-xs uppercase shadow-lg shadow-red-500/20 hover:bg-red-700"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </DraggableModal>
    </div>
  );
};
export default Payslips;