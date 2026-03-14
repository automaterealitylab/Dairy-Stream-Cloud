import React, { useState, useRef } from 'react';
import { X, Download, Share2, CreditCard, CheckCircle2, Info } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';

const InvoicePreviewModal = ({ customer, adminName, dairyName, onClose }) => {
  const invoiceRef = useRef();
  
  const [billConfig, setBillConfig] = useState({
    billNo: `DS-${Date.now().toString().slice(-6)}`,
    date: new Date().toLocaleDateString('en-GB'),
    discount: 0,
    notes: "Thanks for choosing us!", 
    contact: "+91 98765 43210",
    email: "billing@dairystream.com",
    address: "Plot 42, Industrial Area, Milk City",
    upiId: "ayanm102435@okaxis"
  });

  const subtotal = customer.outstanding_balance || 0;
  const totalDue = subtotal - billConfig.discount;

  // ✅ THE MASTER FIX: Clone-based capture to prevent overlaps and keep size small
  const generateStyledPDF = async () => {
    const element = invoiceRef.current;
    
    // 1. Create a hidden clone container to render at 100% scale
    const cloneContainer = document.createElement("div");
    cloneContainer.style.position = "absolute";
    cloneContainer.style.left = "-9999px";
    cloneContainer.style.top = "0";
    document.body.appendChild(cloneContainer);

    // 2. Clone the invoice and strip scaling
    const clone = element.cloneNode(true);
    clone.style.transform = "none";
    clone.style.scale = "1";
    clone.style.margin = "0";
    cloneContainer.appendChild(clone);

    try {
      // 3. Capture the clone at 2x scale for sharpness
      const canvas = await html2canvas(clone, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794, // Standard A4 Width
        height: 1123 // Standard A4 Height
      });

      // 4. Compress to JPEG (0.7 quality) to hit the KB range
      const imgData = canvas.toDataURL('image/jpeg', 0.7); 
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      
      // Cleanup
      document.body.removeChild(cloneContainer);
      return pdf;
    } catch (error) {
      document.body.removeChild(cloneContainer);
      console.error("PDF generation failed", error);
    }
  };

  const handleDownloadPDF = async () => {
    const pdf = await generateStyledPDF();
    const fileName = `${customer.customer_name.replace(/\s+/g, '_')}_Invoice_${billConfig.billNo}.pdf`;
    pdf.save(fileName);
  };

  const handleShare = async () => {
    try {
      const pdf = await generateStyledPDF();
      const pdfBlob = pdf.output('blob');
      const fileName = `${customer.customer_name.replace(/\s+/g, '_')}_Bill.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Milk Invoice' });
      } else {
        // Fallback for Desktop
        window.open(`https://wa.me/${customer.phone_number}?text=Hi, your bill for this month is ₹${totalDue}`);
      }
    } catch (err) { console.error("Sharing failed", err); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[95vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col">
        
        {/* ACTION HEADER */}
        <div className="px-8 py-4 border-b flex justify-between items-center bg-white z-10">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Invoice Terminal</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Digital Signature Verified</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={handleShare} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl font-black text-sm transition-all border border-emerald-100">
              <Share2 size={18} /> Share PDF
            </button>
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm shadow-xl shadow-blue-200 transition-all">
              <Download size={18} /> Save PDF
            </button>
            <button onClick={onClose} className="ml-4 p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-colors">
              <X size={28} />
            </button>
          </div>
        </div>

        {/* INVOICE PREVIEW AREA */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-10 flex justify-center items-start">
          
          <div className="origin-top transition-transform duration-300 transform scale-[0.6] lg:scale-[0.8] xl:scale-[0.95] shadow-2xl">
            
            <div ref={invoiceRef} className="bg-white w-[210mm] min-h-[297mm] p-20 relative text-slate-900 overflow-hidden border border-gray-100 flex flex-col">
              
              {/* HEADER SECTION */}
              <div className="flex justify-between items-start mb-16">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="h-10 w-10 bg-blue-600 rounded-xl" />
                     <h1 className="text-4xl font-black tracking-tighter text-blue-600">{dairyName || "DAIRY STREAM"}</h1>
                  </div>
                  <div className="space-y-1 text-xs font-bold text-slate-400">
                     <div contentEditable suppressContentEditableWarning className="outline-none focus:text-blue-600" onBlur={e => setBillConfig({...billConfig, address: e.target.innerText})}>{billConfig.address}</div>
                     <div contentEditable suppressContentEditableWarning className="outline-none focus:text-blue-600" onBlur={e => setBillConfig({...billConfig, contact: e.target.innerText})}>{billConfig.contact}</div>
                  </div>
                  <div className="h-1 w-64 bg-blue-600 mt-6 rounded-full" />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Invoice Reference</p>
                  <p className="text-2xl font-black tracking-tighter">#{billConfig.billNo}</p>
                  <p className="text-[10px] font-black text-slate-300 uppercase mt-4 tracking-widest">Date: {billConfig.date}</p>
                </div>
              </div>

              {/* PARTIES */}
              <div className="grid grid-cols-2 gap-20 py-12 mb-10 border-y border-slate-50">
                <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase mb-3 tracking-widest italic">Bill To</p>
                  <h3 className="text-2xl font-black text-slate-800">{customer.customer_name}</h3>
                  <p className="text-sm font-bold text-slate-400 mt-1">{customer.phone_number}</p>
                </div>
                <div className="text-right flex flex-col justify-end">
                  <h3 className="text-xl font-black text-slate-800">{adminName}</h3>
                  <div className="flex items-center justify-end gap-1 text-emerald-500 text-[10px] font-black uppercase tracking-tighter mt-1">
                    <CheckCircle2 size={12} /> Digital Signature Verified
                  </div>
                </div>
              </div>

              {/* TABLE */}
              <div className="flex-1">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-left border-b border-gray-100">
                      <th className="p-4 text-xs font-black uppercase text-gray-400 tracking-widest w-2/3">Description</th>
                      <th className="p-4 text-right text-xs font-black uppercase text-gray-400 tracking-widest w-1/3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-bold">
                    <tr>
                      <td className="p-6 text-slate-700 text-lg border-b border-gray-50 whitespace-nowrap">Monthly Outstanding Balance</td>
                      <td className="p-6 text-right text-slate-900 text-lg border-b border-gray-50">₹{subtotal.toLocaleString()}</td>
                    </tr>
                    <tr className="text-emerald-600">
                      <td className="p-4 border-b border-gray-50 italic">Adjustment / Applied Discount</td>
                      <td className="p-4 text-right border-b border-gray-50">
                        -₹<span contentEditable suppressContentEditableWarning className="outline-none border-b border-dashed border-emerald-300" onBlur={e => setBillConfig({...billConfig, discount: Number(e.target.innerText) || 0})}>{billConfig.discount}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TOTAL SECTION */}
              <div className="flex flex-col items-end gap-3 mt-10">
                <div className="w-64 flex justify-between text-gray-400 font-bold">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="w-64 flex justify-between text-3xl font-black text-slate-900 pt-3 border-t-2 border-slate-100">
                  <span>Net Due</span>
                  <span className="text-red-600">₹{totalDue.toLocaleString()}</span>
                </div>
              </div>

              {/* FOOTER: QR & SIGNATURE */}
              <div className="mt-20 flex justify-between items-end">
                <div className="p-6 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200 text-center">
                  <div className="mb-3 mx-auto flex items-center justify-center">
                    <QRCodeSVG 
                      value={`upi://pay?pa=${billConfig.upiId}&pn=${encodeURIComponent(dairyName)}&am=${totalDue}&cu=INR`} 
                      size={90} level="H"
                    />
                  </div>
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">Scan to Pay Online</p>
                </div>
                
                <div className="text-center w-64">
                   <div className="mb-2">
                      <p className="font-serif italic text-3xl text-blue-700 opacity-80" 
                         style={{ fontFamily: 'Georgia, serif', letterSpacing: '-1px' }}>
                        {adminName}
                      </p>
                      <div className="h-[1px] w-full bg-slate-200 mt-2" />
                   </div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Authorized Head</p>
                </div>
              </div>

              {/* NOTES */}
              <div className="mt-16 pt-8 border-t border-gray-50">
                 <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2">
                   <Info size={12} /> Notes
                 </div>
                 <div contentEditable suppressContentEditableWarning className="w-full text-xs font-bold text-slate-500 outline-none min-h-[40px]" onBlur={e => setBillConfig({...billConfig, notes: e.target.innerText})}>{billConfig.notes}</div>
              </div>

              <div className="absolute bottom-8 left-0 right-0 text-center">
                 <p className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em]">Generated via DairyStream Systems © 2026</p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;