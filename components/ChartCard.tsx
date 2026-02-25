
import React, { useState, useRef } from 'react';
import { Maximize2, Download, FileImage, FileSpreadsheet, ChevronDown } from 'lucide-react';
import DraggableModal from './DraggableModal';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface ChartCardProps {
  title: string;
  subtext?: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
  height?: string;
  data?: any[]; // Data for CSV export
}

const ChartCard: React.FC<ChartCardProps> = ({ title, subtext, children, className = "", id, height = "h-64", data }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const downloadPNG = async () => {
    if (!chartRef.current) return;
    setShowExportMenu(false);
    
    // Create a unique ID if not provided to help with cloning
    const elementId = id || `chart-${Math.random().toString(36).substr(2, 9)}`;
    const originalId = chartRef.current.id;
    chartRef.current.id = elementId;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
        scale: 3, // High resolution
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById(elementId);
          if (clonedElement) {
            // Hide action buttons in the exported image
            const actions = clonedElement.querySelector('.chart-actions');
            if (actions) (actions as HTMLElement).style.display = 'none';
            
            // Ensure dark mode styles are applied if active
            if (document.documentElement.classList.contains('dark')) {
              clonedElement.classList.add('dark');
              clonedDoc.documentElement.classList.add('dark');
            }
          }
        }
      });
      
      const link = document.createElement('a');
      link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      console.error('Failed to export PNG', err);
    } finally {
      chartRef.current.id = originalId;
    }
  };

  const downloadCSV = () => {
    if (!data || data.length === 0) return;
    setShowExportMenu(false);

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, `${title.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
  };

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div id={id} ref={chartRef} className={`bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 relative group ${className}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h3>
            {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
          </div>
          <div className="flex items-center gap-1 chart-actions">
            <div className="relative" ref={exportMenuRef}>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
                title="Export Options"
              >
                <Download size={16} />
                <ChevronDown size={12} />
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden py-1">
                  <button 
                    onClick={downloadPNG}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <FileImage size={14} /> PNG Image
                  </button>
                  {data && (
                    <button 
                      onClick={downloadCSV}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                    >
                      <FileSpreadsheet size={14} /> Excel/CSV
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setIsExpanded(true)}
              className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              title="Expand Chart"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
        <div className={height}>
          {children}
        </div>
      </div>

      <DraggableModal 
        isOpen={isExpanded} 
        onClose={() => setIsExpanded(false)} 
        title={title}
        width="max-w-6xl"
      >
        <div className="h-[600px] w-full p-2">
          {children}
        </div>
      </DraggableModal>
    </>
  );
};

export default ChartCard;
