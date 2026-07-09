/**
 * دالة عرض تنبيهات الأقساط المستحقة اليوم
 * أضفها إلى app.js بعد دالة renderExpenses
 */

function renderTodayReminders() {
  const stats = getTodayDueStats();
  
  // Render summary cards
  const summaryContainer = document.getElementById('today-due-summary');
  if (!summaryContainer) return;
  
  summaryContainer.innerHTML = `
    <div class="bg-amber-900 text-white rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-20 sm:h-32">
      <p class="text-[10px] sm:text-xs text-amber-200 font-semibold truncate">الأقساط المستحقة اليوم</p>
      <h4 class="text-base sm:text-3xl font-extrabold mt-1.5 sm:mt-3 text-amber-300 truncate">${stats.totalCount}</h4>
    </div>
    <div class="bg-slate-900 text-white rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-20 sm:h-32">
      <p class="text-[10px] sm:text-xs text-slate-400 font-semibold truncate">الإجمالي المطلوب</p>
      <h4 class="text-base sm:text-3xl font-extrabold mt-1.5 sm:mt-3 text-teal-400 truncate">${stats.totalDueAmount.toLocaleString()} ج.م</h4>
    </div>
    <div class="bg-rose-900 text-white rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-20 sm:h-32">
      <p class="text-[10px] sm:text-xs text-rose-200 font-semibold truncate">متأخرة</p>
      <h4 class="text-base sm:text-3xl font-extrabold mt-1.5 sm:mt-3 text-rose-300 truncate">${stats.overdueCount}</h4>
    </div>
    <div class="bg-emerald-900 text-white rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-20 sm:h-32">
      <p class="text-[10px] sm:text-xs text-emerald-200 font-semibold truncate">قيد الاستحقاق</p>
      <h4 class="text-base sm:text-3xl font-extrabold mt-1.5 sm:mt-3 text-emerald-300 truncate">${stats.pendingCount}</h4>
    </div>
  `;
  
  // Render installments table
  const tbody = document.getElementById('today-installments-body');
  const emptyState = document.getElementById('today-empty-state');
  
  if (!tbody) return;
  
  if (stats.totalCount === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
  } else {
    if (emptyState) emptyState.classList.add('hidden');
    tbody.innerHTML = stats.installments.map(inst => {
      const status = getInstallmentOverdueStatus(inst);
      const statusText = status.overdueDays > 0 ? `⚠️ متأخر ${status.overdueDays} يوم` : '📅 يستحق اليوم';
      const statusColor = status.overdueDays > 0 ? 'text-rose-600' : 'text-sky-600';
      
      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="p-4 font-bold text-slate-800">${escapeHTML(inst.clientName)}</td>
          <td class="p-4 font-mono text-slate-600">${escapeHTML(inst.clientPhone)}</td>
          <td class="p-4 font-bold font-mono text-teal-600">${inst.amount.toLocaleString()} ج.م</td>
          <td class="p-4 text-sm ${statusColor}">${statusText}</td>
          <td class="p-4 text-center">
            <div class="inline-flex gap-1">
              <button onclick="openWhatsappModal('${inst.id}', 'reminder')" class="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-xs font-bold transition-all" title="إرسال تذكير">
                <i class="ph ph-bell"></i>
              </button>
              <button onclick="collectInstallmentBtn('${inst.id}')" class="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-bold transition-all" title="تحصيل">
                <i class="ph ph-check-square"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  logAction('عرض تنبيهات اليوم', `عرض ${stats.totalCount} قسط مستحق اليوم`);
}
