/**
 * تحسينات نظام الربط الآلي مع واتساب
 * يركز على:
 * 1. تنبيهات صباحية بالأقساط المستحقة اليوم
 * 2. إرسال جماعي بضغطة زر واحدة (بدون الحاجة للمرور على كل عميل)
 * 3. جدولة التنبيهات التلقائية
 */

// ================= حساب الأقساط المستحقة اليوم =================
/**
 * الحصول على الأقساط المستحقة اليوم
 */
function getTodayDueInstallments() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const todayInstallments = db.installments.filter(inst => {
    return inst.dueDate === today && inst.status !== 'paid';
  });
  
  return todayInstallments;
}

/**
 * حساب إحصائيات الأقساط المستحقة اليوم
 */
function getTodayDueStats() {
  const todayInstallments = getTodayDueInstallments();
  
  const totalDueAmount = todayInstallments.reduce((sum, inst) => sum + inst.amount, 0);
  const overdueCount = todayInstallments.filter(inst => {
    const status = getInstallmentOverdueStatus(inst);
    return status.overdueDays > 0;
  }).length;
  
  return {
    totalCount: todayInstallments.length,
    totalDueAmount,
    overdueCount,
    pendingCount: todayInstallments.length - overdueCount,
    installments: todayInstallments
  };
}

/**
 * إنشاء تنبيه صباحي بالأقساط المستحقة اليوم
 */
function generateTodayDueReminder() {
  const stats = getTodayDueStats();
  
  if (stats.totalCount === 0) {
    return {
      hasDue: false,
      message: 'لا توجد أقساط مستحقة اليوم'
    };
  }
  
  const today = new Date().toLocaleDateString('ar-EG');
  const message = `
📢 تنبيه صباحي - الأقساط المستحقة اليوم ${today}

📊 الإحصائيات:
• عدد الأقساط المستحقة: ${stats.totalCount}
• الإجمالي المطلوب: ${stats.totalDueAmount.toLocaleString()} ج.م
• منها متأخرة: ${stats.overdueCount}
• قيد الاستحقاق: ${stats.pendingCount}

👥 تفاصيل العملاء:
${stats.installments.map((inst, idx) => {
  const status = getInstallmentOverdueStatus(inst);
  const statusText = status.overdueDays > 0 ? `⚠️ متأخر ${status.overdueDays} يوم` : '📅 يستحق اليوم';
  return `${idx + 1}. ${inst.clientName} - ${inst.amount.toLocaleString()} ج.م ${statusText}`;
}).join('\n')}

💡 استخدم زر "إرسال تنبيهات جماعية" لإرسال رسائل واتساب لجميع العملاء تلقائياً.
  `.trim();
  
  return {
    hasDue: true,
    stats,
    message,
    timestamp: new Date().toLocaleString('ar-EG')
  };
}

// ================= إرسال جماعي محسّن =================
/**
 * إعداد الرسائل الجماعية للإرسال بضغطة زر واحدة
 */
