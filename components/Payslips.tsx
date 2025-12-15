
import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Download, CheckCircle2, UploadCloud, Info, FileText, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { UserRole, Payslip } from '../types';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Handle ES Module import structure where GlobalWorkerOptions might be on 'default'
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Configure PDF.js worker
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const Payslips = () => {
  const { payslips, currentUser, employees, showToast, manualAddPayslip } = useAppContext();
  const [month, setMonth] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // View State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const isHR = currentUser?.role === UserRole.HR;
  const currentYear = new Date().getFullYear();

  // Helper to extract text from PDF ArrayBuffer
  const extractNetPay = async (arrayBuffer: ArrayBuffer): Promise<{ amount: number, currency: string } | null> => {
    try {
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];
        fullText = items.map(item => item.str).join(' ');

        // Regex looks for "Net Pay" followed by optional currency symbol/code and then the amount
        // Example matches: "Net Pay: $1,234.00", "Net Pay ₹ 50000", "Total Pay: Rs. 45000"
        const regex = /(?:Net\s*Pay(?:able)?|Total\s*Pay)[^0-9]*?([$₹€£]|Rs\.?|INR|USD|EUR|GBP)?\s*?([\d,]+\.?\d{0,2})/i;
        const match = fullText.match(regex);
        
        if (match && match[2]) {
            let currency = match[1] || '₹'; 
            
            // Normalize common text codes to symbols
            if (match[1]) {
                const c = match[1].toUpperCase().replace('.', '');
                if (c === 'RS' || c === 'INR') currency = '₹';
                else if (c === 'USD') currency = '$';
                else if (c === 'EUR') currency = '€';
                else if (c === 'GBP') currency = '£';
            }

            const amountStr = match[2].replace(/,/g, '');
            return { amount: parseFloat(amountStr), currency: currency };
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

          const filePromises: Promise<void>[] = [];
          
          contents.forEach((relativePath, zipEntry) => {
              if (!zipEntry.dir && (zipEntry.name.endsWith('.pdf') || zipEntry.name.endsWith('.PDF'))) {
                  filePromises.push((async () => {
                      const normalizedName = zipEntry.name.toLowerCase();
                      
                      const matchedEmployee = employees.find(emp => {
                          const fname = emp.firstName.toLowerCase();
                          const lname = emp.lastName.toLowerCase();
                          return normalizedName.includes(fname) && normalizedName.includes(lname);
                      });

                      if (matchedEmployee) {
                          const exists = payslips.some(p => p.userId === matchedEmployee.id && p.month === month);
                          
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
          
          if (importedCount > 0) {
             let msg = `Successfully imported ${importedCount} payslips.`;
             if (parsedAmounts > 0) msg += ` Extracted Net Pay from ${parsedAmounts} files.`;
             showToast(msg, "success");
          } else if (skippedCount > 0) {
             showToast(`No new payslips. ${skippedCount} duplicates found.`, "info");
          } else {
             showToast("No matching employee payslips found in the ZIP.", "warning");
          }

      } catch (err: any) {
          console.error(err);
          const msg = err.name === 'QuotaExceededError' 
            ? "Storage quota exceeded. Some files could not be saved." 
            : "Failed to process ZIP file.";
          showToast(msg, "error");
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

  // Filter and Pagination Logic
  const visiblePayslips = useMemo(() => {
    let filtered = isHR ? payslips : payslips.filter(p => p.userId === currentUser?.id);
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.month.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (isHR && p.userName.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
    // Sort by date desc (assuming generatedDate matches chronological order roughly)
    return filtered.sort((a, b) => new Date(b.generatedDate).getTime() - new Date(a.generatedDate).getTime());
  }, [payslips, currentUser, isHR, searchTerm]);

  const totalPages = Math.ceil(visiblePayslips.length / itemsPerPage);
  const paginatedPayslips = visiblePayslips.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  // Summary Logic
  const summaryStats = useMemo(() => {
      // Calculate based on ALL visible slips for the user
      const userSlips = isHR ? payslips : payslips.filter(p => p.userId === currentUser?.id);
      
      const totalCount = userSlips.length;
      const totalAmount = userSlips.reduce((sum, p) => sum + p.amount, 0);
      
      // Determine year from month string e.g. "Sep 2024"
      const thisYearAmount = userSlips.reduce((sum, p) => {
          if (p.month.includes(currentYear.toString())) {
              return sum + p.amount;
          }
          return sum;
      }, 0);
      
      const thisYearCount = userSlips.filter(p => p.month.includes(currentYear.toString())).length;
      
      // Use the currency of the latest payslip for summary display, or default to ₹
      const displayCurrency = userSlips.length > 0 ? (userSlips[0].currency || '₹') : '₹';

      return { totalCount, totalAmount, thisYearAmount, thisYearCount, displayCurrency };
  }, [payslips, currentUser, isHR, currentYear]);

  return (
    <div className="space-y-6 animate-fade-in">
        {/* Header & HR Controls */}
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

        {/* All Payslips List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">All Payslips</h3>
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
            
            <div className="p-6">
                <div className="space-y-3">
                    {paginatedPayslips.map(slip => (
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
                                <div className="text-right mr-2">
                                    <span className="block font-bold text-slate-800 dark:text-slate-100 text-lg">
                                        {slip.currency || '₹'}{slip.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="inline-block text-[10px] uppercase tracking-wide font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                                        {slip.status}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleView(slip)}
                                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 transition"
                                        title="View"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDownload(slip)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm"
                                    >
                                        <Download size={18} />
                                        <span className="hidden sm:inline">Download</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {paginatedPayslips.length === 0 && (
                        <div className="text-center py-10 text-slate-500 dark:text-slate-400">No payslips found.</div>
                    )}
                </div>

                {/* Pagination */}
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

        {/* Earnings Summary Card - Only visible to non-admin (non-HR) users */}
        {!isHR && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">Earnings Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Payslips</p>
                        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{summaryStats.totalCount}</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">This Year ({currentYear})</p>
                        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                            {summaryStats.displayCurrency}{summaryStats.thisYearAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">{summaryStats.thisYearCount} payslips</p>
                    </div>
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Earnings</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            {summaryStats.displayCurrency}{summaryStats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">All time</p>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
export default Payslips;
