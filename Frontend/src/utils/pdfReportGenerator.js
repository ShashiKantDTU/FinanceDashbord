/**
 * PDF Report Generator for Employee Payment Reports
 * 
 * This utility generates downloadable PDF reports for employee payment data
 * using jsPDF and jspdf-autotable libraries.
 * 
 * Usage:
 * import { generateEmployeeReportPDF } from "../utils/pdfReportGenerator";
 * generateEmployeeReportPDF(transformedEmployees);
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Generates a PDF report for employee payment data
 * @param {Array} transformedEmployees - Array of transformed employee objects
 */
export const generateEmployeeReportPDF = (transformedEmployees) => {
    if (!transformedEmployees || transformedEmployees.length === 0) {
        console.warn('No employee data provided for PDF generation');
        return;
    }    try {
        // Create new PDF document (A4, portrait)
        const doc = new jsPDF('portrait', 'mm', 'a4');
        
        // Document settings
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        
        let isFirstEmployee = true;

        transformedEmployees.forEach((employee, index) => {
            // Start new page for each employee (except the first one)
            if (!isFirstEmployee) {
                doc.addPage();
            }
            isFirstEmployee = false;

            let currentY = margin;            // Add header
            currentY = addHeader(doc, employee, currentY, pageWidth);

            // Add summary table
            currentY = addSummaryTable(doc, employee, currentY, margin);

            // Add advances table if advances exist
            if (employee.advances && employee.advances.length > 0) {
                currentY = addAdvancesTable(doc, employee, currentY, margin);
            }            // Add additional payments table if they exist
            if (employee.additionalPayments && employee.additionalPayments.length > 0) {
                addAdditionalPaymentsTable(doc, employee, currentY, margin);
            }

            // Add page number at bottom
            addPageNumber(doc, index + 1, pageHeight, pageWidth);
        });

        // Generate filename
        const firstEmployee = transformedEmployees[0];
        const filename = `Employee_Payment_Report_${firstEmployee.month}_${firstEmployee.year}_${firstEmployee.siteID}.pdf`;

        // Download the PDF
        doc.save(filename);

        console.log(`PDF report generated successfully: ${filename}`);

    } catch (error) {
        console.error('Error generating PDF report:', error);
        throw error;
    }
};

/**
 * Adds header section to the PDF
 */
const addHeader = (doc, employee, startY, pageWidth) => {
    const centerX = pageWidth / 2;
    const margin = 15;
    let currentY = startY;

    // Add a subtle header background
    doc.setFillColor(245, 248, 250);
    doc.rect(margin, startY, pageWidth - (2 * margin), 35, 'F');

    // Main title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(44, 62, 80);
    doc.text('Employee Payment Report', centerX, currentY + 8, { align: 'center' });
    currentY += 12;

    // Report period and site info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(127, 140, 141);
    doc.text(`Report Period: ${getMonthName(employee.month)} ${employee.year} | Site ID: ${employee.siteID}`, centerX, currentY + 5, { align: 'center' });
    currentY += 10;

    // Employee info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(52, 73, 94);
    doc.text(`Employee: ${employee.name} (ID: ${employee.id})`, centerX, currentY + 8, { align: 'center' });
    currentY += 20;

    // Reset text color for subsequent content
    doc.setTextColor(0, 0, 0);

    return currentY;
};

/**
 * Adds summary table with key payment information
 */
const addSummaryTable = (doc, employee, startY, margin) => {    const summaryData = [
        ['Daily Rate', formatCurrency(employee.dailyRate)],
        ['Attendance (Days)', employee.attendance.toString()],
        ['Gross Payment', formatCurrency(employee.grossPayment)],
        ['Advances', formatCurrency(employee.totalAdvances)],
        ['Bonus', formatCurrency(employee.totalAdditionalPayments)],
        ['Previous Balance', formatCurrency(employee.previousBalance)],
        ['Net Balance', formatCurrency(employee.netBalance)]
    ];

    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = pageWidth - (2 * margin);
    
    doc.autoTable({
        startY: startY,
        head: [['Description', 'Amount']],
        body: summaryData,
        margin: { left: margin, right: margin },
        theme: 'grid',
        tableWidth: tableWidth,        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 11
        },bodyStyles: {
            fontSize: 10,
            cellPadding: 4
        },        columnStyles: {
            0: { 
                cellWidth: tableWidth * 0.65, 
                fontStyle: 'bold',
                halign: 'left'
            },
            1: { 
                cellWidth: tableWidth * 0.35, 
                halign: 'right',
                fontStyle: 'normal'
            }
        },
        didParseCell: function (data) {
            // Align amount column header to the right
            if (data.section === 'head' && data.column.index === 1) {
                data.cell.styles.halign = 'right';
            }
            // Keep description header centered
            if (data.section === 'head' && data.column.index === 0) {
                data.cell.styles.halign = 'center';
            }
        },
        alternateRowStyles: {
            fillColor: [248, 249, 250]
        }
    });

    return doc.lastAutoTable.finalY + 15;
};