function prepareBulkWhatsappMessages(installmentIds = null, messageType = 'reminder') {
  let targetInstallments;
  
  if (installmentIds) {
    // إرسال لأقساط محددة
    targetInstallments = db.installments.filter(inst => 
      installmentIds.includes(inst.id) && inst.status !== 'paid'
    );
  } else {
    // إرسال لأقساط اليوم
    targetInstallments = getTodayDueInstallments();
  }
  
  if (targetInstallments.length === 0) {
    return {
      success: false,
      message: 'لا توجد أقساط للإرسال'
    };
  }
  
  const companyName = db.settings.companyName || 'شركة SKY';
  const templates = db.settings.templates || {};
  
  let templateText;
  if (messageType === 'reminder') {
    templateText = templates.reminder || `مرحباً {{الاسم}}، نود تذكيركم بموعد استحقاق القسط الشهري لعقدكم رقم {{العقد}} لدى {{اسم_الشركة}}. المبلغ المطلوب: {{القسط}} ج.م. تاريخ الاستحقاق: {{التاريخ}}.`;
  } else if (messageType === 'warning') {
    templateText = templates.warning || `تنبيه هام: تجاوز تاريخ استحقاق قسطكم لعقد رقم {{العقد}}. المبلغ المطلوب: {{القسط}} ج.م + غرامة {{الغرامة}} ج.م.`;
  } else if (messageType === 'receipt') {
    templateText = templates.receipt || `تم استلام دفعتكم بنجاح! شكراً على سداد القسط الشهري لعقدكم رقم {{العقد}}.`;
  }
  
  const messages = targetInstallments.map(inst => {
    const status = getInstallmentOverdueStatus(inst);
    
    const resolvedMsg = templateText
      .replace(/{{الاسم}}/g, inst.clientName)
      .replace(/{{القسط}}/g, inst.amount.toLocaleString())
      .replace(/{{التاريخ}}/g, inst.dueDate)
      .replace(/{{العقد}}/g, inst.contractId.replace('con-', ''))
      .replace(/{{الغرامة}}/g, status.fine.toLocaleString())
      .replace(/{{المطلوب}}/g, status.totalDue.toLocaleString())
      .replace(/{{اسم_الشركة}}/g, companyName);
    
    return {
      installmentId: inst.id,
      clientName: inst.clientName,
      clientPhone: inst.clientPhone,
      normalizedPhone: normalizeWhatsappPhone(inst.clientPhone),
      amount: inst.amount,
      dueDate: inst.dueDate,
      message: resolvedMsg,
      status: 'pending' // pending, sent, failed
    };
  });
  
  return {
    success: true,
    totalCount: messages.length,
    messages,
    messageType,
    preparedAt: new Date().toLocaleString('ar-EG')
  };
}

/**
 * إرسال الرسائل الجماعية بتسلسل (واحدة تلو الأخرى)
 */
async function sendBulkWhatsappMessages(preparedMessages) {
  let sentCount = 0;
  let failedCount = 0;
  const results = [];
  
  for (const msg of preparedMessages.messages) {
    try {
      if (!msg.normalizedPhone) {
        results.push({
          ...msg,
          status: 'failed',
          reason: 'رقم هاتف غير صحيح'
        });
        failedCount++;
        continue;
      }
      
      // فتح واتساب بالرسالة المعدة
      const waUrl = `https://wa.me/${msg.normalizedPhone}?text=${encodeURIComponent(msg.message)}`;
      window.open(waUrl, '_blank');
      
      // إضافة تأخير بسيط لتجنب الحجب
      await new Promise(resolve => setTimeout(resolve, 500));
      
      results.push({
        ...msg,
        status: 'sent',
        sentAt: new Date().toLocaleString('ar-EG')
      });
      sentCount++;
      
      // تسجيل في سجل العمليات
      logAction('إرسال واتساب', `إرسال رسالة واتساب للعميل ${msg.clientName} (${msg.clientPhone})`);
      
    } catch (error) {
      results.push({
        ...msg,
        status: 'failed',
        reason: error.message
      });
      failedCount++;
    }
  }
  
  return {
    totalCount: preparedMessages.messages.length,
    sentCount,
    failedCount,
    results,
    completedAt: new Date().toLocaleString('ar-EG')
  };
}

// ================= واجهة المستخدم =================
/**
 * عرض لوحة التنبيهات الصباحية
 */
