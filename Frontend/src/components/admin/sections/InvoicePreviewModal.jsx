import React, { useState, useRef } from 'react';
import { X, Download, Share2, CreditCard, CheckCircle2, Info } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

  // ✅ NATIVE PDF GENERATION (MATH BASED - ULTRA SMALL SIZE)
  const generateNativePDF = () => {
    const doc = new jsPDF();
    
    // Header Color Block
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Dairy Name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(dairyName || "DAIRY STREAM", 15, 25);
    
    // Invoice Meta
    doc.setFontSize(10);
    doc.text(`Invoice: #${billConfig.billNo}`, 150, 20);
    doc.text(`Date: ${billConfig.date}`, 150, 26);

    // Reset Text Color
    doc.setTextColor(40, 40, 40);
    
    // Billed To Section
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("BILLED TO:", 15, 55);
    doc.setFont("helvetica", "normal");
    doc.text(customer.customer_name, 15, 62);
    doc.text(customer.phone_number, 15, 68);

    // Verified By
    doc.setFont("helvetica", "bold");
    doc.text("VERIFIED BY:", 150, 55);
    doc.setFont("helvetica", "normal");
    doc.text(adminName, 150, 62);

    // Items Table
    autoTable(doc, {
      startY: 80,
      head: [['Description', 'Amount']],
      body: [
        ['Monthly Outstanding Balance', `INR ${subtotal.toLocaleString()}`],
        ['Adjustments / Discounts', `-INR ${billConfig.discount.toLocaleString()}`],
      ],
      foot: [['TOTAL PAYABLE', `INR ${totalDue.toLocaleString()}`]],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      footStyles: { fillColor: [15, 23, 42] }
    });

    const finalY = doc.lastAutoTable.finalY + 20;

    // E-Signature
    doc.setFont("courier", "italic");
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text(adminName, 150, finalY + 10);
    doc.setDrawColor(200, 200, 200);
    doc.line(145, finalY + 12, 195, finalY + 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("AUTHORIZED SIGNATORY", 153, finalY + 17);

    // Notes
    doc.setFont("helvetica", "bold");
    doc.text("NOTES:", 15, finalY + 10);
    doc.setFont("helvetica", "normal");
    doc.text(billConfig.notes, 15, finalY + 15);

    return doc;
  };

  const handleDownloadPDF = () => {
    const doc = generateNativePDF();
    doc.save(`${customer.customer_name}_Bill.pdf`);
  };

  const handleShare = async () => {
    try {
      const doc = generateNativePDF();
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], `Invoice_${billConfig.billNo}.pdf`, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Monthly Milk Invoice',
          text: `Invoice for ${customer.customer_name} - Total: ₹${totalDue}`,
        });
      } else {
        const waUrl = `https://wa.me/${customer.phone_number}?text=${encodeURIComponent(`Hi ${customer.customer_name}, your bill is ₹${totalDue}. UPI: ${billConfig.upiId}`)}`;
        window.open(waUrl, '_blank');
      }
    } catch (err) {
      console.error("Share failed", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[95vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col">
        
        {/* ACTION HEADER */}
        <div className="px-8 py-4 border-b flex justify-between items-center bg-white">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <CreditCard size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Invoice Terminal</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Drafting & Digital Signing</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={handleShare} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl font-black text-sm transition-all border border-emerald-100">
              <Share2 size={18} /> Share PDF
            </button>
            <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-sm shadow-xl shadow-blue-200 transition-all">
              <Download size={18} /> Download (KB)
            </button>
            <button onClick={onClose} className="ml-4 p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-colors">
              <X size={28} />
            </button>
          </div>
        </div>

        {/* PREVIEW CONTAINER */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-10 flex justify-center items-start">
          <div className="origin-top transform scale-[0.65] lg:scale-[0.80] xl:scale-[0.90] shadow-2xl rounded-sm">
            
            <div ref={invoiceRef} className="bg-white w-[210mm] min-h-[297mm] p-16 relative text-slate-900 border border-gray-100">
              
              {/* BRANDING */}
              <div className="flex justify-between items-start mb-12">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                     <div className="h-10 w-10 bg-blue-600 rounded-xl" />
                     <h1 className="text-4xl font-black tracking-tighter text-blue-600">{dairyName || "DAIRY STREAM"}</h1>
                  </div>
                  <div className="space-y-1 text-xs font-bold text-slate-400">
                     <input className="block w-full outline-none bg-transparent" value={billConfig.address} onChange={e => setBillConfig({...billConfig, address: e.target.value})} />
                     <input className="block w-full outline-none bg-transparent" value={billConfig.contact} onChange={e => setBillConfig({...billConfig, contact: e.target.value})} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Invoice Reference</p>
                  <p className="text-2xl font-black">#{billConfig.billNo}</p>
                  <p className="text-[10px] font-black text-slate-300 uppercase mt-2">Date: {billConfig.date}</p>
                </div>
              </div>

              {/* PARTIES */}
              <div className="grid grid-cols-2 gap-20 py-10 border-y border-slate-100 mb-10">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Billed To</p>
                  <h3 className="text-2xl font-black text-slate-800">{customer.customer_name}</h3>
                  <p className="text-sm font-bold text-slate-400 mt-1">{customer.phone_number}</p>
                </div>
                <div className="text-right flex flex-col justify-end">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">Digital Verification</p>
                  <h3 className="text-xl font-black text-slate-800">{adminName}</h3>
                  <div className="flex items-center justify-end gap-1 text-emerald-500 text-[10px] font-black uppercase">
                    <CheckCircle2 size={12} /> Signature Verified
                  </div>
                </div>
              </div>

              {/* CALCULATION */}
              <div className="mb-10">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="py-4 text-left text-xs font-black uppercase tracking-widest">Service Description</th>
                      <th className="py-4 text-right text-xs font-black uppercase tracking-widest">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-bold">
                    <tr className="border-b border-slate-50">
                      <td className="py-8 text-slate-700 text-lg">Consolidated Monthly Balance</td>
                      <td className="py-8 text-right text-slate-900 text-lg">₹{subtotal.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="py-4 text-emerald-600 italic">Adjustments / Applied Discounts</td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-1 font-black text-emerald-600">
                          <span>-₹</span>
                          <input type="number" className="w-20 bg-slate-50 p-1 rounded outline-none text-right" value={billConfig.discount} onChange={e => setBillConfig({...billConfig, discount: Number(e.target.value)})} />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TOTAL SECTION */}
              <div className="flex justify-between items-center bg-slate-900 text-white p-10 rounded-3xl shadow-xl mt-10">
                 <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Payable Amount</p>
                    <h2 className="text-4xl font-black">₹{totalDue.toLocaleString()}</h2>
                 </div>
                 <div className="text-right max-w-[200px]">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-2 justify-end">
                      <Info size={12} /> Quick Note
                    </div>
                    <textarea 
                      className="w-full text-right text-xs font-bold text-slate-300 bg-transparent border-none outline-none resize-none"
                      rows={1} value={billConfig.notes} onChange={e => setBillConfig({...billConfig, notes: e.target.value})}
                    />
                 </div>
              </div>

              {/* FOOTER: QR & ESIGN */}
              <div className="mt-16 flex justify-between items-end border-t border-slate-100 pt-10">
                <div className="flex items-center gap-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <QRCodeSVG 
                    value={`upi://pay?pa=${billConfig.upiId}&pn=${dairyName}&am=${totalDue}&cu=INR`} 
                    size={90} level="H"
                  />
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-tighter">Instant Payment</p>
                    <input className="text-sm font-black text-slate-900 bg-transparent outline-none border-b border-blue-200" value={billConfig.upiId} onChange={e => setBillConfig({...billConfig, upiId: e.target.value})} />
                    <p className="text-[9px] font-bold text-blue-500 mt-2 italic">Scan via any UPI App</p>
                  </div>
                </div>
                
                <div className="text-center pr-10">
                   <div className="mb-1">
                      {/* ✅ PROFESSIONAL E-SIGN FONT STYLE */}
                      <p className="font-serif italic text-3xl text-blue-700 opacity-80" 
                         style={{ fontFamily: 'Georgia, serif', letterSpacing: '-1px' }}>
                        {adminName}
                      </p>
                      <div className="h-[1px] w-48 bg-slate-200 mx-auto" />
                   </div>
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Authorized Head</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;