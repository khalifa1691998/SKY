// ================= PAGINATION SYSTEM FOR SKY ERP =================
// نظام تقسيم البيانات إلى صفحات لتحسين الأداء والسرعة
// يستخدم في القوائم الكبيرة (العملاء، المنتجات، الفواتير، إلخ)

class PaginationManager {
  constructor(itemsPerPage = 50) {
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
    this.totalItems = 0;
    this.totalPages = 0;
  }

  // حساب عدد الصفحات
  calculatePages(totalItems) {
    this.totalItems = totalItems;
    this.totalPages = Math.ceil(totalItems / this.itemsPerPage);
    return this.totalPages;
  }

  // الحصول على البيانات الخاصة بالصفحة الحالية
  getPageData(allItems) {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return allItems.slice(start, end);
  }

  // الذهاب إلى صفحة معينة
  goToPage(pageNumber) {
    if (pageNumber >= 1 && pageNumber <= this.totalPages) {
      this.currentPage = pageNumber;
      return true;
    }
    return false;
  }

  // الذهاب للصفحة التالية
  nextPage() {
    return this.goToPage(this.currentPage + 1);
  }

  // الذهاب للصفحة السابقة
  previousPage() {
    return this.goToPage(this.currentPage - 1);
  }

  // إعادة تعيين إلى الصفحة الأولى
  reset() {
    this.currentPage = 1;
  }

  // الحصول على معلومات الصفحة الحالية
  getPageInfo() {
    return {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      totalItems: this.totalItems,
      itemsPerPage: this.itemsPerPage,
      startItem: (this.currentPage - 1) * this.itemsPerPage + 1,
      endItem: Math.min(this.currentPage * this.itemsPerPage, this.totalItems)
    };
  }
}

// إنشاء مديري Pagination للجداول المختلفة
const clientsPagination = new PaginationManager(50); // 50 عميل في الصفحة
const inventoryPagination = new PaginationManager(50); // 50 منتج في الصفحة
const productsPagination = new PaginationManager(50); // 50 منتج في الصفحة
const invoicesPagination = new PaginationManager(50); // 50 فاتورة في الصفحة

// ================= دالة عرض أزرار التنقل بين الصفحات =================
function renderPaginationControls(containerId, paginationManager, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const info = paginationManager.getPageInfo();
  
  let html = `
    <div class="flex items-center justify-between mt-4 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
      <div class="text-sm text-slate-600">
        عرض <strong>${info.startItem}</strong> إلى <strong>${info.endItem}</strong> من <strong>${info.totalItems}</strong>
      </div>
      <div class="flex gap-2">
  `;

  // زر الصفحة الأولى
  if (info.currentPage > 1) {
    html += `<button onclick="goToFirstPage('${containerId}', ${onPageChange})" class="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-sm">الأولى</button>`;
  }

  // زر الصفحة السابقة
  if (info.currentPage > 1) {
    html += `<button onclick="goToPreviousPage('${containerId}', ${onPageChange})" class="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-sm">السابقة</button>`;
  }

  // أرقام الصفحات
  const startPage = Math.max(1, info.currentPage - 2);
  const endPage = Math.min(info.totalPages, info.currentPage + 2);

  if (startPage > 1) {
    html += `<span class="px-2 py-1 text-slate-500">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    if (i === info.currentPage) {
      html += `<button class="px-3 py-1 bg-teal-600 text-white rounded text-sm font-bold">${i}</button>`;
    } else {
      html += `<button onclick="goToPage('${containerId}', ${i}, ${onPageChange})" class="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-sm">${i}</button>`;
    }
  }

  if (endPage < info.totalPages) {
    html += `<span class="px-2 py-1 text-slate-500">...</span>`;
  }

  // زر الصفحة التالية
  if (info.currentPage < info.totalPages) {
    html += `<button onclick="goToNextPage('${containerId}', ${onPageChange})" class="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-sm">التالية</button>`;
  }

  // زر الصفحة الأخيرة
  if (info.currentPage < info.totalPages) {
    html += `<button onclick="goToLastPage('${containerId}', ${info.totalPages}, ${onPageChange})" class="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100 text-sm">الأخيرة</button>`;
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ================= دوال التنقل بين الصفحات =================
function goToPage(containerId, pageNumber, callback) {
  // تحديد مدير Pagination المناسب
  let paginationManager;
  if (containerId.includes('clients')) {
    paginationManager = clientsPagination;
  } else if (containerId.includes('inventory')) {
    paginationManager = inventoryPagination;
  } else if (containerId.includes('products')) {
    paginationManager = productsPagination;
  } else if (containerId.includes('invoices')) {
    paginationManager = invoicesPagination;
  }

  if (paginationManager && paginationManager.goToPage(pageNumber)) {
    if (callback) callback();
    renderPaginationControls(containerId, paginationManager, callback);
  }
}

function goToNextPage(containerId, callback) {
  let paginationManager;
  if (containerId.includes('clients')) {
    paginationManager = clientsPagination;
  } else if (containerId.includes('inventory')) {
    paginationManager = inventoryPagination;
  } else if (containerId.includes('products')) {
    paginationManager = productsPagination;
  } else if (containerId.includes('invoices')) {
    paginationManager = invoicesPagination;
  }

  if (paginationManager && paginationManager.nextPage()) {
    if (callback) callback();
    renderPaginationControls(containerId, paginationManager, callback);
  }
}

function goToPreviousPage(containerId, callback) {
  let paginationManager;
  if (containerId.includes('clients')) {
    paginationManager = clientsPagination;
  } else if (containerId.includes('inventory')) {
    paginationManager = inventoryPagination;
  } else if (containerId.includes('products')) {
    paginationManager = productsPagination;
  } else if (containerId.includes('invoices')) {
    paginationManager = invoicesPagination;
  }

  if (paginationManager && paginationManager.previousPage()) {
    if (callback) callback();
    renderPaginationControls(containerId, paginationManager, callback);
  }
}

function goToFirstPage(containerId, callback) {
  let paginationManager;
  if (containerId.includes('clients')) {
    paginationManager = clientsPagination;
  } else if (containerId.includes('inventory')) {
    paginationManager = inventoryPagination;
  } else if (containerId.includes('products')) {
    paginationManager = productsPagination;
  } else if (containerId.includes('invoices')) {
    paginationManager = invoicesPagination;
  }

  if (paginationManager) {
    paginationManager.reset();
    if (callback) callback();
    renderPaginationControls(containerId, paginationManager, callback);
  }
}

function goToLastPage(containerId, lastPage, callback) {
  let paginationManager;
  if (containerId.includes('clients')) {
    paginationManager = clientsPagination;
  } else if (containerId.includes('inventory')) {
    paginationManager = inventoryPagination;
  } else if (containerId.includes('products')) {
    paginationManager = productsPagination;
  } else if (containerId.includes('invoices')) {
    paginationManager = invoicesPagination;
  }

  if (paginationManager && paginationManager.goToPage(lastPage)) {
    if (callback) callback();
    renderPaginationControls(containerId, paginationManager, callback);
  }
}

// ================= Lazy Loading للصور =================
// تفعيل Lazy Loading تلقائياً لجميع الصور
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  });

  // مراقبة جميع الصور بـ loading="lazy"
  document.querySelectorAll('img[loading="lazy"]').forEach(img => {
    imageObserver.observe(img);
  });
}

console.log('✅ نظام Pagination و Lazy Loading جاهز!');