window.showTodayDueRemindersPanel = function() {
  const reminder = generateTodayDueReminder();
  
  const panel = document.createElement('div');
  panel.className = 'fixed bottom-4 right-4 bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md z-40 p-6';
  panel.innerHTML = `
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <i class="ph ph-bell-ringing text-amber-600 text-lg"></i>
        </div>
        <h3 class="font-bold text-slate-800">تنبيهات اليوم</h3>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="text-slate-400 hover:text-slate-600">
        <i class="ph ph-x text-lg"></i>
      </button>
    </div>
    
    ${reminder.hasDue ? `
      <div class="space-y-3">
        <div class="bg-amber-50 border border-amber-100 rounded-lg p-3">
          <p class="text-sm font-semibold text-amber-900">الأقساط المستحقة اليوم</p>
          <p class="text-2xl font-bold text-amber-600 mt-1">${reminder.stats.totalCount}</p>
          <p class="text-xs text-amber-700 mt-1">إجمالي المبلغ: ${reminder.stats.totalDueAmount.toLocaleString()} ج.م</p>
        </div>
        
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-rose-50 border border-rose-100 rounded-lg p-2 text-center">
            <p class="text-xs text-rose-600 font-semibold">متأخرة</p>
            <p class="text-lg font-bold text-rose-600">${reminder.stats.overdueCount}</p>
          </div>
          <div class="bg-sky-50 border border-sky-100 rounded-lg p-2 text-center">
            <p class="text-xs text-sky-600 font-semibold">قيد الاستحقاق</p>
            <p class="text-lg font-bold text-sky-600">${reminder.stats.pendingCount}</p>
          </div>
        </div>
        
        <button onclick="sendTodayDueRemindersInBulk()" class="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2">
          <i class="ph ph-paper-plane"></i>
          <span>إرسال تنبيهات جماعية الآن</span>
        </button>
        
        <button onclick="viewTodayDueDetails()" class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-sm transition-all">
          عرض التفاصيل
        </button>
      </div>
    ` : `
      <div class="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-center">
        <i class="ph ph-check-circle text-3xl text-emerald-600 mb-2"></i>
        <p class="text-emerald-700 font-semibold">لا توجد أقساط مستحقة اليوم</p>
        <p class="text-xs text-emerald-600 mt-1">كل شيء على ما يرام ✨</p>
      </div>
    `}
  `;
  
  document.body.appendChild(panel);
};

/**
 * إرسال تنبيهات اليوم بضغطة زر واحدة
 */