/**
 * Adds advances table if advances exist
 */
const addAdvancesTable = (doc, employee, startY, margin) => {
    if (!employee.advances || employee.advances.length === 0) {
        return startY;
    }    // Section title with background
    doc.setFillColor(252, 248, 248);
    doc.rect(margin, startY - 2, doc.internal.pageSize.getWidth() - (2 * margin), 12, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(231, 76, 60);
    doc.text('Advances', margin + 3, startY + 6);
    doc.setTextColor(0, 0, 0);
    
    const advancesData = employee.advances.map(advance => [
        formatDate(advance.date),
        formatCurrency(advance.value),
        advance.remark || 'N/A'
    ]);

    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = pageWidth - (2 * margin);    doc.autoTable({
        startY: startY + 10,
        head: [['Date', 'Amount', 'Remark']],
        body: advancesData,
        margin: { left: margin, right: margin },
        theme: 'striped',
        tableWidth: tableWidth,        headStyles: {
            fillColor: [231, 76, 60],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
        },        bodyStyles: {
            fontSize: 9,
            cellPadding: 2
        },
        columnStyles: {
            0: { 
                cellWidth: tableWidth * 0.20,
                halign: 'center'
            },
            1: { 
                cellWidth: tableWidth * 0.35, 
                halign: 'right'
            },
            2: { 
                cellWidth: tableWidth * 0.45,
                halign: 'left'
            }
        },
        didParseCell: function (data) {
            // Align amount column header to the right
            if (data.section === 'head' && data.column.index === 1) {
                data.cell.styles.halign = 'right';
            }
            // Keep other headers centered
            if (data.section === 'head' && data.column.index !== 1) {
                data.cell.styles.halign = 'center';
            }
        },
        alternateRowStyles: {
            fillColor: [252, 248, 248]
        }
    });

    return doc.lastAutoTable.finalY + 10;
};

/**
 * Adds bonuses table if they exist
 */
const addAdditionalPaymentsTable = (doc, employee, startY, margin) => {
    if (!employee.additionalPayments || employee.additionalPayments.length === 0) {
        return startY;
    }    // Section title with background
    doc.setFillColor(248, 252, 249);
    doc.rect(margin, startY - 2, doc.internal.pageSize.getWidth() - (2 * margin), 12, 'F');
      doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 204, 113);
    doc.text('Bonuses', margin + 3, startY + 6);
    doc.setTextColor(0, 0, 0);
    
    const paymentsData = employee.additionalPayments.map(payment => [
        formatDate(payment.date),
        formatCurrency(payment.value),
        payment.remark || 'N/A'
    ]);

    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = pageWidth - (2 * margin);    doc.autoTable({
        startY: startY + 10,
        head: [['Date', 'Amount', 'Remark']],
        body: paymentsData,
        margin: { left: margin, right: margin },
        theme: 'striped',
        tableWidth: tableWidth,
        headStyles: {
            fillColor: [46, 204, 113],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
        },        bodyStyles: {
            fontSize: 9,
            cellPadding: 2
        },        columnStyles: {
            0: { 
                cellWidth: tableWidth * 0.20,
                halign: 'center'
            },
            1: { 
                cellWidth: tableWidth * 0.35, 
                halign: 'right'
            },
            2: { 
                cellWidth: tableWidth * 0.45,
                halign: 'left'
            }
        },
        didParseCell: function (data) {
            // Align amount column header to the right
            if (data.section === 'head' && data.column.index === 1) {
                data.cell.styles.halign = 'right';
            }
            // Keep other headers centered
            if (data.section === 'head' && data.column.index !== 1) {
                data.cell.styles.halign = 'center';
            }
        },
        alternateRowStyles: {
            fillColor: [248, 252, 249]
        }
    });

    return doc.lastAutoTable.finalY + 10;
};

/**
 * Adds page number and timestamp at the bottom of the page
 */
const addPageNumber = (doc, pageNumber, pageHeight, pageWidth) => {
    const margin = 15;
    const footerY = pageHeight - 10;
    
    // Add a subtle line above footer
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    // Page number (right side)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${pageNumber}`, pageWidth - margin, footerY, { align: 'right' });
    
    // Generation timestamp (left side)
    const timestamp = new Date().toLocaleString('en-IN');
    doc.text(`Generated: ${timestamp}`, margin, footerY, { align: 'left' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
};

/**
 * Formats currency values with proper alignment
 */
const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return 'Rs. 0.00';
    }
    
    const num = parseFloat(amount);
    if (isNaN(num)) {
        return 'Rs. 0.00';
    }
    
    // Format with proper decimal places without using toLocaleString to avoid spacing issues
    const formatted = num.toFixed(2);
    
    return `Rs. ${formatted}`;
};

/**
 * Formats date for display
 */
const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return 'Invalid Date';
          return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return 'Invalid Date';
    }
};

/**
 * Converts month number to month name
 */
const getMonthName = (monthNumber) => {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const monthIndex = parseInt(monthNumber) - 1;
    return months[monthIndex] || 'Unknown';
};