window.sendTodayDueRemindersInBulk = async function() {
  const prepared = prepareBulkWhatsappMessages(null, 'reminder');
  
  if (!prepared.success) {
    alert(prepared.message);
    return;
  }
  
  if (!(await customConfirm(`هل تريد إرسال ${prepared.totalCount} تنبيه واتساب للعملاء الآن؟`))) {
    return;
  }
  
  // عرض شاشة التقدم
  const progressModal = document.createElement('div');
  progressModal.id = 'bulk-send-progress-modal';
  progressModal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
  progressModal.innerHTML = `
    <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
      <h3 class="font-bold text-slate-800 text-lg mb-4">جاري إرسال التنبيهات...</h3>
      
      <div class="space-y-3">
        <div>
          <div class="flex justify-between text-xs font-semibold text-slate-600 mb-1">
            <span id="progress-label">جاري الإرسال...</span>
            <span id="progress-count">0 / ${prepared.totalCount}</span>
          </div>
          <div class="w-full bg-slate-200 rounded-full h-2">
            <div id="progress-bar" class="bg-teal-600 h-2 rounded-full transition-all" style="width: 0%"></div>
          </div>
        </div>
        
        <div class="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto text-xs">
          <div id="progress-log" class="space-y-1 text-slate-600"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(progressModal);
  
  // إرسال الرسائل
  const results = await sendBulkWhatsappMessages(prepared);
  
  // تحديث النتائج
  const logEl = document.getElementById('progress-log');
  results.results.forEach(result => {
    const logItem = document.createElement('div');
    logItem.className = result.status === 'sent' ? 'text-emerald-600' : 'text-rose-600';
    logItem.textContent = `${result.clientName}: ${result.status === 'sent' ? '✓ تم الإرسال' : '✗ فشل'}`;
    logEl.appendChild(logItem);
  });
  
  // إغلاق الشاشة
  setTimeout(() => {
    progressModal.remove();
    alert(`تم إرسال ${results.sentCount} رسالة بنجاح\nفشل: ${results.failedCount}`);
    logAction('إرسال جماعي', `إرسال تنبيهات اليوم: ${results.sentCount} نجح، ${results.failedCount} فشل`);
  }, 2000);
};

/**
 * عرض تفاصيل الأقساط المستحقة اليوم
 */
window.viewTodayDueDetails = function() {
  const stats = getTodayDueStats();
  
  if (stats.totalCount === 0) {
    alert('لا توجد أقساط مستحقة اليوم');
    return;
  }
  
  const today = new Date().toLocaleDateString('ar-EG');
  
  let rows = stats.installments.map(inst => {
    const status = getInstallmentOverdueStatus(inst);
    const statusText = status.overdueDays > 0 ? `⚠️ متأخر ${status.overdueDays} يوم` : '📅 يستحق اليوم';
    
    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50">
        <td class="p-3 font-bold text-slate-800">${escapeHTML(inst.clientName)}</td>
        <td class="p-3 text-slate-600">${escapeHTML(inst.clientPhone)}</td>
        <td class="p-3 font-mono font-bold text-teal-600">${inst.amount.toLocaleString()} ج.م</td>
        <td class="p-3 text-xs">${statusText}</td>
        <td class="p-3 text-center">
          <button onclick="openWhatsappModal('${inst.id}', 'reminder')" class="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-xs font-bold">
            <i class="ph ph-paper-plane"></i> إرسال
          </button>
        </td>
      </tr>
    `;
  }).join('');
  
  const html = `
    <div class="print-doc-header">
      <div>
        <div style="font-weight:800; font-size:1.2rem; color:#0d9488;">الأقساط المستحقة اليوم</div>
        <div style="font-size:0.75rem; color:#64748b;">التاريخ: ${today}</div>
      </div>
    </div>
    
    <div class="print-doc-title">تفاصيل الأقساط المستحقة اليوم</div>
    
    <div style="margin-top:14px; padding:10px 12px; background:#ecfdf5; border-radius:8px; display:flex; justify-content:space-around; text-align:center; font-size:0.85rem;">
      <div>
        <div style="color:#64748b; font-size:0.7rem;">عدد الأقساط</div>
        <strong>${stats.totalCount}</strong>
      </div>
      <div>
        <div style="color:#64748b; font-size:0.7rem;">الإجمالي المطلوب</div>
        <strong style="color:#059669;">${stats.totalDueAmount.toLocaleString()} ج.م</strong>
      </div>
      <div>
        <div style="color:#64748b; font-size:0.7rem;">منها متأخرة</div>
        <strong style="color:#e11d48;">${stats.overdueCount}</strong>
      </div>
    </div>
    
    <div style="margin-top:18px;">
      <table class="print-doc-table" style="width:100%;">
        <thead>
          <tr style="background:#f1f5f9; font-weight:bold;">
            <th style="padding:8px; text-align:right;">اسم العميل</th>
            <th style="padding:8px; text-align:center;">رقم الهاتف</th>
            <th style="padding:8px; text-align:left;">المبلغ</th>
            <th style="padding:8px; text-align:left;">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${stats.installments.map(inst => {
            const status = getInstallmentOverdueStatus(inst);
            const statusText = status.overdueDays > 0 ? `متأخر ${status.overdueDays} يوم` : 'يستحق اليوم';
            return `
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px; text-align:right; font-weight:bold;">${escapeHTML(inst.clientName)}</td>
                <td style="padding:8px; text-align:center; font-family:monospace;">${escapeHTML(inst.clientPhone)}</td>
                <td style="padding:8px; text-align:left; font-weight:bold; color:#0d9488;">${inst.amount.toLocaleString()} ج.م</td>
                <td style="padding:8px; text-align:left; font-size:0.85rem;">${statusText}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="print-doc-footer">تم إصدار هذا التقرير في ${today}</div>
  `;
  
  printHTML(html);
  logAction('عرض تفاصيل اليوم', `عرض تفاصيل الأقساط المستحقة اليوم (${stats.totalCount} قسط)`);
};

// ================= جدولة التنبيهات التلقائية =================
/**
 * تفعيل التنبيهات الصباحية التلقائية
 * (يتم استدعاؤها عند فتح الصفحة أو تحديثها)
 */
function initializeDailyReminders() {
  // التحقق من آخر مرة تم فيها عرض التنبيه اليوم
  const lastReminderDate = localStorage.getItem('lastDailyReminderDate');
  const today = new Date().toISOString().split('T')[0];
  
  if (lastReminderDate !== today) {
    // عرض التنبيه الصباحي
    setTimeout(() => {
      showTodayDueRemindersPanel();
      localStorage.setItem('lastDailyReminderDate', today);
    }, 1000);
  }
}

// ملاحظة: تم إلغاء الاستدعاء التلقائي هنا لمنع ظهور التنبيه في صفحة الدخول.
// يتم الآن استدعاء initializeDailyReminders برمجياً من داخل app.js فقط بعد نجاح تسجيل الدخول.
