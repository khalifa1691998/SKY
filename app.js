/**
 * نظام شركة SKY - المحرك البرمجي الرئيسي لإدارة الحسابات والأقساط والخزينة
 * المطور: Khalifa (ADMIN)
 */

console.log('SKY_BUILD_VERSION: v3-balances-standalone-tab-2026-07-05');
// ================= STATE MANAGEMENT & INITIAL DATABASE =================
// متغير عالمي لحالة الاتصال بـ Firebase
let firebaseSubscriptionActive = false;

let db = {

  clients: [],
  inventory: [],
  brands: ['Oppo', 'Samsung', 'iPhone'], // Default Brands/Categories
  suppliers: [],
  contracts: [],
  installments: [],
  collectorCustodies: [],
  treasuryTransactions: [],
  users: [],
  auditLogs: [],
  investors: [], // المستثمرون ورأس مال الشركة: { id, name, capitalAmount, joinDate, notes, totalWithdrawn }
  settings: {
    offlineMode: false,
    companyName: 'شركة SKY',
    companyLogo: '', // Base64 or URL
    templates: {
      reminder: `مرحباً أ/ {{الاسم}}،
نود تذكيركم بموعد استحقاق القسط الشهري لعقدكم رقم {{العقد}} لدى {{اسم_الشركة}}.
المبلغ المطلوب: {{القسط}} ج.م.
تاريخ الاستحقاق: {{التاريخ}}.
يرجى التنسيق مع المحصل لتسوية المبلغ في الموعد المحدد. شكراً لتعاونكم المتواصل 🌹`,
      warning: `تنبيه هام وعاجل ⚠️
السيد/ {{الاسم}}،
نحيطكم علماً بتجاوز تاريخ استحقاق قسطكم لعقد رقم {{العقد}} والمستحق بتاريخ {{التاريخ}}، وقد انقضت فترة السماح.
تفاصيل المتأخرات:
- قيمة القسط الأصلية: {{القسط}} ج.م
- غرامة التأخير المتراكمة: {{الغرامة}} ج.م
إجمالي المبلغ المطلوب سداده فوراً: {{المطلوب}} ج.م.
نرجو السداد الفوري لتفادي اتخاذ الإجراءات القانونية.`,
      receipt: `تم استلام دفعتكم بنجاح 🧾
أ/ {{الاسم}}،
نشكركم على سداد القسط الشهري لعقدكم رقم {{العقد}} لدى {{اسم_الشركة}}.
المبلغ المحصل: {{القسط}} ج.م.
رقم إيصال التحصيل: {{الإيصال}}.
تم تسجيل المبلغ بخزيناتنا المالية وتحديث حسابكم. دمتم بكل خير ✨`
    }
  }
};

// Temp file upload storage (base64)
let tempUploads = {
  clientCardImg: '',
  clientContractImg: '',
  guarantorCardImg: '',
  guarantorContractImg: ''
};

// Keep track of expanded client IDs in Collections Tab
let expandedClients = new Set();

// Default Seed Data
// ملاحظة: تم حذف كل بيانات المستخدمين/العملاء/العقود التجريبية (وكلمات المرور
// النصية المصاحبة لها) اللي كانت هنا سابقاً. زرار "إعادة حقن البيانات
// الافتراضية" في الإعدادات دلوقتي بيرجع النظام لحالة فاضية تماماً بدل ما
// يحقن حسابات وهمية بكلمة مرور "123" كانت ظاهرة لأي حد يفتح مصدر الصفحة.
const defaultSeedData = {
  users: [],
  brands: ['Oppo', 'Samsung', 'iPhone', 'Xiaomi'],
  suppliers: [],
  clients: [],
  inventory: [],
  contracts: [],
  installments: [],
  collectorCustodies: [],
  treasuryTransactions: [],
  auditLogs: [],
  investors: [],
  settings: {
    offlineMode: false,
    companyName: 'شركة SKY',
    companyLogo: '',
    templates: {
      reminder: `مرحباً أ/ {{الاسم}}،
نود تذكيركم بموعد استحقاق القسط الشهري لعقدكم رقم {{العقد}} لدى {{اسم_الشركة}}.
المبلغ المطلوب: {{القسط}} ج.م.
تاريخ الاستحقاق: {{التاريخ}}.
يرجى التنسيق مع المحصل لتسوية المبلغ في الموعد المحدد. شكراً لتعاونكم المتواصل 🌹`,
      warning: `تنبيه هام وعاجل ⚠️
السيد/ {{الاسم}}،
نحيطكم علماً بتجاوز تاريخ استحقاق قسطكم لعقد رقم {{العقد}} والمستحق بتاريخ {{التاريخ}}، وقد انقضت فترة السماح.
تفاصيل المتأخرات:
- قيمة القسط الأصلية: {{القسط}} ج.م
- غرامة التأخير المتراكمة: {{الغرامة}} ج.م
إجمالي المبلغ المطلوب سداده فوراً: {{المطلوب}} ج.م.
نرجو السداد الفوري لتفادي اتخاذ الإجراءات القانونية.`,
      receipt: `تم استلام دفعتكم بنجاح 🧾
أ/ {{الاسم}}،
نشكركم على سداد القسط الشهري لعقدكم رقم {{العقد}} لدى {{اسم_الشركة}}.
المبلغ المحصل: {{القسط}} ج.م.
رقم إيصال التحصيل: {{الإيصال}}.
تم تسجيل المبلغ بخزيناتنا المالية وتحديث حسابكم. دمتم بكل خير ✨`
    }
  }
};

// Function to generate due installments for seeded contracts on startup
function generateSeededInstallments() {
  db.installments = [];
  db.contracts.forEach(contract => {
    let start = new Date(contract.startDate);
    for (let i = 1; i <= contract.duration; i++) {
      let dueDate = new Date(start);
      dueDate.setMonth(start.getMonth() + (i - 1));
      
      db.installments.push({
        id: `${contract.id}_${i}`,
        contractId: contract.id,
        clientId: contract.clientId,
        clientName: contract.clientName,
        clientPhone: contract.clientPhone,
        guarantorName: db.clients.find(c => c.id === contract.clientId)?.guarantorName || '',
        guarantorPhone: db.clients.find(c => c.id === contract.clientId)?.guarantorPhone || '',
        collectorName: contract.collectorName,
        installmentNum: i,
        amount: contract.monthlyInstallment,
        dueDate: dueDate.toISOString().split('T')[0],
        status: 'pending',
        paidAmount: 0,
        paidDate: '',
        receiptId: '',
        delayFines: 0
      });
    }
  });
}

// ================= CUSTOM CONFIRM MODAL =================
// بديل لصندوق confirm() الافتراضي بالمتصفح (اللي بيظهر بشكل نافذة منفصلة
// وبيكتب اسم الدومين "khalifa1691998.github.io says" - بيحسس المستخدم إنه
// جزء من المتصفح مش من الموقع). المودال ده مصمم بنفس هوية الموقع بالكامل.
function customConfirm(message, title) {
  return new Promise((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    const msgEl = document.getElementById('custom-confirm-message');
    const titleEl = document.getElementById('custom-confirm-title');
    const okBtn = document.getElementById('custom-confirm-ok-btn');
    const cancelBtn = document.getElementById('custom-confirm-cancel-btn');

    if (!modal || !msgEl || !okBtn || !cancelBtn) {
      // شبكة أمان: لو حصل أي خطأ غير متوقع في تحميل عناصر المودال، نرجع
      // للسلوك الافتراضي بدل ما نوقف العملية بالكامل
      resolve(window.confirm(message));
      return;
    }

    msgEl.textContent = message;
    titleEl.textContent = title || 'تأكيد العملية';
    modal.classList.remove('hidden');

    function cleanup(result) {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}
window.customConfirm = customConfirm;

// ================= أمان العرض: تعقيم أي نص قبل حقنه في innerHTML =================
// أي بيانات كتبها مستخدم (اسم عميل، ملاحظة، اسم مورد، اسم محصل...) لازم تمر
// من هنا قبل ما تتحط جوه أي innerHTML أو attribute، عشان نمنع حقن HTML/JS
// (Stored XSS) لو حد كتب مثلاً اسم عميل فيه <script> أو علامة اقتباس.
function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHTML = escapeHTML;

// ================= SESSION / LOGIN MANAGEMENT (Firebase Authentication) =================
// تسجيل الدخول أصبح يعتمد بالكامل على Firebase Authentication الحقيقي بدل
// المقارنة اليدوية لكلمة المرور. لا توجد كلمات مرور نصية تُقرأ من قاعدة البيانات بعد الآن.
let currentUser = null;

function isAdmin() {
  return currentUser && currentUser.role === 'ADMIN';
}

function getCurrentUserName() {
  return currentUser ? currentUser.name : 'مجهول';
}

function hideSessionCheckOverlay() {
  const overlay = document.getElementById('session-check-overlay');
  if (overlay) overlay.classList.add('hidden');
  if (typeof handleMobileTopbar === 'function') handleMobileTopbar();
}

function showLoginScreen() {
  hideSessionCheckOverlay();
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('app-wrapper').classList.add('hidden');
  document.getElementById('login-username-input').value = '';
  document.getElementById('login-password-input').value = '';
  setLoginLoading(false);
  if (typeof handleMobileTopbar === 'function') handleMobileTopbar();
}

function hideLoginScreen() {
  hideSessionCheckOverlay();
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('app-wrapper').classList.remove('hidden');
  if (typeof handleMobileTopbar === 'function') handleMobileTopbar();
}

function showLoginError(message) {
  const errorMsg = document.getElementById('login-error-msg');
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
}

function hideLoginError() {
  document.getElementById('login-error-msg').classList.add('hidden');
}

// تبديل شكل زرار الدخول بين الحالة العادية وحالة "جاري التحقق"
function setLoginLoading(isLoading, message) {
  const btn = document.getElementById('login-submit-btn');
  if (!btn) return;
  btn.disabled = isLoading;
  btn.innerHTML = isLoading
    ? `<i class="ph ph-spinner ph-spin"></i><span>${message || 'جاري التحقق...'}</span>`
    : `<i class="ph ph-sign-in"></i><span>تسجيل الدخول</span>`;
}

// يُستدعى عند الضغط على زرار "تسجيل الدخول" - يرسل الطلب فعلياً لـ Firebase Authentication
async function performLogin() {
  const username = document.getElementById('login-username-input').value.trim();
  const password = document.getElementById('login-password-input').value.trim();
  hideLoginError();

  if (!username || !password) {
    showLoginError('❌ من فضلك ادخل اسم المستخدم وكلمة المرور.');
    return;
  }

  if (!window.FirebaseAuthService) {
    showLoginError('❌ تعذر الاتصال بخدمة تسجيل الدخول (Firebase). تأكد من اتصال الإنترنت وحاول تحديث الصفحة.');
    return;
  }

  setLoginLoading(true);
  try {
    // النجاح هنا لا يعني اكتمال الدخول؛ باقي إجراءات الدخول (تحميل البروفايل
    // وفتح الشاشة الرئيسية) تتم تلقائياً عبر مستمع حدث firebase-auth-changed
    await window.FirebaseAuthService.signIn(username, password);
  } catch (error) {
    console.error('Login error:', error.code, error.message);
    let msg = '❌ اسم المستخدم أو كلمة المرور غير صحيحة.';
    if (error.code === 'auth/too-many-requests') {
      msg = '⏳ محاولات دخول خاطئة كثيرة. من فضلك انتظر قليلاً وحاول مرة أخرى.';
    } else if (error.code === 'auth/network-request-failed') {
      msg = '❌ لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى.';
    } else if (error.code === 'auth/user-disabled') {
      msg = '⛔ هذا الحساب معطّل. تواصل مع مشرف النظام.';
    }
    showLoginError(msg);
    document.getElementById('login-password-input').value = '';
    setLoginLoading(false);
  }
}

// بعد نجاح الدخول في Firebase Authentication، نبحث عن بروفايل هذا المستخدم
// (الاسم، الدور، المنطقة...) داخل مجموعة "users" في Firestore بمطابقة authUid
async function resolveCurrentUserFromAuth(uid, email) {
  let user = db.users.find(u => u.authUid === uid);

  // --- شبكة أمان: لو المستخدم متسجل بحساب Firebase Auth حقيقي وناجح، لكن
  // ملفه في Firestore لسه معندوش authUid (لسه ما اتعمل له ترحيل، أو الترحيل
  // فشل جزئياً)، بنحاول نطابقه عن طريق الإيميل الداخلي (username -> email)
  // بدل ما نعمل تسجيل خروج فوري ونرجّعه لشاشة الدخول من غير أي سبب واضح له.
  // ده هو سبب مشكلة "الرجوع لصفحة الدخول عند أي Refresh".
  if (!user && email && window.FirebaseAuthService) {
    user = db.users.find(u => window.FirebaseAuthService.usernameToAuthEmail(u.username) === email);
    if (user) {
      console.warn(`تم إيجاد المستخدم "${user.username}" عن طريق الإيميل بدل authUid. جاري إصلاح ملفه تلقائياً...`);
      user.authUid = uid;
      saveToLocalStorage();
      // نحدّث Firestore كمان عشان المرة الجاية يتلاقى مباشرة عن طريق authUid
      // (وبنبعت الدور "role" كمان عشان يتزامن مستند صلاحيات المستخدم userRoles
      // اللي قواعد أمان Firestore بتعتمد عليه)
      syncWithAppsScript('updateUser', { id: user.id, authUid: uid, role: user.role }).catch(err => {
        console.error('فشل حفظ authUid في Firestore:', err);
      });
    }
  }

  if (!user) {
    showLoginError('⚠️ تم التحقق من هويتك بنجاح، لكن لا يوجد ملف مستخدم مرتبط بحسابك في النظام. تواصل مع المشرف.');
    setLoginLoading(false);
    if (window.FirebaseAuthService) await window.FirebaseAuthService.signOut();
    return;
  }

  currentUser = user;
  hideLoginScreen();
  updateUIForRole();
  document.getElementById('current-user-display').textContent = `${user.name} (${user.role})`;
  document.getElementById('header-username').textContent = user.name;
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (avatarEl) avatarEl.textContent = (user.name || '').trim().charAt(0) || '؟';

  // فتح الصفحة الأخيرة النشطة المفتوحة مسبقاً أو فتح لوحة القيادة كوضع افتراضي
  let savedTab = localStorage.getItem('sky_erp_active_tab') || 'dashboard';
  if (user.role === 'COLLECTOR') {
    savedTab = 'collections';
  }
  switchTab(savedTab);
}

// تسجيل الخروج الفعلي: يقفل جلسة Firebase Authentication نفسها، مش بس واجهة الاستخدام
async function handleUserLogout() {
  currentUser = null;
  firebaseSubscriptionActive = false;
  try {
    if (window.FirebaseAuthService) await window.FirebaseAuthService.signOut();
  } catch (e) {
    console.error('Sign out error:', e);
  }
  // showLoginScreen() سيتم استدعاؤه تلقائياً عبر حدث firebase-auth-changed (signedIn: false)
}

function updateUIForRole() {
  const isCollector = currentUser && currentUser.role === 'COLLECTOR';
  
  // 1. إظهار/إخفاء العناصر الخاصة بالمشرف فقط
  const adminEls = document.querySelectorAll('.admin-only');
  adminEls.forEach(el => {
    if (isAdmin()) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
  
  // 2. إخفاء التبويبات غير المصرح بها للمحصل من القائمة الجانبية
  const sidebarLinks = document.querySelectorAll('#sidebar-menu a');
  sidebarLinks.forEach(link => {
    const tab = link.getAttribute('data-tab');
    if (isCollector) {
      if (tab === 'collections') {
        link.classList.remove('hidden');
      } else {
        link.classList.add('hidden');
      }
    } else {
      link.classList.remove('hidden');
    }
  });
  
  // 3. تحديث شارة دور المستخدم في أعلى الصفحة
  const roleBadge = document.getElementById('header-role-badge');
  if (roleBadge) {
    if (isAdmin()) {
      roleBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-teal-600 animate-ping"></span>الوصول: مشرف (ADMIN)';
      roleBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-100';
    } else if (isCollector) {
      roleBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>الوصول: محصل (COLLECTOR)';
      roleBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100';
    } else {
      roleBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-600"></span>الوصول: ${currentUser ? currentUser.role : 'مجهول'}`;
      roleBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-100';
    }
  }
}

function initDatabase() {
  const isLocalFile = window.location.protocol === 'file:';
  const localData = localStorage.getItem('sky_erp_db');
  if (localData) {
    db = JSON.parse(localData);
    if (db.settings.offlineMode === undefined) {
      db.settings.offlineMode = false;
    }
    if (!db.brands) db.brands = ['Oppo', 'Samsung', 'iPhone', 'Xiaomi'];
    if (!db.investors) db.investors = [];
    if (!db.settings.companyName) db.settings.companyName = 'شركة SKY';
    if (!db.settings.companyLogo) db.settings.companyLogo = '';
    if (!db.settings.templates) {
      db.settings.templates = defaultSeedData.settings.templates;
    }
    // هجرة البيانات: التأكد من أن جميع الحسابات القديمة تمتلك كلمة مرور لمنع فشل تسجيل الدخول
    if (db.users) {
      let updated = false;
      db.users.forEach(u => {
        if (!u.password) {
          const seedUser = defaultSeedData.users.find(su => su.username === u.username);
          u.password = seedUser ? seedUser.password : '123';
          updated = true;
        }
      });
      if (updated) {
        saveToLocalStorage();
      }
    }
  } else {
    db = defaultSeedData;
    db.settings.offlineMode = false;
    generateSeededInstallments();
    saveToLocalStorage();
  }
  
  applyCompanyBranding();
  updateSyncStatusUI();
}

function saveToLocalStorage() {
  localStorage.setItem('sky_erp_db', JSON.stringify(db));
}

// ================= BACKUP & RESTORE SYSTEM =================
window.exportBackup = function() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
  
  const backupPayload = {
    _meta: {
      version: '1.0',
      system: 'SKY ERP',
      createdAt: now.toISOString(),
      createdBy: getCurrentUserName(),
      label: `نسخة احتياطية - ${dateStr}`
    },
    data: {
      clients: db.clients,
      inventory: db.inventory,
      brands: db.brands,
      suppliers: db.suppliers,
      contracts: db.contracts,
      installments: db.installments,
      collectorCustodies: db.collectorCustodies,
      treasuryTransactions: db.treasuryTransactions,
      users: db.users,
      auditLogs: db.auditLogs,
      settings: db.settings
    }
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SKY_ERP_Backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  logAction('نسخ احتياطي', `تم تصدير نسخة احتياطية كاملة: ${backupPayload._meta.label}`);
  showToast('✅ تم حفظ النسخة الاحتياطية بنجاح!', 'success');
};

// ================= EXCEL BACKUP EXPORT (Archival / Review) =================
// تصدير نسخة Excel منظمة لكل بيانات النظام (شيت منفصل لكل قسم) عشان تتفتح
// بسهولة في Excel للمراجعة، الأرشفة، أو الطباعة. ده منفصل تماماً عن نسخة
// الـ JSON الاحتياطية اللي بتُستخدم للاسترجاع الفعلي داخل النظام.
window.exportExcelBackup = function() {
  if (typeof XLSX === 'undefined') {
    showToast('❌ تعذر تحميل مكتبة تصدير Excel. تأكد من اتصال الإنترنت وحاول تحديث الصفحة.', 'error');
    return;
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const nowLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const statusLabels = {
    available: 'متاح', sold_installment: 'مباع بالتقسيط', sold_cash: 'مباع كاش',
    active: 'ساري', completed: 'مكتمل', cancelled: 'ملغي',
    pending: 'قيد الانتظار', paid: 'مدفوع', approved: 'معتمد', rejected: 'مرفوض'
  };
  const typeLabels = {
    deposit: 'إيداع / رأس مال', expense: 'مصروفات خارجية', collection: 'تحصيل أقساط',
    cash_sale: 'بيع كاش فوري', inventory_purchase: 'شراء بضاعة ومخزون'
  };
  const roleLabels = { ADMIN: 'مشرف عام', COLLECTOR: 'محصل' };
  const L = (map, val) => map[val] || val || '';

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };

  const addSheet = (name, rows) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(12, k.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // 1. ملخص عام
  const totalTreasury = db.treasuryTransactions.reduce((s, t) => s + t.amount, 0);
  const totalSales = db.treasuryTransactions.filter(t => t.type === 'cash_sale' || t.type === 'collection').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = Math.abs(db.treasuryTransactions.filter(t => t.type === 'expense' || t.type === 'inventory_purchase').reduce((s, t) => s + t.amount, 0));
  const overdueInsts = db.installments.filter(i => i.status !== 'paid' && new Date(i.dueDate) < now).length;
  addSheet('ملخص عام', [{
    'اسم الشركة': db.settings.companyName || 'شركة SKY',
    'تاريخ التصدير': nowLabel,
    'رصيد الخزينة الحالي (ج.م)': totalTreasury,
    'إجمالي المبيعات والتحصيلات (ج.م)': totalSales,
    'إجمالي المصروفات والمشتريات (ج.م)': totalExpenses,
    'عدد العملاء': db.clients.length,
    'عدد الأجهزة بالمخزون': db.inventory.length,
    'عدد العقود': db.contracts.length,
    'عدد الأقساط المتأخرة': overdueInsts,
    'عدد المستخدمين': db.users.length
  }]);

  // 2. العملاء والضامنين
  addSheet('العملاء والضامنين', db.clients.map(c => ({
    'الاسم': c.name, 'الرقم القومي': c.nationalId, 'الهاتف': c.phone, 'العنوان': c.address,
    'اسم الضامن': c.guarantorName, 'رقم قومي الضامن': c.guarantorNationalId, 'هاتف الضامن': c.guarantorPhone,
    'صلة القرابة': c.guarantorRelation, 'وظيفة الضامن': c.guarantorJob, 'عنوان الضامن': c.guarantorAddress
  })));

  // 3. المخزون والأجهزة
  addSheet('المخزون والأجهزة', db.inventory.map(d => ({
    'الماركة': d.brand, 'الموديل': d.name, 'السيريال': d.serial, 'سعر التكلفة': d.costPrice,
    'سعر البيع': d.sellingPrice, 'المورد': d.supplier, 'الحالة': L(statusLabels, d.status), 'بيع لـ': d.soldTo || ''
  })));

  // 4. العقود
  addSheet('العقود', db.contracts.map(c => ({
    'رقم العقد': (c.id || '').replace('con-', ''), 'العميل': c.clientName, 'هاتف العميل': c.clientPhone,
    'الجهاز': c.deviceInfo, 'إجمالي قيمة العقد': c.totalValue, 'المقدم': c.downPayment,
    'المتبقي': c.remainingAmount, 'القسط الشهري': c.monthlyInstallment, 'عدد الأقساط': c.duration,
    'المحصل': c.collectorName, 'تاريخ البداية': c.startDate, 'الحالة': L(statusLabels, c.status)
  })));

  // 5. الأقساط
  addSheet('الأقساط', db.installments.map(i => ({
    'رقم العقد': (i.contractId || '').replace('con-', ''), 'العميل': i.clientName, 'هاتف العميل': i.clientPhone,
    'الضامن': i.guarantorName, 'المحصل': i.collectorName, 'رقم القسط': i.installmentNum,
    'المبلغ': i.amount, 'تاريخ الاستحقاق': i.dueDate, 'الحالة': L(statusLabels, i.status),
    'المبلغ المدفوع': i.paidAmount, 'تاريخ الدفع': i.paidDate || '', 'رقم الإيصال': i.receiptId || '',
    'غرامة التأخير': i.delayFines || 0
  })));

  // 6. عهد المحصلين
  addSheet('عهد المحصلين', db.collectorCustodies.map(c => ({
    'المحصل': c.collectorName, 'العميل': c.clientName, 'رقم العقد': (c.contractId || '').replace('con-', ''),
    'المبلغ': c.amount, 'التاريخ': c.date, 'الحالة': L(statusLabels, c.status)
  })));

  // 7. حركات الخزينة (الأحدث أولاً)
  addSheet('حركات الخزينة', sortByTimestampDesc([...db.treasuryTransactions]).map(t => ({
    'التاريخ والوقت': t.timestamp, 'النوع': L(typeLabels, t.type), 'البيان': t.notes, 'المبلغ': t.amount
  })));

  // 8. المستخدمين (بدون كلمة المرور لأسباب أمنية)
  addSheet('المستخدمين', db.users.map(u => ({
    'الاسم': u.name, 'اسم المستخدم': u.username, 'الصلاحية': L(roleLabels, u.role),
    'الهاتف': u.phone, 'المنطقة': u.area || ''
  })));

  // 9. الماركات والموردين
  addSheet('الماركات والموردين', (() => {
    const rows = [];
    const maxLen = Math.max(db.brands.length, db.suppliers.length);
    for (let i = 0; i < maxLen; i++) {
      rows.push({
        'الماركة': db.brands[i] || '',
        'اسم المورد': db.suppliers[i] ? db.suppliers[i].name : '',
        'هاتف المورد': db.suppliers[i] ? db.suppliers[i].phone : '',
        'ملاحظات': db.suppliers[i] ? (db.suppliers[i].notes || '') : ''
      });
    }
    return rows;
  })());

  // 10. سجل التدقيق (الأحدث أولاً)
  addSheet('سجل التدقيق', sortByTimestampDesc([...db.auditLogs]).map(l => ({
    'التاريخ والوقت': l.timestamp, 'المستخدم': l.user, 'نوع العملية': l.actionType, 'التفاصيل': l.details
  })));

  XLSX.writeFile(wb, `SKY_ERP_Excel_${dateStr}.xlsx`);

  logAction('نسخ احتياطي', `تم تصدير نسخة Excel منظمة للمراجعة والأرشفة`);
  showToast('✅ تم تصدير ملف Excel بنجاح!', 'success');
};

window.triggerRestoreBackup = function() {
  // Open confirmation modal first
  const modal = document.getElementById('backup-restore-confirm-modal');
  if (modal) modal.classList.remove('hidden');
};

window.confirmRestoreBackup = function() {
  const modal = document.getElementById('backup-restore-confirm-modal');
  if (modal) modal.classList.add('hidden');
  // Trigger file picker
  const fileInput = document.getElementById('backup-restore-file-input');
  if (fileInput) fileInput.click();
};

window.handleRestoreFileSelected = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);

      // Validate it's a SKY ERP backup
      if (!parsed._meta || parsed._meta.system !== 'SKY ERP' || !parsed.data) {
        showToast('❌ الملف المختار ليس نسخة احتياطية صحيحة لنظام SKY ERP!', 'error');
        return;
      }

      const restoredData = parsed.data;
      const meta = parsed._meta;

      // Restore all data
      if (restoredData.clients) db.clients = restoredData.clients;
      if (restoredData.inventory) db.inventory = restoredData.inventory;
      if (restoredData.brands) db.brands = restoredData.brands;
      if (restoredData.suppliers) db.suppliers = restoredData.suppliers;
      if (restoredData.contracts) db.contracts = restoredData.contracts;
      if (restoredData.installments) db.installments = restoredData.installments;
      if (restoredData.collectorCustodies) db.collectorCustodies = restoredData.collectorCustodies;
      if (restoredData.treasuryTransactions) db.treasuryTransactions = restoredData.treasuryTransactions;
      if (restoredData.users) db.users = restoredData.users;
      if (restoredData.auditLogs) db.auditLogs = restoredData.auditLogs;
      if (restoredData.settings) {
        // Preserve current connection settings, only restore data-related settings
        const currentConnectionSettings = {
          offlineMode: db.settings.offlineMode
        };
        db.settings = { ...restoredData.settings, ...currentConnectionSettings };
      }

      saveToLocalStorage();
      applyCompanyBranding();
      updateSyncStatusUI();
      renderAllTabs();

      logAction('استرجاع نسخة احتياطية', `تم استرجاع النسخة: ${meta.label} (أنشئت بواسطة: ${meta.createdBy})`);
      showToast(`✅ تم استرجاع النسخة الاحتياطية بنجاح! (${meta.label})`, 'success');

    } catch (err) {
      showToast('❌ خطأ في قراءة الملف. تأكد أنه ملف JSON صحيح!', 'error');
      console.error('Restore error:', err);
    }
    // Reset file input so user can pick same file again if needed
    event.target.value = '';
  };
  reader.readAsText(file, 'utf-8');
};

function showToast(message, type = 'success') {
  // Remove existing toasts
  document.querySelectorAll('.sky-toast').forEach(t => t.remove());
  
  const colors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-teal-600 text-white',
    warning: 'bg-amber-500 text-white'
  };
  
  const toast = document.createElement('div');
  toast.className = `sky-toast fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2 ${colors[type] || colors.success} transition-all duration-300`;
  toast.style.transform = 'translateX(-50%) translateY(20px)';
  toast.style.opacity = '0';
  toast.innerHTML = message;
  document.body.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity = '1';
  });
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ترتيب أي مصفوفة بيانات فيها timestamp بصيغة "YYYY-MM-DD HH:MM" بحيث يكون الأحدث دايماً في الأول.
// اتعملت الدالة دي عشان لما البيانات تيجي من Firebase (سواء تحميل أولي أو تحديث لحظي)
// بترجع من غير ترتيب مضمون، فكنا بنعرضها زي ما هي فيبان الترتيب عشوائي (مش الأحدث في الأول).
function sortByTimestampDesc(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.sort((a, b) => {
    const ta = a && a.timestamp ? a.timestamp : '';
    const tb = b && b.timestamp ? b.timestamp : '';
    if (ta === tb) return 0;
    return ta > tb ? -1 : 1;
  });
}

function logAction(actionType, details) {
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const userName = getCurrentUserName();
  
  db.auditLogs.unshift({
    user: userName,
    actionType: actionType,
    details: details,
    timestamp: timestamp
  });
  
  if (db.auditLogs.length > 100) db.auditLogs.pop();
  saveToLocalStorage();
  
  syncWithAppsScript('addAuditLog', { user: userName, actionType, details, timestamp });
}

function applyCompanyBranding() {
  const name = db.settings.companyName || 'شركة SKY';
  const logo = db.settings.companyLogo || '';

  document.getElementById('company-name-display').textContent = name;
  document.getElementById('header-company-subtitle').textContent = `تتابع الآن لوحة التحكم المالية الموحدة والرقابة الإدارية الذكية لمبيعات التقسيط وحسابات الأمانة لدى ${name}.`;
  document.title = `${name} - نظام إدارة الأقساط والخزينة المتكامل`;

  const mobileNameEl = document.getElementById('mobile-company-name');
  if (mobileNameEl) mobileNameEl.textContent = name;

  const logoIcon = document.getElementById('company-logo-icon');
  const logoImg = document.getElementById('company-logo-img');
  
  if (logo) {
    logoIcon.classList.add('hidden');
    logoImg.src = logo;
    logoImg.classList.remove('hidden');
  } else {
    logoIcon.classList.remove('hidden');
    logoImg.classList.add('hidden');
  }
}

// Show/hide mobile topbar based on screen size
function handleMobileTopbar() {
  const topbar = document.getElementById('mobile-topbar');
  if (!topbar) return;
  // ميظهرش شريط الموبايل العلوي خالص لو لسه واقفين على شاشة التحقق من الجلسة
  // أو شاشة تسجيل الدخول - عشان ميبانش "بايظ" أو ظاهر تحت شاشة الدخول
  const sessionOverlay = document.getElementById('session-check-overlay');
  const loginOverlay = document.getElementById('login-overlay');
  const stillOnAuthScreen = (sessionOverlay && !sessionOverlay.classList.contains('hidden')) ||
                             (loginOverlay && !loginOverlay.classList.contains('hidden'));
  if (stillOnAuthScreen) {
    topbar.style.display = 'none';
    return;
  }
  if (window.innerWidth < 769) {
    topbar.style.display = 'flex';
  } else {
    topbar.style.display = 'none';
    closeMobileSidebar && closeMobileSidebar();
  }
}
window.addEventListener('resize', handleMobileTopbar);


// ================= BACKEND FIREBASE SYNC =================
async function syncWithAppsScript(action, payload = {}) {
  // If Firebase is available, sync to Firestore
  if (window.FirebaseService && window.FirebaseService.isAvailable()) {
    const result = await window.FirebaseService.syncAction(action, payload);
    // لو الحفظ الفعلي في Firestore فشل (صلاحيات Rules، اتصال، إلخ)، العملية
    // كانت بتفضل ظاهرة محلياً بس بتختفي بعد أي Refresh لأنها فعلياً معملتش
    // Save على السيرفر. دلوقتي بننبّه المستخدم فوراً بدل الصمت.
    if (!result.success) {
      console.error(`فشل حفظ العملية "${action}" في Firebase:`, result.error || result.reason);
      showSyncFailureWarning(action, result.error || result.reason);
    }
    return result;
  }
  return { success: true, offline: true };
}

// تنبيه مرئي عند فشل أي عملية مزامنة فعلياً مع Firestore
function showSyncFailureWarning(action, errorDetail) {
  const headerBadge = document.getElementById('header-sync-badge');
  if (headerBadge) {
    headerBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span><span>فشل حفظ آخر عملية! ⚠️</span>`;
    headerBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 bg-rose-50 text-rose-700 border border-rose-200';
    headerBadge.title = `فشلت عملية "${action}": ${errorDetail || 'خطأ غير معروف'}. البيانات ظاهرة عندك حالياً لكنها لسه ما اتحفظتش فعلياً في قاعدة البيانات، وممكن تختفي لو عملت Refresh. تأكد من صلاحيات Firestore واتصال الإنترنت.`;
  }
  console.warn(`⚠️ تنبيه: عملية "${action}" ظاهرة عندك محلياً بس ما اتحفظتش في Firestore. لو عملت Refresh دلوقتي ممكن تضيع.`);
}

async function loadFromServer() {
  const statusMsg = document.getElementById('connection-status-msg');
  if (statusMsg) statusMsg.innerHTML = '<span class="text-teal-600">جاري تحميل البيانات من السحابة...</span>';

  // Use Firebase if initialized
  if (window.FirebaseService && window.FirebaseService.isAvailable()) {
    try {
      const fbData = await window.FirebaseService.loadAllData();
      if (fbData) {
        db.clients = fbData.clients || [];
        db.inventory = fbData.inventory || [];
        db.contracts = fbData.contracts || [];
        db.installments = fbData.installments || [];
        db.collectorCustodies = fbData.collectorCustodies || [];
        db.treasuryTransactions = sortByTimestampDesc(fbData.treasuryTransactions || []);
        db.users = fbData.users || [];
        db.auditLogs = sortByTimestampDesc(fbData.auditLogs || []);
        db.investors = fbData.investors || [];
        if (fbData.settings) {
          db.settings = { ...db.settings, ...fbData.settings };
        }
        
        saveToLocalStorage();
        renderAllTabs();
        
        if (statusMsg) statusMsg.innerHTML = '<span class="text-emerald-600">تمت المزامنة بنجاح (Firebase)!</span>';
        updateSyncStatusUI();
        return;
      }
    } catch (e) {
      console.error("Firebase load error", e);
    }
  }

  if (statusMsg) statusMsg.innerHTML = '<span class="text-amber-600">النظام يعمل بالوضع المحلي.</span>';
  updateSyncStatusUI();
}


function updateSyncStatusUI() {
  const headerBadge = document.getElementById('header-sync-badge');
  const settingsBadge = document.getElementById('sync-status-badge');
  
  const isFirebaseAvailable = window.FirebaseService && window.FirebaseService.isAvailable();
  const isOffline = db.settings.offlineMode && !isFirebaseAvailable;
  
  let text = '';
  let badgeClass = '';
  let icon = '';
  
  if (isOffline) {
    text = 'وضع محاكاة أوفلاين ⚠️';
    badgeClass = 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/55';
    icon = '<i class="ph ph-warning animate-pulse"></i>';
  } else if (isFirebaseAvailable) {
    text = 'متصل بقاعدة Firebase سحابياً 🟢';
    badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/55';
    icon = '<span class="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>';
  } else {
    text = 'متصل بالخادم المحلي 🟢';
    badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/55';
    icon = '<span class="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>';
  }
  
  if (headerBadge) {
    headerBadge.innerHTML = `${icon}<span>${text}</span>`;
    headerBadge.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${badgeClass}`;
  }
  
  if (settingsBadge) {
    settingsBadge.innerHTML = `${icon}<span>${text}</span>`;
    settingsBadge.className = `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${badgeClass}`;
  }
}

// ================= DYNAMIC CALCULATIONS (OVERDUE FINES) =================
function calculateFinesForInstallment(inst, contract) {
  if (inst.status === 'paid') return inst.delayFines || 0;
  
  const today = new Date();
  const due = new Date(inst.dueDate);
  const diffTime = today - due;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= contract.graceDays) {
    return 0;
  }
  
  if (contract.fineType === 'flat') {
    return diffDays * contract.fineValue;
  } else if (contract.fineType === 'percent') {
    return parseFloat((inst.amount * (contract.fineValue / 100) * diffDays).toFixed(2));
  }
  return 0;
}

function getInstallmentOverdueStatus(inst) {
  const contract = db.contracts.find(c => c.id === inst.contractId);
  if (!contract) return { statusText: 'خطأ بالعقد', overdueDays: 0, fine: 0, totalDue: inst.amount, statusColor: 'badge-danger' };

  if (inst.status === 'paid') {
    return {
      statusText: 'تم السداد',
      overdueDays: 0,
      fine: inst.delayFines || 0,
      totalDue: inst.amount,
      statusColor: 'badge-success'
    };
  }

  const today = new Date();
  const due = new Date(inst.dueDate);
  const diffTime = today - due;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return {
      statusText: 'بالانتظار موعد الاستحقاق',
      overdueDays: 0,
      fine: 0,
      totalDue: inst.amount,
      statusColor: 'badge-info'
    };
  }

  const fine = calculateFinesForInstallment(inst, contract);
  const totalDue = inst.amount + fine;

  if (diffDays <= contract.graceDays) {
    return {
      statusText: `متأخر (${diffDays} يوم) - بفترة السماح`,
      overdueDays: diffDays,
      fine: 0,
      totalDue: inst.amount,
      statusColor: 'badge-warning'
    };
  }

  return {
    statusText: `متأخر (${diffDays} يوم) - خارج السماح`,
    overdueDays: diffDays,
    fine: fine,
    totalDue: totalDue,
    statusColor: 'badge-danger'
  };
}

// ================= TAB RENDERING ENGINES =================
function renderActiveTab(tabName) {
  switch (tabName) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'clients':
      renderClients();
      break;
    case 'client-balances':
      renderClientBalances();
      break;
    case 'inventory':
      renderInventory();
      break;
    case 'contracts':
      renderContracts();
      break;
    case 'collections':
      renderCollections();
      break;
    case 'treasury':
      renderTreasury();
      break;
    case 'investors':
      renderInvestors();
      break;
    case 'reports':
      renderReports();
      break;
    case 'users':
      renderUsers();
      break;
    case 'settings':
      renderSettings();
      break;
  }
}

function renderAllTabs() {
  const activeTabBtn = document.querySelector('#sidebar-menu a.bg-teal-600');
  if (activeTabBtn) {
    const tabName = activeTabBtn.getAttribute('data-tab');
    renderActiveTab(tabName);
  }
  // تحديث القوائم المنسدلة في نماذج الإضافة دائماً عند وصول بيانات جديدة
  populateDropdowns();
}


// --- 1. DASHBOARD ---
let financialChartInstance = null;

function renderDashboard() {
  const totalTreasury = db.treasuryTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  document.getElementById('kpi-treasury-balance').textContent = `${totalTreasury.toLocaleString()} ج.م`;
  
  const directSales = db.treasuryTransactions.filter(tx => tx.type === 'cash_sale').reduce((sum, tx) => sum + tx.amount, 0);
  const contractSales = db.contracts.reduce((sum, c) => sum + c.totalValue, 0);
  const totalSales = directSales + contractSales;
  document.getElementById('kpi-total-sales').textContent = `${totalSales.toLocaleString()} ج.م`;

  const activeCollections = db.treasuryTransactions.filter(tx => tx.type === 'collection').reduce((sum, tx) => sum + tx.amount, 0);
  document.getElementById('kpi-active-collections').textContent = `${activeCollections.toLocaleString()} ج.م`;

  const totalExpenses = Math.abs(db.treasuryTransactions.filter(tx => tx.type === 'expense' || tx.type === 'inventory_purchase').reduce((sum, tx) => sum + tx.amount, 0));
  document.getElementById('kpi-total-expenses').textContent = `${totalExpenses.toLocaleString()} ج.م`;

  let totalOverdueVal = 0;
  let overdueCount = 0;
  db.installments.forEach(inst => {
    if (inst.status !== 'paid') {
      const stats = getInstallmentOverdueStatus(inst);
      if (stats.overdueDays > 0) {
        totalOverdueVal += stats.totalDue;
        overdueCount++;
      }
    }
  });
  document.getElementById('kpi-overdue-installments').textContent = `${totalOverdueVal.toLocaleString()} ج.م`;
  
  const overdueContainer = document.getElementById('kpi-overdue-container');
  const overdueAlertText = document.getElementById('kpi-overdue-alert-text');
  const overdueIconBg = document.getElementById('kpi-overdue-icon-bg');
  
  if (totalOverdueVal > 0) {
    overdueContainer.classList.add('border-red-400', 'bg-red-50/20');
    overdueIconBg.className = 'p-3 bg-red-100 text-red-600 rounded-xl animate-pulse-warning';
    overdueAlertText.innerHTML = `<span class="flex items-center gap-1"><i class="ph ph-warning"></i> يوجد عدد ${overdueCount} قسط متأخر بالذمة</span>`;
  } else {
    overdueContainer.classList.remove('border-red-400', 'bg-red-50/20');
    overdueIconBg.className = 'p-3 bg-amber-50 text-amber-500 rounded-xl';
    overdueAlertText.innerHTML = `<span>كل الأقساط منتظمة بالكامل</span>`;
  }

  const inventoryCapital = db.inventory.filter(dev => dev.status === 'available').reduce((sum, dev) => sum + dev.costPrice, 0);
  document.getElementById('kpi-inventory-capital').textContent = `${inventoryCapital.toLocaleString()} ج.م`;

  const totalRemainingContractBalance = db.installments.filter(inst => inst.status !== 'paid').reduce((sum, inst) => sum + inst.amount, 0);
  document.getElementById('kpi-expected-profits').textContent = `${totalRemainingContractBalance.toLocaleString()} ج.م`;

  const totalInsts = db.installments.length;
  const badDebtRate = totalInsts > 0 ? Math.round((overdueCount / totalInsts) * 100) : 0;
  document.getElementById('kpi-bad-debt-rate').textContent = `${badDebtRate}%`;
  document.getElementById('kpi-bad-debt-bar').style.width = `${badDebtRate}%`;

  const timeline = document.getElementById('dashboard-audit-timeline');
  timeline.innerHTML = '';
  sortByTimestampDesc(db.auditLogs).slice(0, 5).forEach(log => {
    let colorClass = 'bg-slate-200 text-slate-800';
    if (log.actionType.includes('إضافة') || log.actionType.includes('شراء')) colorClass = 'bg-teal-50 text-teal-700 border border-teal-100';
    if (log.actionType.includes('إنشاء') || log.actionType.includes('بيع') || log.actionType.includes('تعديل')) colorClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
    if (log.actionType.includes('تحصيل') || log.actionType.includes('اعتماد')) colorClass = 'bg-blue-50 text-blue-700 border border-blue-100';
    if (log.actionType.includes('صرف')) colorClass = 'bg-rose-50 text-rose-700 border border-rose-100';

    const item = document.createElement('div');
    item.className = 'relative timeline-item flex gap-4 pr-6 pb-4';
    item.innerHTML = `
      <div class="absolute right-[9px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-400 z-10"></div>
      <div class="flex-1">
        <div class="flex justify-between items-start">
          <span class="text-xs font-semibold ${colorClass} px-2 py-0.5 rounded">${escapeHTML(log.actionType)}</span>
          <span class="text-[10px] text-slate-400 font-mono">${escapeHTML(log.timestamp)}</span>
        </div>
        <p class="text-xs text-slate-600 mt-1.5"><span class="font-bold text-slate-700">${escapeHTML(log.user)}</span>: ${escapeHTML(log.details)}</p>
      </div>
    `;
    timeline.appendChild(item);
  });

  const canvas = document.getElementById('financialTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (financialChartInstance) {
    financialChartInstance.destroy();
  }

  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'];
  const salesData = [120000, 150000, 180000, 220000, 260000, totalSales];
  const collectionData = [80000, 110000, 130000, 160000, 200000, activeCollections];

  if (typeof Chart !== 'undefined') {
    // نضبط ألوان الشبكة والنصوص حسب الوضع الحالي (ليلي/نهاري) عشان الرسم
    // البياني يفضل واضح ومقروء في الحالتين، بدل ما يفضل بألوان النهار
    // الفاتحة فوق خلفية داكنة.
    const isDarkMode = document.documentElement.classList.contains('dark');
    const gridColor = isDarkMode ? 'rgba(148, 163, 184, 0.12)' : '#f1f5f9';
    const tickColor = isDarkMode ? '#a6b2c5' : '#64748b';

    financialChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'إجمالي المبيعات',
            data: salesData,
            backgroundColor: isDarkMode ? 'rgba(129, 140, 248, 0.9)' : 'rgba(79, 70, 229, 0.85)',
            borderRadius: 8,
            borderWidth: 0,
            barPercentage: 0.6
          },
          {
            label: 'إجمالي التحصيلات الفعالة',
            data: collectionData,
            backgroundColor: isDarkMode ? 'rgba(45, 212, 191, 0.9)' : 'rgba(16, 185, 129, 0.85)',
            borderRadius: 8,
            borderWidth: 0,
            barPercentage: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Cairo', size: 11 }, color: tickColor }
          },
          y: {
            grid: { color: gridColor },
            ticks: { font: { family: 'Cairo', size: 10 }, color: tickColor }
          }
        }
      }
    });
  } else {
    console.warn("Chart.js is not loaded. Skipping chart rendering.");
  }
}

// --- 2. CLIENTS & GUARANTORS ---
function renderClients() {
  const searchVal = document.getElementById('client-search-input').value.toLowerCase();
  const tbody = document.getElementById('clients-table-body');
  const emptyState = document.getElementById('clients-empty-state');
  
  tbody.innerHTML = '';
  
  const filtered = db.clients.filter(c => 
    c.name.toLowerCase().includes(searchVal) || 
    c.nationalId.includes(searchVal) || 
    c.phone.includes(searchVal)
  );

  document.getElementById('total-clients-count').textContent = db.clients.length;

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors';
    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-800">${escapeHTML(c.name)}</td>
      <td class="p-4 text-slate-500 font-mono">${escapeHTML(c.nationalId)}</td>
      <td class="p-4 font-mono">${escapeHTML(c.phone)}</td>
      <td class="p-4 text-slate-800">${escapeHTML(c.guarantorName) || '-'}</td>
      <td class="p-4 text-slate-500">${escapeHTML(c.guarantorRelation) || '-'}</td>
      <td class="p-4">
        ${c.locationUrl && /^https?:\/\//i.test(c.locationUrl) ? `<a href="${escapeHTML(c.locationUrl)}" target="_blank" class="text-teal-600 hover:text-teal-800 flex items-center gap-1 text-xs font-semibold"><i class="ph ph-map-pin-line"></i> عرض الخريطة</a>` : '<span class="text-slate-400">لا يوجد</span>'}
      </td>
      <td class="p-4 text-center">
        <div class="inline-flex gap-1.5">
          <button onclick="viewClientDetails('${c.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition-all">الملف الكامل</button>
          <button onclick="editClient('${c.id}')" class="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-md text-xs font-semibold transition-all flex items-center gap-1"><i class="ph ph-note-pencil"></i> تعديل</button>
          <button onclick="deleteClient('${c.id}')" class="p-1 text-rose-500 hover:bg-rose-50 rounded-md text-xs transition-all"><i class="ph ph-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// بيحسب رصيد عقد واحد: كام اتحصّل (شامل المقدم) وكام متبقي وعدد الأقساط المسددة
function computeContractBalance(contract) {
  const contractInsts = db.installments.filter(i => i.contractId === contract.id);
  const paidInsts = contractInsts.filter(i => i.status === 'paid');
  const paidFromInstallments = paidInsts.reduce((sum, i) => sum + (i.paidAmount || i.amount || 0), 0);
  const totalPaid = (contract.downPayment || 0) + paidFromInstallments;
  const totalRemaining = Math.max(0, (contract.totalValue || 0) - totalPaid);

  return {
    totalValue: contract.totalValue || 0,
    totalPaid,
    totalRemaining,
    installmentsPaid: paidInsts.length,
    installmentsTotal: contractInsts.length
  };
}

// بيحسب رصيد العميل الكامل مجمّع من كل عقوده (كل الأجهزة اللي واخدها)
function computeClientBalance(clientId) {
  const clientContracts = db.contracts.filter(c => c.clientId === clientId);
  const devices = clientContracts.map(c => ({ contract: c, balance: computeContractBalance(c) }));

  const totals = devices.reduce((acc, d) => {
    acc.totalValue += d.balance.totalValue;
    acc.totalPaid += d.balance.totalPaid;
    acc.totalRemaining += d.balance.totalRemaining;
    return acc;
  }, { totalValue: 0, totalPaid: 0, totalRemaining: 0 });

  return { devices, totals };
}

let expandedBalanceClients = new Set();
window.toggleClientBalanceRow = function(clientId) {
  if (expandedBalanceClients.has(clientId)) {
    expandedBalanceClients.delete(clientId);
  } else {
    expandedBalanceClients.add(clientId);
  }
  renderClientBalances();
};

function renderClientBalances() {
  const searchVal = (document.getElementById('balance-search-input').value || '').toLowerCase();
  const listContainer = document.getElementById('client-balances-list');
  const emptyState = document.getElementById('balances-empty-state');
  listContainer.innerHTML = '';

  const clientsWithContracts = db.clients.filter(c => db.contracts.some(ct => ct.clientId === c.id));
  const filtered = clientsWithContracts.filter(c =>
    c.name.toLowerCase().includes(searchVal) || (c.phone || '').includes(searchVal)
  );

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    document.getElementById('balance-summary-total').textContent = '0';
    document.getElementById('balance-summary-paid').textContent = '0';
    document.getElementById('balance-summary-remaining').textContent = '0';
    return;
  }
  emptyState.classList.add('hidden');

  let grandTotal = 0, grandPaid = 0, grandRemaining = 0;

  filtered.forEach(client => {
    const { devices, totals } = computeClientBalance(client.id);
    grandTotal += totals.totalValue;
    grandPaid += totals.totalPaid;
    grandRemaining += totals.totalRemaining;

    const progressPct = totals.totalValue > 0 ? Math.round((totals.totalPaid / totals.totalValue) * 100) : 0;
    const isExpanded = expandedBalanceClients.has(client.id);

    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden';
    card.innerHTML = `
      <div onclick="toggleClientBalanceRow('${client.id}')" class="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors select-none">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-sm">
            <i class="ph ${isExpanded ? 'ph-folder-open' : 'ph-folder'} text-lg"></i>
          </div>
          <div>
            <h4 class="font-bold text-slate-800 text-md">${escapeHTML(client.name)}</h4>
            <p class="text-xs text-slate-400 font-mono mt-0.5">هاتف: ${escapeHTML(client.phone)} | عدد الأجهزة: ${devices.length}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div class="bg-slate-100 text-slate-700 py-1.5 px-3 rounded-lg">إجمالي: <span class="font-black text-sm">${totals.totalValue.toLocaleString()} ج.م</span></div>
          <div class="bg-emerald-50 text-emerald-700 py-1.5 px-3 rounded-lg">تم تحصيله: <span class="font-black text-sm">${totals.totalPaid.toLocaleString()} ج.م</span></div>
          <div class="bg-amber-50 text-amber-700 py-1.5 px-3 rounded-lg">المتبقي: <span class="font-black text-sm">${totals.totalRemaining.toLocaleString()} ج.م</span></div>
          <div class="w-24 hidden sm:block">
            <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500" style="width:${progressPct}%"></div>
            </div>
            <p class="text-[10px] text-slate-400 mt-0.5 text-center">${progressPct}% مسدد</p>
          </div>
          <i class="ph ${isExpanded ? 'ph-caret-up' : 'ph-caret-down'} text-slate-400 text-sm ml-2"></i>
        </div>
      </div>

      <div class="${isExpanded ? '' : 'hidden'} border-t border-slate-100 p-4 bg-white space-y-2">
        <div class="overflow-x-auto">
          <table class="w-full text-right border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <th class="p-2.5">الجهاز</th>
                <th class="p-2.5">رقم العقد</th>
                <th class="p-2.5">قيمة العقد</th>
                <th class="p-2.5">تم تحصيله</th>
                <th class="p-2.5">المتبقي</th>
                <th class="p-2.5">الأقساط المنجزة</th>
                <th class="p-2.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${devices.map(d => `
                <tr>
                  <td class="p-2.5 font-bold">${escapeHTML(d.contract.deviceInfo)}</td>
                  <td class="p-2.5 font-mono text-slate-500">${escapeHTML(d.contract.id.replace('con-', ''))}</td>
                  <td class="p-2.5 font-mono font-bold">${d.balance.totalValue.toLocaleString()} ج.م</td>
                  <td class="p-2.5 font-mono text-emerald-600 font-bold">${d.balance.totalPaid.toLocaleString()} ج.م</td>
                  <td class="p-2.5 font-mono text-amber-600 font-bold">${d.balance.totalRemaining.toLocaleString()} ج.م</td>
                  <td class="p-2.5 font-mono">${d.balance.installmentsPaid} / ${d.balance.installmentsTotal}</td>
                  <td class="p-2.5 text-center">
                    <button onclick="viewContractDetails('${d.contract.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-semibold transition-all">تفاصيل العقد</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    listContainer.appendChild(card);
  });

  document.getElementById('balance-summary-total').textContent = grandTotal.toLocaleString();
  document.getElementById('balance-summary-paid').textContent = grandPaid.toLocaleString();
  document.getElementById('balance-summary-remaining').textContent = grandRemaining.toLocaleString();
}

document.getElementById('balance-search-input').addEventListener('input', renderClientBalances);

// --- 3. INVENTORY & DEVICES ---
function renderInventory() {
  const searchVal = document.getElementById('inventory-search').value.toLowerCase();
  const tbody = document.getElementById('inventory-table-body');
  const emptyState = document.getElementById('inventory-empty-state');
  
  tbody.innerHTML = '';
  
  document.getElementById('inv-suppliers-count').textContent = db.suppliers.length;
  document.getElementById('inv-total-count').textContent = [...new Set(db.inventory.map(d => `${d.brand}_${d.name}`))].length;
  document.getElementById('inv-available-count').textContent = db.inventory.filter(d => d.status === 'available').length;
  document.getElementById('inv-sold-count').textContent = db.inventory.filter(d => d.status.startsWith('sold')).length;

  const grouped = {};
  db.inventory.forEach(dev => {
    const key = `${dev.brand}_${dev.name}_${dev.costPrice}_${dev.sellingPrice}_${dev.supplier}`;
    if (!grouped[key]) {
      grouped[key] = {
        brand: dev.brand,
        name: dev.name,
        costPrice: dev.costPrice,
        sellingPrice: dev.sellingPrice,
        supplier: dev.supplier,
        devices: []
      };
    }
    grouped[key].devices.push(dev);
  });

  const groupedList = Object.values(grouped).filter(group => {
    return group.name.toLowerCase().includes(searchVal) || group.brand.toLowerCase().includes(searchVal);
  });

  if (groupedList.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  groupedList.forEach(group => {
    const totalQty = group.devices.length;
    const availQty = group.devices.filter(d => d.status === 'available').length;
    
    const serialBadges = group.devices.map(d => {
      let bg = 'bg-slate-100 text-slate-600';
      let title = 'متاح';
      if (d.status === 'sold_installment') {
        bg = 'bg-teal-50 text-teal-700 border border-teal-100';
        title = `قسط لـ: ${d.soldTo}`;
      } else if (d.status === 'sold_cash') {
        bg = 'bg-amber-50 text-amber-700 border border-amber-100';
        title = `كاش لـ: ${d.soldTo}`;
      }
      return `<span class="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded ${bg} m-0.5" title="${escapeHTML(title)}">${escapeHTML(d.serial)}</span>`;
    }).join(' ');

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors';
    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-800">${escapeHTML(group.brand)}</td>
      <td class="p-4">${escapeHTML(group.name)}</td>
      <td class="p-4 text-slate-600 text-xs">${escapeHTML(group.supplier) || '-'}</td>
      <td class="p-4 font-bold font-mono text-emerald-600">${group.costPrice.toLocaleString()} ج.م</td>
      <td class="p-4 font-bold font-mono text-teal-600">${group.sellingPrice.toLocaleString()} ج.م</td>
      <td class="p-4">
        <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-800 text-xs font-bold">
          ${availQty} متاح / ${totalQty} كلي
        </span>
      </td>
      <td class="p-4 max-w-xs overflow-hidden">${serialBadges}</td>
      <td class="p-4 text-center">
        <div class="inline-flex gap-1.5">
          ${availQty > 0 ? `
            <button data-brand="${escapeHTML(group.brand)}" data-name="${escapeHTML(group.name)}" onclick="openCashSaleModalGrouped(this.dataset.brand, this.dataset.name)" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition-all flex items-center gap-1">
              <i class="ph ph-money"></i> بيع كاش
            </button>
          ` : `<span class="text-xs text-slate-400 font-semibold">نفذت الكمية</span>`}
          <button data-brand="${escapeHTML(group.brand)}" data-name="${escapeHTML(group.name)}" onclick="editDeviceGroup(this.dataset.brand, this.dataset.name)" class="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-md text-xs font-semibold transition-all flex items-center gap-1"><i class="ph ph-note-pencil"></i> تعديل</button>
          <button data-brand="${escapeHTML(group.brand)}" data-name="${escapeHTML(group.name)}" onclick="deleteDeviceGroup(this.dataset.brand, this.dataset.name)" class="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"><i class="ph ph-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Cash Sale Modal for grouped items
window.openCashSaleModalGrouped = function(brand, name) {
  const availableDevices = db.inventory.filter(d => d.brand === brand && d.name === name && d.status === 'available');
  if (availableDevices.length === 0) return;

  const infoEl = document.getElementById('cash-sale-device-info');
  infoEl.innerHTML = `
    <div class="space-y-2">
      <p>الجهاز: <strong>${escapeHTML(brand)} ${escapeHTML(name)}</strong></p>
      <div>
        <label class="form-label text-xs">اختر الرقم التسلسلي (سيريال) المراد بيعه:</label>
        <select id="cash-sale-serial-select" class="form-input text-xs py-1">
          ${availableDevices.map(d => `<option value="${d.id}">${escapeHTML(d.serial)}</option>`).join('')}
        </select>
      </div>
    </div>
  `;

  document.getElementById('cash-sale-brand-model').value = `${brand} ${name}`;
  document.getElementById('cash-sale-price').value = availableDevices[0].sellingPrice;
  openModal('cash-sale-modal');
};

window.deleteDeviceGroup = async function(brand, name) {
  if (!isAdmin()) {
    alert('⛔ حذف المخزون مخصص للمشرف (ADMIN) فقط.');
    return;
  }
  if (await customConfirm(`هل أنت متأكد من حذف جميع القطع المتاحة من (${brand} ${name}) بالمخزن؟`)) {
    const beforeCount = db.inventory.length;
    db.inventory = db.inventory.filter(d => !(d.brand === brand && d.name === name && d.status === 'available'));
    const afterCount = db.inventory.length;
    const deletedCount = beforeCount - afterCount;
    
    saveToLocalStorage();
    logAction('حذف كمية أجهزة', `تم حذف عدد ${deletedCount} قطعة من صنف ${brand} ${name} من المخزون`);
    
    await syncWithAppsScript('deleteDeviceGroup', { brand, name });
    
    renderInventory();
    renderDashboard();
  }
};

window.editDeviceGroup = function(brand, name) {
  if (!isAdmin()) {
    alert('⛔ تعديل المخزون مخصص للمشرف (ADMIN) فقط.');
    return;
  }
  const sampleDev = db.inventory.find(d => d.brand === brand && d.name === name);
  if (!sampleDev) return;

  document.getElementById('edit-inv-brand').value = brand;
  document.getElementById('edit-inv-name').value = name;
  document.getElementById('edit-inv-cost').value = sampleDev.costPrice;
  document.getElementById('edit-inv-price').value = sampleDev.sellingPrice;
  document.getElementById('edit-inv-supplier').value = sampleDev.supplier || '';
  openModal('edit-inventory-modal');
};

window.saveInventoryEdit = async function() {
  if (!isAdmin()) return;
  const brand = document.getElementById('edit-inv-brand').value;
  const name = document.getElementById('edit-inv-name').value;
  const newCost = parseFloat(document.getElementById('edit-inv-cost').value) || 0;
  const newPrice = parseFloat(document.getElementById('edit-inv-price').value) || 0;
  const newSupplier = document.getElementById('edit-inv-supplier').value.trim();

  db.inventory.forEach(d => {
    if (d.brand === brand && d.name === name) {
      d.costPrice = newCost;
      d.sellingPrice = newPrice;
      d.supplier = newSupplier;
    }
  });

  saveToLocalStorage();
  logAction('تعديل مخزون', `تعديل أسعار صنف ${brand} ${name}: تكلفة ${newCost} ج.م، بيع ${newPrice} ج.م`);
  
  await syncWithAppsScript('updateDeviceGroup', { brand, name, costPrice: newCost, sellingPrice: newPrice, supplier: newSupplier });
  
  closeModal('edit-inventory-modal');
  renderInventory();
  renderDashboard();
};

// --- 4. CONTRACTS & SALES ---
function renderContracts() {
  const searchVal = document.getElementById('contract-search-input').value.toLowerCase();
  const tbody = document.getElementById('contracts-table-body');
  const emptyState = document.getElementById('contracts-empty-state');
  
  tbody.innerHTML = '';
  
  const filtered = db.contracts.filter(c => 
    c.clientName.toLowerCase().includes(searchVal) || 
    c.id.includes(searchVal)
  );

  document.getElementById('total-contracts-count').textContent = db.contracts.length;

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(c => {
    const contractInsts = db.installments.filter(inst => inst.contractId === c.id);
    const paidVal = contractInsts.filter(inst => inst.status === 'paid').reduce((sum, inst) => sum + inst.amount, 0);
    const totalInstsAmount = contractInsts.reduce((sum, inst) => sum + inst.amount, 0);
    
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors text-xs sm:text-sm';
    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-700 font-mono">${escapeHTML(c.id.replace('con-', ''))}</td>
      <td class="p-4 font-bold text-slate-800">${escapeHTML(c.clientName)}</td>
      <td class="p-4 font-mono text-slate-500">${escapeHTML(c.clientPhone)}</td>
      <td class="p-4 font-semibold text-slate-600">${escapeHTML(c.collectorName) || 'غير مسند'}</td>
      <td class="p-4 text-slate-600">${escapeHTML(c.deviceInfo)}</td>
      <td class="p-4 font-bold font-mono text-slate-800">${c.totalValue.toLocaleString()} ج.م</td>
      <td class="p-4 font-bold font-mono text-teal-600">${c.monthlyInstallment.toLocaleString()} ج.م</td>
      <td class="p-4 font-mono text-xs text-slate-500">${c.startDate}</td>
      <td class="p-4">
        <div class="flex flex-col gap-1">
          <span class="font-bold font-mono text-xs text-slate-700">${paidVal.toLocaleString()} / ${totalInstsAmount.toLocaleString()} ج.م</span>
          <div class="w-24 bg-slate-100 rounded-full h-1 overflow-hidden">
            <div class="bg-teal-600 h-1" style="width: ${(paidVal/totalInstsAmount * 100) || 0}%"></div>
          </div>
        </div>
      </td>
      <td class="p-4 text-center">
         <div class="inline-flex gap-1.5">
           <button onclick="viewContractDetails('${c.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition-all">التفاصيل</button>
           <button onclick="editContract('${c.id}')" class="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-md text-xs font-semibold flex items-center gap-1"><i class="ph ph-pencil-simple"></i></button>
           <button onclick="deleteContract('${c.id}')" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md text-xs font-semibold flex items-center gap-1"><i class="ph ph-trash"></i></button>
         </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- 5. COLLECTIONS ---
function renderCollections() {
  const searchVal = document.getElementById('collection-search-input').value.toLowerCase();
  const monthFilter = document.getElementById('collection-filter-month').value;
  const statusFilter = document.getElementById('collection-filter-status').value;
  const cardsList = document.getElementById('collections-cards-list');
  const emptyState = document.getElementById('collections-empty-state');
  
  cardsList.innerHTML = '';
  
  const filteredInstallments = db.installments.filter(inst => {
    const matchesSearch = inst.clientName.toLowerCase().includes(searchVal) || inst.clientPhone.includes(searchVal) || inst.contractId.includes(searchVal);
    const instMonth = inst.dueDate.substring(0, 7);
    const matchesMonth = monthFilter === 'all' ? true : instMonth === monthFilter;
    
    const statusInfo = getInstallmentOverdueStatus(inst);
    let matchesStatus = true;
    if (statusFilter === 'paid') {
      matchesStatus = inst.status === 'paid';
    } else if (statusFilter === 'overdue') {
      matchesStatus = inst.status !== 'paid' && statusInfo.overdueDays > 0;
    } else if (statusFilter === 'pending') {
      matchesStatus = inst.status !== 'paid' && statusInfo.overdueDays === 0;
    }
    
    return matchesSearch && matchesMonth && matchesStatus;
  });

  if (filteredInstallments.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const groupedByClient = {};
  filteredInstallments.forEach(inst => {
    const contract = db.contracts.find(c => c.id === inst.contractId);
    const clientId = contract?.clientId || 'unknown';
    if (!groupedByClient[clientId]) {
      groupedByClient[clientId] = {
        clientId: clientId,
        clientName: inst.clientName,
        clientPhone: inst.clientPhone,
        guarantorName: inst.guarantorName,
        guarantorPhone: inst.guarantorPhone,
        installments: []
      };
    }
    groupedByClient[clientId].installments.push(inst);
  });

  Object.values(groupedByClient).forEach(clientGroup => {
    const client = db.clients.find(c => c.id === clientGroup.clientId);
    const totalRemaining = clientGroup.installments.filter(i => i.status !== 'paid').reduce((sum, i) => {
      const stats = getInstallmentOverdueStatus(i);
      return sum + stats.totalDue;
    }, 0);
    const totalInsts = clientGroup.installments.length;
    const paidCount = clientGroup.installments.filter(i => i.status === 'paid').length;
    
    const isExpanded = expandedClients.has(clientGroup.clientId);
    
    const clientCard = document.createElement('div');
    clientCard.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-200';
    
    clientCard.innerHTML = `
      <div onclick="toggleClientInstallments('${clientGroup.clientId}')" class="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors select-none">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-sm">
            <i class="ph ${isExpanded ? 'ph-folder-open' : 'ph-folder'} text-lg"></i>
          </div>
          <div>
            <h4 class="font-bold text-slate-800 text-md">${escapeHTML(clientGroup.clientName)}</h4>
            <p class="text-xs text-slate-400 font-mono mt-0.5">${escapeHTML(client?.address) || 'البحيرة'} | هاتف: ${escapeHTML(clientGroup.clientPhone)}</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4 text-xs font-semibold">
          <div class="text-slate-500">
            الضامن: <span class="font-bold text-slate-700">${escapeHTML(clientGroup.guarantorName) || 'لا يوجد'}</span> 
            ${clientGroup.guarantorPhone ? `<span class="font-mono font-medium text-slate-500">(${escapeHTML(clientGroup.guarantorPhone)})</span>` : ''}
          </div>
          <div class="bg-teal-50 text-teal-700 py-1.5 px-3 rounded-lg">
            إجمالي المستحق حالياً: <span class="font-black text-sm">${totalRemaining.toLocaleString()} ج.م</span>
          </div>
          <div class="bg-slate-100 text-slate-700 py-1.5 px-2.5 rounded-lg font-mono">
            الأقساط المنجزة: ${paidCount} / ${totalInsts}
          </div>
          <i class="ph ${isExpanded ? 'ph-caret-up' : 'ph-caret-down'} text-slate-400 text-sm ml-2"></i>
        </div>
      </div>

      <div class="${isExpanded ? '' : 'hidden'} border-t border-slate-100 p-4 bg-white space-y-3">
        <div class="overflow-x-auto">
          <table class="w-full text-right border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <th class="p-2.5">رقم الدفعة</th>
                <th class="p-2.5">الجهاز</th>
                <th class="p-2.5">تاريخ الاستحقاق</th>
                <th class="p-2.5">القسط الأساسي</th>
                <th class="p-2.5">الحالة والتأخير</th>
                <th class="p-2.5">المحصل المسند</th>
                <th class="p-2.5">المبلغ المطلوب</th>
                <th class="p-2.5 text-center">إجراءات المراسلة والتواصل</th>
                <th class="p-2.5 text-center">التحصيل</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-slate-700">
              ${clientGroup.installments.map(inst => {
                const statusInfo = getInstallmentOverdueStatus(inst);
                const instContract = db.contracts.find(c => c.id === inst.contractId);
                
                let collectorOptions = db.users
                  .filter(u => u.role === 'COLLECTOR')
                  .map(u => `<option value="${escapeHTML(u.name)}" ${inst.collectorName === u.name ? 'selected' : ''}>${escapeHTML(u.name)}</option>`)
                  .join('');

                const isCollectorDisabled = currentUser && currentUser.role === 'COLLECTOR' ? 'disabled class="form-input text-[11px] py-0.5 px-1 border-slate-200 bg-slate-50 cursor-not-allowed"' : 'class="form-input text-[11px] py-0.5 px-1 border-slate-200 bg-white"';

                return `
                  <tr>
                    <td class="p-2.5 font-bold">قسط ${inst.installmentNum}</td>
                    <td class="p-2.5 text-slate-600">${escapeHTML(instContract?.deviceInfo) || '—'}</td>
                    <td class="p-2.5 font-mono text-slate-500">${inst.dueDate}</td>
                    <td class="p-2.5 font-mono font-bold">${inst.amount.toLocaleString()} ج.م</td>
                    <td class="p-2.5"><span class="badge ${statusInfo.statusColor} font-bold">${statusInfo.statusText}</span></td>
                    <td class="p-2.5">
                      <select onchange="updateCollectorForInstallment('${inst.id}', this.value)" ${isCollectorDisabled}>
                        ${collectorOptions}
                      </select>
                    </td>
                    <td class="p-2.5 font-mono font-bold text-teal-600">
                      ${statusInfo.totalDue.toLocaleString()} ج.م
                      ${statusInfo.fine > 0 ? `<span class="text-[9px] text-red-500 block">(غرامة ${statusInfo.fine.toLocaleString()})</span>` : ''}
                    </td>
                    <td class="p-2.5 text-center">
                      <div class="inline-flex gap-1 justify-center">
                        <button onclick="openWhatsappModal('${inst.id}', 'reminder')" class="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-[10px] font-bold transition-all"><i class="ph ph-bell"></i> تذكير</button>
                        <button onclick="openWhatsappModal('${inst.id}', 'warning_client')" class="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[10px] font-bold transition-all"><i class="ph ph-warning"></i> إنذار</button>
                        <button onclick="openWhatsappModal('${inst.id}', 'receipt')" class="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-bold transition-all"><i class="ph ph-check-circle"></i> رسالة السداد</button>
                      </div>
                    </td>
                    <td class="p-2.5 text-center">
                      ${inst.status !== 'paid' ? `
                        <button onclick="collectInstallmentBtn('${inst.id}')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-[10px] transition-all"><i class="ph ph-check-square"></i> تحصيل</button>
                      ` : `
                        <div class="inline-flex items-center gap-1">
                          <span class="text-emerald-600 font-bold text-[10px]"><i class="ph ph-check mr-0.5"></i> معتمد</span>
                          <button onclick="printInstallmentReceipt('${inst.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[10px] transition-all"><i class="ph ph-printer"></i> إيصال</button>
                        </div>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    cardsList.appendChild(clientCard);
  });
}

window.toggleClientInstallments = function(clientId) {
  if (expandedClients.has(clientId)) {
    expandedClients.delete(clientId);
  } else {
    expandedClients.add(clientId);
  }
  renderCollections();
};

window.updateCollectorForInstallment = async function(instId, collectorName) {
  const inst = db.installments.find(i => i.id === instId);
  if (inst) {
    inst.collectorName = collectorName;
    saveToLocalStorage();
    logAction('تعديل محصل', `تعديل المحصل المسند للقسط رقم ${inst.installmentNum} لعقد ${inst.contractId.replace('con-', '')} إلى ${collectorName}`);
    renderCollections();
    await syncWithAppsScript('updateInstallment', inst);
  }
};

// --- 6. TREASURY & ACCOUNTS ---
function renderTreasury() {
  const tbody = document.getElementById('treasury-transactions-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const mainBalance = db.treasuryTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const pendingCustody = db.collectorCustodies.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);

  document.getElementById('treasury-balance-card').textContent = `${mainBalance.toLocaleString()} ج.م`;
  document.getElementById('treasury-pending-custody').textContent = `${pendingCustody.toLocaleString()} ج.م`;

  const approvalsBody = document.getElementById('collector-approvals-table-body');
  const approvalsEmpty = document.getElementById('collector-approvals-empty');
  approvalsBody.innerHTML = '';
  
  const pendingApprovals = db.collectorCustodies.filter(c => c.status === 'pending');
  
  if (pendingApprovals.length === 0) {
    approvalsEmpty.classList.remove('hidden');
  } else {
    approvalsEmpty.classList.add('hidden');
    pendingApprovals.forEach(app => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-colors';
      tr.innerHTML = `
        <td class="p-3 font-bold text-slate-800">${escapeHTML(app.collectorName)}</td>
        <td class="p-3 font-semibold text-slate-700">${escapeHTML(app.clientName)}</td>
        <td class="p-3 font-mono">${escapeHTML(app.contractId.replace('con-', ''))}</td>
        <td class="p-3 font-bold font-mono text-teal-600">${app.amount.toLocaleString()} ج.م</td>
        <td class="p-3 text-slate-500 font-mono text-[10px]">${app.date}</td>
        <td class="p-3 text-center">
          <div class="inline-flex gap-2">
            <button onclick="approveCollectorCustody('${app.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow transition-all flex items-center gap-1"><i class="ph ph-check"></i> اعتماد وتأكيد</button>
            <button onclick="rejectCollectorCustody('${app.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-xs font-semibold transition-all"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      `;
      approvalsBody.appendChild(tr);
    });
  }

  sortByTimestampDesc(db.treasuryTransactions).forEach(tx => {
    let typeText = '';
    let typeClass = '';
    let amountSign = '+';
    let amountClass = 'text-emerald-600';
    
    if (tx.type === 'deposit') {
      typeText = 'إيداع / رأس مال';
      typeClass = 'badge-success';
    } else if (tx.type === 'expense') {
      typeText = 'مصروفات خارجية';
      typeClass = 'badge-danger';
      amountSign = '-';
      amountClass = 'text-rose-600';
    } else if (tx.type === 'collection') {
      typeText = 'تحصيل أقساط';
      typeClass = 'badge-info';
    } else if (tx.type === 'cash_sale') {
      typeText = 'بيع كاش فوري';
      typeClass = 'badge-success';
    } else if (tx.type === 'inventory_purchase') {
      typeText = 'شراء بضاعة ومخزون';
      typeClass = 'badge-danger';
      amountSign = '-';
      amountClass = 'text-rose-600';
    } else if (tx.type === 'capital_injection') {
      typeText = 'ضخ رأس مال (مستثمر)';
      typeClass = 'badge-info';
    } else if (tx.type === 'profit_withdrawal') {
      typeText = 'سحب أرباح (مستثمر)';
      typeClass = 'badge-warning';
      amountSign = '-';
      amountClass = 'text-rose-600';
    }

    const adminActionBtns = isAdmin() ? `
      <button onclick="editTransaction('${tx.id}')" class="p-1 text-teal-400 hover:text-teal-600 rounded transition-colors" title="تعديل"><i class="ph ph-pencil-simple"></i></button>
      <button onclick="deleteTransaction('${tx.id}')" class="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors" title="حذف"><i class="ph ph-trash"></i></button>
    ` : '';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors';
    tr.innerHTML = `
      <td class="p-4 font-mono text-xs text-slate-500">${tx.timestamp}</td>
      <td class="p-4"><span class="badge ${typeClass}">${typeText}</span></td>
      <td class="p-4 text-slate-700 font-medium">${escapeHTML(tx.notes)}</td>
      <td class="p-4 font-bold font-mono ${amountClass}">${amountSign}${Math.abs(tx.amount).toLocaleString()} ج.م</td>
      <td class="p-4 text-center">
        <div class="inline-flex gap-1">${adminActionBtns}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ================= 7. INVESTORS & COMPANY CAPITAL (المستثمرون ورأس المال) =================
// المنطق المحاسبي: بنحسب "إجمالي أصول الشركة" الحالية (كاش + بضاعة متاحة + أقساط
// متبقية على العملاء + عهد محصلين معلقة)، وبعدين صافي الربح التراكمي = الأصول
// الحالية ناقص إجمالي رأس المال المستثمَر، زائد أي أرباح اتسحبت فعلاً قبل كده
// (عشان نرجعها للحساب لأنها كانت أرباح مكتسبة). كل مستثمر بياخد نصيبه من الربح
// حسب نسبة رأس ماله من إجمالي رأس المال.
function computeInvestorFinancials() {
  const treasuryBalance = db.treasuryTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const inventoryCapital = db.inventory.filter(dev => dev.status === 'available').reduce((sum, dev) => sum + dev.costPrice, 0);
  const outstandingInstallments = db.installments.filter(inst => inst.status !== 'paid').reduce((sum, inst) => sum + inst.amount, 0);
  const pendingCustody = db.collectorCustodies.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);

  const totalAssets = treasuryBalance + inventoryCapital + outstandingInstallments + pendingCustody;

  const investors = db.investors || [];
  const totalCapital = investors.reduce((sum, inv) => sum + (inv.capitalAmount || 0), 0);
  const totalWithdrawn = investors.reduce((sum, inv) => sum + (inv.totalWithdrawn || 0), 0);

  const netProfit = totalAssets - totalCapital + totalWithdrawn;

  const investorsWithShares = investors.map(inv => {
    const sharePercent = totalCapital > 0 ? (inv.capitalAmount / totalCapital) * 100 : 0;
    const profitShare = netProfit * (sharePercent / 100);
    const withdrawn = inv.totalWithdrawn || 0;
    const remainingDue = profitShare - withdrawn;
    return { ...inv, sharePercent, profitShare, withdrawn, remainingDue };
  });

  return {
    treasuryBalance, inventoryCapital, outstandingInstallments, pendingCustody,
    totalAssets, totalCapital, totalWithdrawn, netProfit,
    investors: investorsWithShares
  };
}

function renderInvestors() {
  const tbody = document.getElementById('investors-table-body');
  if (!tbody) return;

  const stats = computeInvestorFinancials();

  document.getElementById('investors-total-capital').textContent = `${stats.totalCapital.toLocaleString()} ج.م`;
  document.getElementById('investors-total-assets').textContent = `${stats.totalAssets.toLocaleString()} ج.م`;
  document.getElementById('investors-net-profit').textContent = `${Math.round(stats.netProfit).toLocaleString()} ج.م`;
  document.getElementById('investors-total-withdrawn').textContent = `${stats.totalWithdrawn.toLocaleString()} ج.م`;

  const netProfitEl = document.getElementById('investors-net-profit');
  netProfitEl.className = stats.netProfit >= 0 ? 'text-3xl font-extrabold mt-3 text-emerald-400' : 'text-3xl font-extrabold mt-3 text-rose-400';

  tbody.innerHTML = '';
  const emptyState = document.getElementById('investors-empty-state');

  if (!stats.investors || stats.investors.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    stats.investors.forEach(inv => {
      const adminActionBtns = isAdmin() ? `
        <button onclick="openAddCapitalModal('${inv.id}')" class="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded text-xs font-semibold transition-all flex items-center gap-1" title="إضافة رأس مال"><i class="ph ph-plus-circle"></i> رأس مال</button>
        <button onclick="openWithdrawProfitModal('${inv.id}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-semibold transition-all flex items-center gap-1" title="سحب أرباح"><i class="ph ph-hand-withdraw"></i> سحب أرباح</button>
        <button onclick="deleteInvestor('${inv.id}')" class="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors" title="حذف"><i class="ph ph-trash"></i></button>
      ` : '';

      const remainingClass = inv.remainingDue >= 0 ? 'text-emerald-600' : 'text-rose-600';

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition-colors';
      tr.innerHTML = `
        <td class="p-4 font-bold text-slate-800">${escapeHTML(inv.name)}</td>
        <td class="p-4 text-slate-500 font-mono text-xs">${escapeHTML(inv.joinDate) || '-'}</td>
        <td class="p-4 font-bold font-mono text-teal-600">${(inv.capitalAmount || 0).toLocaleString()} ج.م</td>
        <td class="p-4 font-mono">${inv.sharePercent.toFixed(1)}%</td>
        <td class="p-4 font-bold font-mono ${inv.profitShare >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${Math.round(inv.profitShare).toLocaleString()} ج.م</td>
        <td class="p-4 font-mono text-slate-600">${inv.withdrawn.toLocaleString()} ج.م</td>
        <td class="p-4 font-bold font-mono ${remainingClass}">${Math.round(inv.remainingDue).toLocaleString()} ج.م</td>
        <td class="p-4 text-center">
          <div class="inline-flex flex-wrap gap-1.5 justify-center">${adminActionBtns}</div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function nowTimestamp() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

window.openAddCapitalModal = function(investorId) {
  const inv = db.investors.find(i => i.id === investorId);
  if (!inv) return;
  document.getElementById('add-capital-investor-id').value = investorId;
  document.getElementById('add-capital-investor-name').textContent = inv.name;
  document.getElementById('add-capital-amount').value = '';
  document.getElementById('add-capital-notes').value = '';
  openModal('add-capital-modal');
};

window.openWithdrawProfitModal = function(investorId) {
  const stats = computeInvestorFinancials();
  const inv = stats.investors.find(i => i.id === investorId);
  if (!inv) return;
  document.getElementById('withdraw-profit-investor-id').value = investorId;
  document.getElementById('withdraw-profit-investor-name').textContent = inv.name;
  document.getElementById('withdraw-profit-remaining-due').textContent = `${Math.round(inv.remainingDue).toLocaleString()} ج.م`;
  document.getElementById('withdraw-profit-amount').value = '';
  document.getElementById('withdraw-profit-notes').value = '';
  openModal('withdraw-investor-profit-modal');
};

window.deleteInvestor = async function(investorId) {
  const inv = db.investors.find(i => i.id === investorId);
  if (!inv) return;
  if (!(await customConfirm(`هل أنت متأكد من حذف المستثمر "${inv.name}" نهائياً؟\n\nملاحظة: حركات رأس المال والسحب السابقة الخاصة به هتفضل موجودة في سجل الخزينة للأرشفة، لكن مش هتتحسب في توزيع الأرباح تاني بعد الحذف.`))) return;

  db.investors = db.investors.filter(i => i.id !== investorId);
  saveToLocalStorage();
  logAction('حذف مستثمر', `حذف المستثمر ${inv.name} من سجل رأس المال`);
  await syncWithAppsScript('deleteInvestor', { id: investorId });
  renderInvestors();
};

document.getElementById('add-investor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('investor-name').value.trim();
  const capitalAmount = parseFloat(document.getElementById('investor-capital').value);
  const joinDate = document.getElementById('investor-join-date').value;
  const notes = document.getElementById('investor-notes').value.trim();

  if (!name || !capitalAmount || capitalAmount <= 0) return;

  const investorId = `inv-${Date.now()}`;
  const newInvestor = {
    id: investorId,
    name,
    capitalAmount,
    joinDate: joinDate || nowTimestamp().split(' ')[0],
    notes,
    totalWithdrawn: 0
  };

  const txId = `tx-cap-${Date.now()}`;
  const capitalTx = {
    id: txId,
    timestamp: nowTimestamp(),
    type: 'capital_injection',
    amount: capitalAmount,
    notes: `ضخ رأس مال من المستثمر: ${name}`
  };

  db.investors.push(newInvestor);
  db.treasuryTransactions.unshift(capitalTx);
  saveToLocalStorage();
  logAction('إضافة مستثمر', `إضافة المستثمر ${name} برأس مال ${capitalAmount.toLocaleString()} ج.م`);

  await syncWithAppsScript('addInvestor', { investor: newInvestor, transaction: capitalTx });

  closeModal('add-investor-modal');
  document.getElementById('add-investor-form').reset();
  renderInvestors();
  renderTreasury();
  renderDashboard();
});

document.getElementById('add-capital-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const investorId = document.getElementById('add-capital-investor-id').value;
  const amount = parseFloat(document.getElementById('add-capital-amount').value);
  const notes = document.getElementById('add-capital-notes').value.trim();

  const inv = db.investors.find(i => i.id === investorId);
  if (!inv || !amount || amount <= 0) return;

  inv.capitalAmount = (inv.capitalAmount || 0) + amount;

  const txId = `tx-cap-${Date.now()}`;
  const capitalTx = {
    id: txId,
    timestamp: nowTimestamp(),
    type: 'capital_injection',
    amount: amount,
    notes: `زيادة رأس مال من المستثمر ${inv.name}${notes ? ': ' + notes : ''}`
  };

  db.treasuryTransactions.unshift(capitalTx);
  saveToLocalStorage();
  logAction('زيادة رأس مال', `زيادة رأس مال المستثمر ${inv.name} بمبلغ ${amount.toLocaleString()} ج.م`);

  await syncWithAppsScript('addInvestorCapital', { investorId, newCapitalAmount: inv.capitalAmount, transaction: capitalTx });

  closeModal('add-capital-modal');
  document.getElementById('add-capital-form').reset();
  renderInvestors();
  renderTreasury();
  renderDashboard();
});

document.getElementById('withdraw-profit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const investorId = document.getElementById('withdraw-profit-investor-id').value;
  const amount = parseFloat(document.getElementById('withdraw-profit-amount').value);
  const notes = document.getElementById('withdraw-profit-notes').value.trim();

  const inv = db.investors.find(i => i.id === investorId);
  if (!inv || !amount || amount <= 0) return;

  const stats = computeInvestorFinancials();
  const invStats = stats.investors.find(i => i.id === investorId);
  if (invStats && amount > invStats.remainingDue + 0.01) {
    if (!(await customConfirm(`المبلغ اللي داخله (${amount.toLocaleString()} ج.م) أكبر من نصيب المستثمر المتبقي من الأرباح (${Math.round(invStats.remainingDue).toLocaleString()} ج.م).\n\nتحب تكمل وتسجل السحب برضه؟`))) {
      return;
    }
  }

  inv.totalWithdrawn = (inv.totalWithdrawn || 0) + amount;

  const txId = `tx-wd-${Date.now()}`;
  const withdrawTx = {
    id: txId,
    timestamp: nowTimestamp(),
    type: 'profit_withdrawal',
    amount: -amount,
    notes: `سحب أرباح للمستثمر ${inv.name}${notes ? ': ' + notes : ''}`
  };

  db.treasuryTransactions.unshift(withdrawTx);
  saveToLocalStorage();
  logAction('سحب أرباح مستثمر', `سحب المستثمر ${inv.name} مبلغ ${amount.toLocaleString()} ج.م من نصيبه في الأرباح`);

  await syncWithAppsScript('withdrawInvestorProfit', { investorId, newTotalWithdrawn: inv.totalWithdrawn, transaction: withdrawTx });

  closeModal('withdraw-investor-profit-modal');
  document.getElementById('withdraw-profit-form').reset();
  renderInvestors();
  renderTreasury();
  renderDashboard();
});

window.approveCollectorCustody = async function(id) {
  const custody = db.collectorCustodies.find(c => c.id === id);
  if (!custody) return;
  
  const inst = db.installments.find(i => i.id === custody.installmentId);
  if (!inst) return;
  
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  custody.status = 'approved';
  inst.status = 'paid';
  inst.paidAmount = custody.amount;
  inst.paidDate = timestamp.split(' ')[0];
  inst.receiptId = custody.id;
  
  const contract = db.contracts.find(c => c.id === inst.contractId);
  if (contract) {
    inst.delayFines = calculateFinesForInstallment(inst, contract);
  }

  const collectionTx = {
    id: `tx-col-${Date.now()}`,
    timestamp: timestamp,
    type: 'collection',
    amount: custody.amount,
    notes: `تحصيل قسط رقم ${inst.installmentNum} لعقد ${inst.contractId.replace('con-', '')} للعميل ${custody.clientName} (بمعرفة المحصل ${custody.collectorName})`
  };
  db.treasuryTransactions.unshift(collectionTx);

  saveToLocalStorage();
  logAction('اعتماد عهدة', `اعتماد عهدة المحصل ${custody.collectorName} بمبلغ ${custody.amount} ج.م للعميل ${custody.clientName}`);
  
  await syncWithAppsScript('approveCustody', { 
    custodyId: id, 
    installmentId: inst.id, 
    amount: custody.amount, 
    timestamp,
    installment: inst,
    transaction: collectionTx
  });

  renderTreasury();
  renderCollections();
  
  openWhatsappModal(inst.id, 'receipt');
};

window.rejectCollectorCustody = async function(id) {
  if (await customConfirm('هل أنت متأكد من حذف وإلغاء معاملة التحصيل هذه من عهدة المحصل؟')) {
    db.collectorCustodies = db.collectorCustodies.filter(c => c.id !== id);
    saveToLocalStorage();
    logAction('إلغاء عهدة معلقة', `إلغاء معاملة تحصيل عهدة برقم ${id}`);
    renderTreasury();
    await syncWithAppsScript('deleteCustody', { id });
  }
};

// --- 7. REPORTS ---
function renderReports() {
  const fromInput = document.getElementById('report-from-date');
  const toInput = document.getElementById('report-to-date');

  // افتراضياً: من أول الشهر الحالي لحد النهاردة، لو المستخدم لسه ما حددش فترة
  if (!fromInput.value) {
    const now = new Date();
    fromInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  if (!toInput.value) {
    toInput.value = new Date().toISOString().split('T')[0];
  }

  const fromDate = fromInput.value;
  const toDate = toInput.value;

  // ---- KPIs (حسب الفترة المختارة) ----
  const contractsInRange = db.contracts.filter(c => c.startDate >= fromDate && c.startDate <= toDate);
  const salesInRange = contractsInRange.reduce((sum, c) => sum + c.totalValue, 0);

  const txInRange = db.treasuryTransactions.filter(tx => {
    const txDate = (tx.timestamp || '').split(' ')[0];
    return txDate >= fromDate && txDate <= toDate;
  });
  const collectionsInRange = txInRange.filter(tx => tx.type === 'collection').reduce((sum, tx) => sum + tx.amount, 0);
  const expensesInRange = Math.abs(txInRange.filter(tx => tx.type === 'expense' || tx.type === 'inventory_purchase').reduce((sum, tx) => sum + tx.amount, 0));
  const netInRange = txInRange.reduce((sum, tx) => sum + tx.amount, 0);

  document.getElementById('report-kpi-sales').textContent = `${salesInRange.toLocaleString()} ج.م`;
  document.getElementById('report-kpi-collections').textContent = `${collectionsInRange.toLocaleString()} ج.م`;
  document.getElementById('report-kpi-expenses').textContent = `${expensesInRange.toLocaleString()} ج.م`;
  document.getElementById('report-kpi-net').textContent = `${netInRange.toLocaleString()} ج.م`;

  // ---- أداء المحصلين خلال الفترة ----
  const collectors = db.users.filter(u => u.role === 'COLLECTOR');
  const collectorsBody = document.getElementById('report-collectors-body');
  collectorsBody.innerHTML = '';

  collectors.forEach(col => {
    const paidInRange = db.installments.filter(i =>
      i.status === 'paid' && i.collectorName === col.name && i.paidDate >= fromDate && i.paidDate <= toDate
    );
    const collectedAmount = paidInRange.reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);
    const overdueAssigned = db.installments.filter(i => {
      if (i.collectorName !== col.name || i.status === 'paid') return false;
      return getInstallmentOverdueStatus(i).overdueDays > 0;
    }).length;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="p-3 font-bold">${escapeHTML(col.name)}</td>
      <td class="p-3 font-mono">${paidInRange.length}</td>
      <td class="p-3 font-mono font-bold text-emerald-600">${collectedAmount.toLocaleString()} ج.م</td>
      <td class="p-3 font-mono ${overdueAssigned > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}">${overdueAssigned}</td>
    `;
    collectorsBody.appendChild(row);
  });

  // ---- العملاء المتأخرون حالياً (لقطة لحظية، مش مرتبطة بفلتر التاريخ) ----
  const overdueByClient = {};
  db.installments.forEach(inst => {
    if (inst.status === 'paid') return;
    const stats = getInstallmentOverdueStatus(inst);
    if (stats.overdueDays <= 0) return;
    const contract = db.contracts.find(c => c.id === inst.contractId);
    const clientId = contract?.clientId || inst.clientName;
    if (!overdueByClient[clientId]) {
      overdueByClient[clientId] = { name: inst.clientName, phone: inst.clientPhone, count: 0, totalDue: 0, maxDays: 0 };
    }
    overdueByClient[clientId].count++;
    overdueByClient[clientId].totalDue += stats.totalDue;
    overdueByClient[clientId].maxDays = Math.max(overdueByClient[clientId].maxDays, stats.overdueDays);
  });

  const overdueBody = document.getElementById('report-overdue-body');
  const overdueEmpty = document.getElementById('report-overdue-empty');
  overdueBody.innerHTML = '';
  const overdueList = Object.values(overdueByClient).sort((a, b) => b.maxDays - a.maxDays);

  if (overdueList.length === 0) {
    overdueEmpty.classList.remove('hidden');
  } else {
    overdueEmpty.classList.add('hidden');
    overdueList.forEach(c => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="p-3 font-bold">${escapeHTML(c.name)}</td>
        <td class="p-3 font-mono">${escapeHTML(c.phone)}</td>
        <td class="p-3 font-mono">${c.count}</td>
        <td class="p-3 font-mono font-bold text-rose-600">${c.totalDue.toLocaleString()} ج.م</td>
        <td class="p-3 font-mono">${c.maxDays} يوم</td>
      `;
      overdueBody.appendChild(row);
    });
  }
}

// طباعة صفحة التقارير الحالية كمستند PDF/ورقي كامل
window.printReportsPage = function() {
  const companyName = db.settings.companyName || 'شركة SKY';
  const fromDate = document.getElementById('report-from-date').value;
  const toDate = document.getElementById('report-to-date').value;

  const collectorsRows = document.getElementById('report-collectors-body').innerHTML;
  const overdueRows = document.getElementById('report-overdue-body').innerHTML;
  const overdueEmptyVisible = !document.getElementById('report-overdue-empty').classList.contains('hidden');

  const html = `
    <div class="print-doc-header">
      <div>
        <div style="font-weight:800; font-size:1.2rem; color:#0d9488;">${companyName}</div>
        <div style="font-size:0.75rem; color:#64748b;">نظام إدارة الأقساط والخزينة</div>
      </div>
      <div style="text-align:left; font-size:0.8rem;">
        <div><strong>الفترة:</strong> ${fromDate} إلى ${toDate}</div>
        <div><strong>تاريخ الإصدار:</strong> ${new Date().toLocaleString('ar-EG')}</div>
      </div>
    </div>
    <div class="print-doc-title">تقرير مالي وتشغيلي شامل</div>

    <div class="print-doc-row"><span>مبيعات العقود بالفترة</span><strong>${document.getElementById('report-kpi-sales').textContent}</strong></div>
    <div class="print-doc-row"><span>إجمالي التحصيل بالفترة</span><strong>${document.getElementById('report-kpi-collections').textContent}</strong></div>
    <div class="print-doc-row"><span>إجمالي المصروفات والمشتريات</span><strong>${document.getElementById('report-kpi-expenses').textContent}</strong></div>
    <div class="print-doc-row"><span>صافي التدفق النقدي بالفترة</span><strong>${document.getElementById('report-kpi-net').textContent}</strong></div>

    <h4 style="margin-top:20px; margin-bottom:8px; font-weight:700;">أداء المحصلين خلال الفترة</h4>
    <table class="print-doc-table">
      <thead><tr><th>المحصل</th><th>عدد الأقساط المحصّلة</th><th>إجمالي المبلغ المحصَّل</th><th>أقساط متأخرة مسندة له حالياً</th></tr></thead>
      <tbody>${collectorsRows}</tbody>
    </table>

    <h4 style="margin-top:20px; margin-bottom:8px; font-weight:700;">العملاء المتأخرون حالياً</h4>
    ${overdueEmptyVisible ? '<p style="font-size:0.85rem; color:#64748b;">لا يوجد عملاء متأخرون حالياً.</p>' : `
    <table class="print-doc-table">
      <thead><tr><th>العميل</th><th>الهاتف</th><th>عدد الأقساط المتأخرة</th><th>إجمالي المستحق</th><th>أطول مدة تأخير</th></tr></thead>
      <tbody>${overdueRows}</tbody>
    </table>`}

    <div class="print-doc-footer">تم إصدار هذا التقرير إلكترونياً من نظام ${companyName}</div>
  `;
  printHTML(html);
  logAction('طباعة تقرير', `طباعة التقرير المالي والتشغيلي للفترة من ${fromDate} إلى ${toDate}`);
};

// --- 8. USER MANAGEMENT ---
function renderUsers() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  db.users.forEach(u => {
    let roleText = 'محصل خارجي';
    let roleColor = 'badge-info';
    if (u.role === 'ADMIN') {
      roleText = 'مشرف النظام (Admin)';
      roleColor = 'badge-danger';
    } else if (u.role === 'STAFF') {
      roleText = 'مدخل بيانات';
      roleColor = 'badge-success';
    }

    const adminBtns = isAdmin() ? `
      <button onclick="editUser('${u.id}')" class="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-md text-xs font-semibold transition-all flex items-center gap-1"><i class="ph ph-note-pencil"></i> تعديل</button>
      <button onclick="deleteUser('${u.id}')" class="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"><i class="ph ph-trash"></i></button>
    ` : '<span class="text-xs text-slate-400">للمشرف فقط</span>';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors';
    tr.innerHTML = `
      <td class="p-4 font-bold text-slate-800">${escapeHTML(u.name)}</td>
      <td class="p-4 font-mono text-slate-500">${escapeHTML(u.username)}</td>
      <td class="p-4 font-mono">${escapeHTML(u.phone) || '-'}</td>
      <td class="p-4"><span class="badge ${roleColor}">${roleText}</span></td>
      <td class="p-4 text-slate-600">${escapeHTML(u.area) || '-'}</td>
      <td class="p-4 text-center">
        <div class="inline-flex gap-1.5">${adminBtns}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.editUser = function(userId) {
  if (!isAdmin()) {
    alert('⛔ هذه العملية مخصصة للمشرف (ADMIN) فقط.');
    return;
  }
  try {
    const u = db.users.find(x => x.id === userId);
    if (!u) return;

    document.getElementById('edit-user-id').value = u.id;
    document.getElementById('edit-user-fullname').value = u.name || '';
    document.getElementById('edit-user-username').value = u.username || '';
    document.getElementById('edit-user-phone').value = u.phone || '';
    document.getElementById('edit-user-role').value = u.role || 'COLLECTOR';
    document.getElementById('edit-user-area').value = u.area || '';
    openModal('edit-user-modal');
  } catch (err) {
    console.error('خطأ أثناء فتح نافذة تعديل المستخدم:', err);
    alert('❌ حصل خطأ غير متوقع أثناء فتح نافذة التعديل. افتح Console بالمتصفح (F12) وابعتلي رسالة الخطأ اللي ظهرت.');
  }
};

window.saveUserEdits = async function() {
  if (!isAdmin()) {
    alert('⛔ هذه العملية مخصصة للمشرف (ADMIN) فقط.');
    return;
  }
  try {
    const userId = document.getElementById('edit-user-id').value;
    const u = db.users.find(x => x.id === userId);
    if (!u) return;

    // ملاحظة: لا يمكن تعديل "اسم المستخدم" هنا لأنه مرتبط مباشرة بحساب Firebase
    // Authentication الحقيقي الخاص بهذا المستخدم (الحقل معطّل بالواجهة). كذلك لا
    // يمكن تغيير كلمة مرور مستخدم آخر من هنا لأسباب أمنية (Firebase Authentication
    // لا يسمح لحساب أدمن بتغيير كلمة مرور حساب آخر مباشرة من المتصفح) - استخدم
    // بدلاً من ذلك زرار "إرسال رابط تعيين كلمة مرور جديدة" إن وُجد بريد إلكتروني حقيقي.
    u.name = document.getElementById('edit-user-fullname').value.trim();
    u.phone = document.getElementById('edit-user-phone').value.trim();
    u.role = document.getElementById('edit-user-role').value;
    u.area = document.getElementById('edit-user-area').value.trim();

    saveToLocalStorage();
    logAction('تعديل مستخدم', `تعديل بيانات المستخدم ${u.name} (${u.role})`);
    await syncWithAppsScript('updateUser', {
      id: u.id,
      authUid: u.authUid || null,
      name: u.name,
      phone: u.phone,
      role: u.role,
      area: u.area
    });

    closeModal('edit-user-modal');
    renderUsers();
    populateDropdowns();
    showToast('✅ تم حفظ تعديلات المستخدم بنجاح', 'success');
  } catch (err) {
    console.error('خطأ أثناء حفظ تعديلات المستخدم:', err);
    alert('❌ حصل خطأ غير متوقع أثناء حفظ التعديلات. افتح Console بالمتصفح (F12) وابعتلي رسالة الخطأ اللي ظهرت.');
  }
};

// --- 8. SYSTEM SETTINGS ---
function renderSettings() {
  document.getElementById('setting-company-name').value = db.settings.companyName || 'شركة SKY';
  document.getElementById('setting-company-logo-url').value = db.settings.companyLogo || '';
  
  document.getElementById('setting-offline-mode').checked = db.settings.offlineMode;

  const t = db.settings.templates || defaultSeedData.settings.templates;
  document.getElementById('template-reminder').value = t.reminder;
  document.getElementById('template-warning').value = t.warning;
  document.getElementById('template-receipt').value = t.receipt;
}

// ================= MODAL INTERACTIONS =================
window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
};

// ================= IMAGE UPLOAD =================
function setupFileReader(inputId, tempKey, previewBoxId, statusId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      tempUploads[tempKey] = e.target.result;
      document.getElementById(statusId).textContent = `تم اختيار: ${file.name}`;
      
      const previewBox = document.getElementById(previewBoxId);
      previewBox.classList.remove('hidden');
      previewBox.querySelector('span').textContent = file.name;
    };
    reader.readAsDataURL(file);
  });
}

setupFileReader('client-card-img', 'clientCardImg', 'client-card-img-preview-box', 'client-card-img-status');
setupFileReader('client-contract-img', 'clientContractImg', 'client-contract-img-preview-box', 'client-contract-img-status');
setupFileReader('guarantor-card-img', 'guarantorCardImg', 'guarantor-card-img-preview-box', 'guarantor-card-img-status');
setupFileReader('guarantor-contract-img', 'guarantorContractImg', 'guarantor-contract-img-preview-box', 'guarantor-contract-img-status');

window.viewDocument = function(inputId) {
  let base64Data = '';
  let filename = '';

  if (inputId === 'client-card-img') {
    base64Data = tempUploads.clientCardImg;
    filename = document.getElementById('client-card-img-preview-box').querySelector('span').textContent;
  } else if (inputId === 'client-contract-img') {
    base64Data = tempUploads.clientContractImg;
    filename = document.getElementById('client-contract-img-preview-box').querySelector('span').textContent;
  } else if (inputId === 'guarantor-card-img') {
    base64Data = tempUploads.guarantorCardImg;
    filename = document.getElementById('guarantor-card-img-preview-box').querySelector('span').textContent;
  } else if (inputId === 'guarantor-contract-img') {
    base64Data = tempUploads.guarantorContractImg;
    filename = document.getElementById('guarantor-contract-img-preview-box').querySelector('span').textContent;
  }

  if (!base64Data) {
    alert('لا توجد صورة مستند لعرضها أو الصورة ليست بصيغة مدعومة للمعاينة.');
    return;
  }

  document.getElementById('preview-modal-img').src = base64Data;
  document.getElementById('preview-modal-title').textContent = filename;
  openModal('image-preview-modal');
};

window.removeDocument = async function(inputId) {
  if (await customConfirm('هل أنت متأكد من حذف هذا المستند؟')) {
    if (inputId === 'client-card-img') {
      tempUploads.clientCardImg = '';
      document.getElementById('client-card-img').value = '';
      document.getElementById('client-card-img-status').textContent = 'لم يتم الرفع';
      document.getElementById('client-card-img-preview-box').classList.add('hidden');
    } else if (inputId === 'client-contract-img') {
      tempUploads.clientContractImg = '';
      document.getElementById('client-contract-img').value = '';
      document.getElementById('client-contract-img-status').textContent = 'لم يتم الرفع';
      document.getElementById('client-contract-img-preview-box').classList.add('hidden');
    } else if (inputId === 'guarantor-card-img') {
      tempUploads.guarantorCardImg = '';
      document.getElementById('guarantor-card-img').value = '';
      document.getElementById('guarantor-card-img-status').textContent = 'لم يتم الرفع';
      document.getElementById('guarantor-card-img-preview-box').classList.add('hidden');
    } else if (inputId === 'guarantor-contract-img') {
      tempUploads.guarantorContractImg = '';
      document.getElementById('guarantor-contract-img').value = '';
      document.getElementById('guarantor-contract-img-status').textContent = 'لم يتم الرفع';
      document.getElementById('guarantor-contract-img-preview-box').classList.add('hidden');
    }
  }
};

document.getElementById('setting-company-logo-file').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    db.settings.companyLogo = e.target.result;
    document.getElementById('setting-company-logo-url').value = 'تم تحميل لوجو محلي كـ Base64';
    saveToLocalStorage();
    applyCompanyBranding();
  };
  reader.readAsDataURL(file);
});

// ================= PRINTING (RECEIPTS & REPORTS) =================
// آلية طباعة عامة: بنحقن أي محتوى HTML جوه #print-area، وبعدها بنستدعي
// window.print() فيفتح المتصفح مربع حوار الطباعة اللي فيه خيار "حفظ كـ PDF"
// بشكل أصلي، من غير أي مكتبة جافاسكريبت خارجية (وبيدعم العربي/RTL بشكل مثالي
// لأنه بيستخدم محرك عرض المتصفح نفسه).
function printHTML(innerHtml) {
  const area = document.getElementById('print-area');
  if (!area) return;
  area.innerHTML = innerHtml;
  setTimeout(() => window.print(), 50);
}

// طباعة إيصال تحصيل قسط بعد اعتماده
window.printInstallmentReceipt = function(instId) {
  const inst = db.installments.find(i => i.id === instId);
  if (!inst || inst.status !== 'paid') {
    showToast('❌ لا يمكن طباعة إيصال لقسط غير مسدد بعد.', 'error');
    return;
  }
  const contract = db.contracts.find(c => c.id === inst.contractId);
  const client = db.clients.find(c => c.id === inst.clientId) || {};
  const companyName = db.settings.companyName || 'شركة SKY';

  const remainingOnContract = db.installments
    .filter(i => i.contractId === inst.contractId && i.status !== 'paid')
    .reduce((sum, i) => sum + i.amount, 0);

  const html = `
    <div class="print-doc-header">
      <div>
        <div style="font-weight:800; font-size:1.2rem; color:#0d9488;">${escapeHTML(companyName)}</div>
        <div style="font-size:0.75rem; color:#64748b;">نظام إدارة الأقساط والخزينة</div>
      </div>
      <div style="text-align:left; font-size:0.8rem;">
        <div><strong>رقم الإيصال:</strong> ${escapeHTML(inst.receiptId) || '—'}</div>
        <div><strong>التاريخ:</strong> ${escapeHTML(inst.paidDate) || ''}</div>
      </div>
    </div>
    <div class="print-doc-title">إيصال استلام دفعة قسط</div>
    <div class="print-doc-row"><span>اسم العميل</span><strong>${escapeHTML(inst.clientName)}</strong></div>
    <div class="print-doc-row"><span>رقم الهاتف</span><strong>${escapeHTML(inst.clientPhone)}</strong></div>
    <div class="print-doc-row"><span>رقم العقد</span><strong>${escapeHTML(inst.contractId)}</strong></div>
    <div class="print-doc-row"><span>الجهاز</span><strong>${contract ? escapeHTML(contract.deviceInfo) : '—'}</strong></div>
    <div class="print-doc-row"><span>رقم القسط</span><strong>قسط ${inst.installmentNum} من ${contract ? contract.duration : '—'}</strong></div>
    <div class="print-doc-row"><span>المبلغ المحصَّل</span><strong>${(inst.paidAmount || inst.amount).toLocaleString()} ج.م</strong></div>
    ${inst.delayFines > 0 ? `<div class="print-doc-row"><span>غرامة تأخير مضمّنة</span><strong>${inst.delayFines.toLocaleString()} ج.م</strong></div>` : ''}
    <div class="print-doc-row"><span>المحصّل</span><strong>${escapeHTML(inst.collectorName) || '—'}</strong></div>
    <div class="print-doc-row" style="border-top:1px dashed #94a3b8; margin-top:8px; padding-top:8px;">
      <span>إجمالي المتبقي على العقد بعد هذه الدفعة</span><strong>${remainingOnContract.toLocaleString()} ج.م</strong>
    </div>
    <div class="print-doc-signatures">
      <div>توقيع المحصّل: ______________</div>
      <div>توقيع العميل: ______________</div>
    </div>
    <div class="print-doc-footer">تم إصدار هذا الإيصال إلكترونياً من نظام ${companyName} بتاريخ ${new Date().toLocaleString('ar-EG')}</div>
  `;
  printHTML(html);
  logAction('طباعة إيصال', `طباعة إيصال تحصيل القسط رقم ${inst.installmentNum} للعقد ${inst.contractId}`);
};

// ================= WHATSAPP INTEGRATION =================
let activeWhatsappPayload = { phone: '', text: '' };

// تطبيع رقم الهاتف لصيغة دولية صالحة لروابط wa.me (بدون + أو مسافات أو أصفار زيادة).
// بيرجع null لو الرقم مش واضح/غير كافي عشان نقدر نحذّر المستخدم بدل ما نبعت لرقم غلط.
function normalizeWhatsappPhone(raw) {
  if (!raw) return null;
  let digits = String(raw).trim().replace(/[^\d+]/g, '');
  if (!digits) return null;

  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  digits = digits.replace(/\D/g, '');
  if (!digits) return null;

  // رقم مصري محلي كامل بصفر البداية: 01xxxxxxxxx (11 رقم)
  if (digits.startsWith('0') && digits.length === 11) {
    return '20' + digits.slice(1);
  }
  // رقم مصري بدون الصفر ولا كود الدولة: 1xxxxxxxxx (10 أرقام)
  if (/^1[0125]\d{8}$/.test(digits)) {
    return '20' + digits;
  }
  // الرقم مكتوب بالفعل بكود الدولة المصري: 201xxxxxxxxx (12 رقم)
  if (digits.startsWith('20') && digits.length === 12) {
    return digits;
  }
  // أي رقم دولي آخر بطول منطقي، نسيبه زي ما هو بدون افتراض إنه مصري
  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }
  return null;
}

window.openWhatsappModal = function(instId, templateType) {
  const inst = db.installments.find(i => i.id === instId);
  if (!inst) return;

  const contract = db.contracts.find(c => c.id === inst.contractId);
  const client = db.clients.find(c => c.id === contract?.clientId);
  if (!client) return;

  const statusInfo = getInstallmentOverdueStatus(inst);
  
  const templates = db.settings.templates || defaultSeedData.settings.templates;
  let templateText = '';
  let targetPhone = client.phone;
  let recipientName = client.name;

  if (templateType === 'reminder') {
    templateText = templates.reminder;
  } else if (templateType === 'warning_client') {
    templateText = templates.warning;
  } else if (templateType === 'receipt') {
    templateText = templates.receipt;
  }

  if (!templateText) {
    templateText = "تنبيه من الشركة بخصوص العقد رقم {{العقد}}.";
  }

  const companyName = db.settings.companyName || 'شركة SKY';
  let resolvedMsg = templateText
    .replace(/{{الاسم}}/g, client.name)
    .replace(/{{القسط}}/g, inst.amount.toLocaleString())
    .replace(/{{التاريخ}}/g, inst.dueDate)
    .replace(/{{العقد}}/g, inst.contractId.replace('con-', ''))
    .replace(/{{الغرامة}}/g, statusInfo.fine.toLocaleString())
    .replace(/{{المطلوب}}/g, statusInfo.totalDue.toLocaleString())
    .replace(/{{الإيصال}}/g, inst.receiptId || '')
    .replace(/{{الضامن}}/g, client.guarantorName || 'لا يوجد')
    .replace(/{{اسم_الشركة}}/g, companyName);

  document.getElementById('wa-recipient-name').value = recipientName;
  document.getElementById('wa-recipient-phone').value = targetPhone;
  document.getElementById('wa-message-text').value = resolvedMsg;

  const formattedPhone = normalizeWhatsappPhone(targetPhone);
  if (!formattedPhone) {
    alert(`رقم هاتف العميل "${recipientName}" غير واضح أو غير مكتمل (${targetPhone || 'فارغ'}). من فضلك عدّل رقم الهاتف من بيانات العميل قبل الإرسال.`);
    return;
  }

  activeWhatsappPayload = {
    phone: formattedPhone,
    text: resolvedMsg
  };

  openModal('whatsapp-modal');
};

window.sendPreparedWhatsapp = function() {
  const editedText = document.getElementById('wa-message-text').value;
  const url = `https://wa.me/${activeWhatsappPayload.phone}?text=${encodeURIComponent(editedText)}`;
  window.open(url, '_blank');
  closeModal('whatsapp-modal');
  logAction('إرسال واتساب', `إرسال رسالة تواصل إلى الهاتف ${activeWhatsappPayload.phone}`);
};

// ================= BULK WHATSAPP OPERATIONS =================
// إرسال بنظام "طابور": بنفتح رسالة واحدة بس في كل مرة، والانتقال للتالي بيحصل
// بضغطة زرار حقيقية من المستخدم. ده بيتفادى مشكلة إن المتصفح بيحجب فتح أكتر
// من نافذة تلقائياً لو اتفتحوا مع بعض عن طريق setTimeout بدون تفاعل مباشر من المستخدم.
let bulkWaQueue = [];
let bulkWaIndex = 0;
let bulkWaSentCount = 0;
let bulkWaSkippedCount = 0;

window.openBulkWhatsappModal = function() {
  const select = document.getElementById('bulk-wa-month-select');
  select.innerHTML = '';
  
  const months = [...new Set(db.installments.map(i => i.dueDate.substring(0, 7)))].sort();
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  });

  if (months.length === 0) {
    alert('لا توجد أقساط مسجلة لجدولة الرسائل الجماعية.');
    return;
  }

  document.getElementById('bulk-wa-step-select').classList.remove('hidden');
  document.getElementById('bulk-wa-step-queue').classList.add('hidden');
  document.getElementById('bulk-wa-step-summary').classList.add('hidden');

  renderBulkClientsList();
  openModal('bulk-whatsapp-modal');
};

function renderBulkClientsList() {
  const month = document.getElementById('bulk-wa-month-select').value;
  const type = document.getElementById('bulk-wa-type-select').value;
  const listContainer = document.getElementById('bulk-wa-clients-list');
  listContainer.innerHTML = '';

  const targetInsts = db.installments.filter(inst => {
    const matchesMonth = inst.dueDate.substring(0, 7) === month;
    const stats = getInstallmentOverdueStatus(inst);
    
    if (type === 'reminder') {
      return matchesMonth && inst.status !== 'paid';
    } else {
      return matchesMonth && inst.status !== 'paid' && stats.overdueDays > 0;
    }
  });

  if (targetInsts.length === 0) {
    listContainer.innerHTML = '<p class="text-slate-400 text-center py-4">لا توجد أقساط مطابقة لهذا الفلتر.</p>';
    document.getElementById('btn-start-bulk-wa').disabled = true;
    return;
  }
  document.getElementById('btn-start-bulk-wa').disabled = false;

  targetInsts.forEach(inst => {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center bg-white p-2 rounded border border-slate-100';
    div.innerHTML = `
      <div>
        <span class="font-bold text-slate-700">${escapeHTML(inst.clientName)}</span>
        <span class="text-slate-400 font-mono">(${escapeHTML(inst.dueDate)})</span>
      </div>
      <div class="font-mono font-bold text-teal-600">${inst.amount.toLocaleString()} ج.م</div>
    `;
    listContainer.appendChild(div);
  });
}

document.getElementById('bulk-wa-month-select').addEventListener('change', renderBulkClientsList);
document.getElementById('bulk-wa-type-select').addEventListener('change', renderBulkClientsList);

document.getElementById('btn-start-bulk-wa').addEventListener('click', () => {
  const month = document.getElementById('bulk-wa-month-select').value;
  const type = document.getElementById('bulk-wa-type-select').value;

  const targetInsts = db.installments.filter(inst => {
    const matchesMonth = inst.dueDate.substring(0, 7) === month;
    const stats = getInstallmentOverdueStatus(inst);
    if (type === 'reminder') {
      return matchesMonth && inst.status !== 'paid';
    } else {
      return matchesMonth && inst.status !== 'paid' && stats.overdueDays > 0;
    }
  });

  if (targetInsts.length === 0) return;

  // نبني نص كل رسالة مقدماً ونخزنها في طابور، وبعدين نعرض عنصر واحد بس في كل مرة
  bulkWaQueue = targetInsts.map(inst => {
    const stats = getInstallmentOverdueStatus(inst);
    const companyName = db.settings.companyName || 'شركة SKY';
    const templates = db.settings.templates || defaultSeedData.settings.templates;
    const templateText = type === 'reminder' ? templates.reminder : templates.warning;

    const resolvedMsg = templateText
      .replace(/{{الاسم}}/g, inst.clientName)
      .replace(/{{القسط}}/g, inst.amount.toLocaleString())
      .replace(/{{التاريخ}}/g, inst.dueDate)
      .replace(/{{العقد}}/g, inst.contractId.replace('con-', ''))
      .replace(/{{الغرامة}}/g, stats.fine.toLocaleString())
      .replace(/{{المطلوب}}/g, stats.totalDue.toLocaleString())
      .replace(/{{اسم_الشركة}}/g, companyName);

    return {
      clientName: inst.clientName,
      rawPhone: inst.clientPhone,
      phone: normalizeWhatsappPhone(inst.clientPhone),
      text: resolvedMsg
    };
  });

  bulkWaIndex = 0;
  bulkWaSentCount = 0;
  bulkWaSkippedCount = 0;

  document.getElementById('bulk-wa-step-select').classList.add('hidden');
  document.getElementById('bulk-wa-step-summary').classList.add('hidden');
  document.getElementById('bulk-wa-step-queue').classList.remove('hidden');

  renderBulkWaQueueItem();

  logAction('إرسال جماعي', `بدء جلسة إرسال جماعي لشهر ${month} لنوع ${type === 'reminder' ? 'تذكير' : 'إنذار'} (${bulkWaQueue.length} عميل)`);
});

function renderBulkWaQueueItem() {
  // انتهى الطابور بالكامل
  if (bulkWaIndex >= bulkWaQueue.length) {
    document.getElementById('bulk-wa-step-queue').classList.add('hidden');
    document.getElementById('bulk-wa-step-summary').classList.remove('hidden');
    document.getElementById('bulk-wa-sent-count').textContent = bulkWaSentCount;
    document.getElementById('bulk-wa-skipped-count').textContent = bulkWaSkippedCount;
    return;
  }

  const item = bulkWaQueue[bulkWaIndex];
  document.getElementById('bulk-wa-progress-label').textContent = `العميل: ${item.clientName}`;
  document.getElementById('bulk-wa-progress-count').textContent = `${bulkWaIndex + 1} / ${bulkWaQueue.length}`;
  document.getElementById('bulk-wa-progress-bar').style.width = `${Math.round((bulkWaIndex / bulkWaQueue.length) * 100)}%`;

  document.getElementById('bulk-wa-current-name').value = item.clientName;
  document.getElementById('bulk-wa-current-phone').value = item.rawPhone || '';
  document.getElementById('bulk-wa-current-text').value = item.text;

  const warningEl = document.getElementById('bulk-wa-phone-warning');
  const sendBtn = document.getElementById('btn-send-current-bulk-wa');
  if (!item.phone) {
    warningEl.classList.remove('hidden');
    sendBtn.disabled = true;
    sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    warningEl.classList.add('hidden');
    sendBtn.disabled = false;
    sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

document.getElementById('btn-send-current-bulk-wa').addEventListener('click', () => {
  const item = bulkWaQueue[bulkWaIndex];
  if (!item || !item.phone) return;

  // نأخذ النص من الـ textarea في حالة المستخدم عدّل فيه يدوياً
  const editedText = document.getElementById('bulk-wa-current-text').value;
  const url = `https://wa.me/${item.phone}?text=${encodeURIComponent(editedText)}`;

  // فتح النافذة هنا بيحصل مباشرة كنتيجة لضغطة المستخدم على الزرار، فمفيش
  // أي احتمال إن المتصفح يحجبها زي ما كان بيحصل مع الحلقة القديمة اللي كانت
  // بتفتح كل النوافذ دفعة واحدة عن طريق setTimeout.
  window.open(url, '_blank');

  bulkWaSentCount++;
  logAction('إرسال واتساب جماعي', `فتح رسالة واتساب للعميل ${item.clientName} (${item.phone})`);

  bulkWaIndex++;
  renderBulkWaQueueItem();
});

document.getElementById('btn-skip-bulk-wa').addEventListener('click', () => {
  const item = bulkWaQueue[bulkWaIndex];
  if (item) {
    bulkWaSkippedCount++;
    logAction('تخطي إرسال واتساب', `تم تخطي العميل ${item.clientName} أثناء الإرسال الجماعي`);
  }
  bulkWaIndex++;
  renderBulkWaQueueItem();
});

// ================= CUSTOM TRANSACTIONAL ACTIONS =================
window.collectInstallmentBtn = function(instId) {
  const inst = db.installments.find(i => i.id === instId);
  if (!inst) return;

  const stats = getInstallmentOverdueStatus(inst);
  const collector = inst.collectorName || 'Khalifa (ADMIN)';

  const receiptId = `REC-${Date.now().toString().slice(-6)}`;
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  db.collectorCustodies.unshift({
    id: receiptId,
    installmentId: instId,
    contractId: inst.contractId,
    clientName: inst.clientName,
    collectorName: collector,
    amount: stats.totalDue,
    date: timestamp,
    status: 'pending'
  });

  saveToLocalStorage();
  logAction('تحصيل محلي بالعهد', `قام المحصل ${collector} بتحصيل عهدة بقيمة ${stats.totalDue} ج.م من العميل ${inst.clientName} (معلق بانتظار تأكيد الأدمن)`);
  
  syncWithAppsScript('addPendingCustody', { id: receiptId, installmentId: instId, contractId: inst.contractId, clientName: inst.clientName, collectorName: collector, amount: stats.totalDue, date: timestamp, status: 'pending' });

  renderCollections();
  renderTreasury();
  alert(`تم تسجيل تحصيل المبلغ بالعهدة للمحصل: ${collector}. يرجى تأكيد المبلغ من الخزينة لتسجيله بالخزينة الرئيسية.`);
};

document.getElementById('cash-sale-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const selectedDevId = document.getElementById('cash-sale-serial-select').value;
  const clientName = document.getElementById('cash-client-name').value;
  const clientPhone = document.getElementById('cash-client-phone').value;
  const sellingPrice = parseFloat(document.getElementById('cash-sale-price').value);

  const dev = db.inventory.find(d => d.id === selectedDevId);
  if (!dev) return;

  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  dev.status = 'sold_cash';
  dev.soldTo = clientName;

  const txId = `tx-cash-${Date.now()}`;
  const cashSaleTx = {
    id: txId,
    timestamp: timestamp,
    type: 'cash_sale',
    amount: sellingPrice,
    notes: `بيع كاش فوري للجهاز ${dev.brand} ${dev.name} (SN: ${dev.serial}) للعميل ${clientName} (هاتف: ${clientPhone})`
  };
  db.treasuryTransactions.unshift(cashSaleTx);

  saveToLocalStorage();
  logAction('بيع كاش فوري', `بيع كاش للجهاز ${dev.brand} ${dev.name} بقيمة ${sellingPrice} ج.م للعميل ${clientName}`);
  
  await syncWithAppsScript('cashSale', { 
    devId: selectedDevId, 
    clientName, 
    clientPhone, 
    sellingPrice, 
    timestamp,
    deviceInfo: `${dev.brand} ${dev.name} (SN: ${dev.serial})`,
    transaction: cashSaleTx
  });

  closeModal('cash-sale-modal');
  document.getElementById('cash-sale-form').reset();
  renderInventory();
  renderTreasury();
  renderDashboard();
});

document.getElementById('contract-device-select').addEventListener('change', function() {
  const devId = this.value;
  const dev = db.inventory.find(d => d.id === devId);
  if (dev) {
    document.getElementById('calc-cash-price').textContent = `${dev.sellingPrice.toLocaleString()} ج.م`;
    updateContractCalculation();
  }
});

document.getElementById('contract-interest-type').addEventListener('change', function() {
  const interestValueInput = document.getElementById('contract-interest-value');
  if (this.value === 'none') {
    interestValueInput.disabled = true;
    interestValueInput.value = 0;
  } else {
    interestValueInput.disabled = false;
  }
  updateContractCalculation();
});

document.getElementById('contract-interest-value').addEventListener('input', updateContractCalculation);
document.getElementById('contract-duration').addEventListener('input', updateContractCalculation);
document.getElementById('contract-down-payment').addEventListener('input', updateContractCalculation);

function calcInterestAmount(cashPrice, interestType, interestValue) {
  if (interestType === 'percent') {
    return cashPrice * (interestValue / 100);
  } else if (interestType === 'fixed') {
    return interestValue;
  }
  return 0;
}

function updateContractCalculation() {
  const devId = document.getElementById('contract-device-select').value;
  const dev = db.inventory.find(d => d.id === devId);
  if (!dev) return;

  const duration = parseInt(document.getElementById('contract-duration').value) || 1;
  const downPayment = parseFloat(document.getElementById('contract-down-payment').value) || 0;
  const interestType = document.getElementById('contract-interest-type').value;
  const interestValue = parseFloat(document.getElementById('contract-interest-value').value) || 0;

  const cashPrice = dev.sellingPrice;
  const interest = calcInterestAmount(cashPrice, interestType, interestValue);
  const totalPrice = cashPrice + interest;
  const remaining = Math.max(0, totalPrice - downPayment);
  const monthly = parseFloat((remaining / duration).toFixed(2));

  document.getElementById('calc-cash-price').textContent = `${cashPrice.toLocaleString()} ج.م`;
  document.getElementById('calc-total-price').textContent = `${totalPrice.toLocaleString()} ج.م`;
  document.getElementById('calc-remaining-amount').textContent = `${remaining.toLocaleString()} ج.م`;
  document.getElementById('calc-monthly-installment').textContent = `${monthly.toLocaleString()} ج.م`;
}

document.getElementById('add-contract-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const clientId = document.getElementById('contract-client-select').value;
  const deviceId = document.getElementById('contract-device-select').value;
  const duration = parseInt(document.getElementById('contract-duration').value);
  const downPayment = parseFloat(document.getElementById('contract-down-payment').value);
  const graceDays = parseInt(document.getElementById('contract-grace-days').value);
  const fineType = document.getElementById('contract-fine-type').value;
  const fineValue = parseFloat(document.getElementById('contract-fine-value').value);
  const collectorName = document.getElementById('contract-collector-select').value;
  const startDate = document.getElementById('contract-start-date').value;

  const interestType = document.getElementById('contract-interest-type').value;
  const interestValue = parseFloat(document.getElementById('contract-interest-value').value) || 0;

  const client = db.clients.find(c => c.id === clientId);
  const dev = db.inventory.find(d => d.id === deviceId);
  const collector = db.users.find(u => u.name === collectorName);

  if (!client || !dev) {
    alert('العميل أو الجهاز غير متوافق.');
    return;
  }

  const cashPrice = dev.sellingPrice;
  const interest = calcInterestAmount(cashPrice, interestType, interestValue);
  const totalValue = cashPrice + interest;
  const contractId = `con-${Math.floor(100000 + Math.random() * 900000)}`;
  const remaining = Math.max(0, totalValue - downPayment);
  const monthly = parseFloat((remaining / duration).toFixed(2));

  const contract = {
    id: contractId,
    clientId: clientId,
    clientName: client.name,
    clientPhone: client.phone,
    deviceId: deviceId,
    deviceInfo: `${dev.brand} ${dev.name}`,
    cashPrice: cashPrice,
    interestType: interestType,
    interestValue: interestValue,
    interestAmount: interest,
    totalValue: totalValue,
    downPayment: downPayment,
    remainingAmount: remaining,
    monthlyInstallment: monthly,
    duration: duration,
    graceDays: graceDays,
    fineType: fineType,
    fineValue: fineValue,
    collectorId: collector?.id || 'usr-1',
    collectorName: collectorName,
    startDate: startDate,
    status: 'active'
  };

  db.contracts.unshift(contract);
  dev.status = 'sold_installment';
  dev.soldTo = client.name;

  let start = new Date(startDate);
  for (let i = 1; i <= duration; i++) {
    let dueDate = new Date(start);
    dueDate.setMonth(start.getMonth() + (i - 1));

    db.installments.push({
      id: `${contractId}_${i}`,
      contractId: contractId,
      clientId: clientId,
      clientName: client.name,
      clientPhone: client.phone,
      guarantorName: client.guarantorName,
      guarantorPhone: client.guarantorPhone,
      collectorName: collectorName,
      installmentNum: i,
      amount: monthly,
      dueDate: dueDate.toISOString().split('T')[0],
      status: 'pending',
      paidAmount: 0,
      paidDate: '',
      receiptId: '',
      delayFines: 0
    });
  }

  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  let downPaymentTx = null;
  if (downPayment > 0) {
    downPaymentTx = {
      id: `tx-dp-${Date.now()}`,
      timestamp: timestamp,
      type: 'collection',
      amount: downPayment,
      notes: `مقدم عقد التقسيط رقم ${contractId.replace('con-', '')} للعميل ${client.name} (جهاز ${dev.brand} ${dev.name})`
    };
    db.treasuryTransactions.unshift(downPaymentTx);
  }

  saveToLocalStorage();
  logAction('إنشاء عقد', `تم إنشاء عقد بيع وتقسيط رقم ${contractId.replace('con-', '')} للعميل ${client.name}`);
  
  await syncWithAppsScript('addContract', { 
    contract, 
    timestamp,
    guarantorName: client.guarantorName,
    guarantorPhone: client.guarantorPhone,
    transaction: downPaymentTx
  });

  closeModal('add-contract-modal');
  document.getElementById('add-contract-form').reset();
  
  renderContracts();
  renderInventory();
  renderCollections();
  renderTreasury();
  renderDashboard();
});

document.getElementById('add-brand-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('brand-name').value.trim();
  if (!name) return;

  if (db.brands.includes(name)) {
    alert('هذا الصنف مسجل بالفعل.');
    return;
  }

  db.brands.push(name);
  saveToLocalStorage();
  logAction('إضافة صنف', `تم إضافة صنف/ماركة جديدة: ${name}`);
  await syncWithAppsScript('addBrand', { name });

  closeModal('add-brand-modal');
  document.getElementById('add-brand-form').reset();
  populateDropdowns();
  renderInventory();
});

document.getElementById('add-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!isAdmin()) {
    alert('⛔ إضافة مستخدمين جدد للمشرف (ADMIN) فقط.');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const name = document.getElementById('user-fullname').value.trim();
  const username = document.getElementById('user-username').value.trim();
  const phone = document.getElementById('user-phone').value.trim();
  const password = document.getElementById('user-password').value;
  const role = document.getElementById('user-role').value;
  const area = document.getElementById('user-area').value.trim();

  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    alert('❌ اسم المستخدم هذا مُستخدم بالفعل، اختر اسماً آخر.');
    return;
  }
  if (password.length < 6) {
    alert('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل (متطلب Firebase Authentication).');
    return;
  }
  if (!window.FirebaseAuthService) {
    alert('❌ تعذر الاتصال بخدمة Firebase Authentication. تأكد من اتصال الإنترنت.');
    return;
  }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جاري الإنشاء...'; }

  try {
    // إنشاء حساب حقيقي وآمن في Firebase Authentication (بدون التأثير على جلسة الأدمن الحالية)
    const authResult = await window.FirebaseAuthService.createAuthUser(username, password);

    if (!authResult.success) {
      throw new Error('فشل إنشاء حساب المصادقة');
    }

    // ملاحظة أمان هامة: لا يتم تخزين كلمة المرور في Firestore إطلاقاً بعد الآن،
    // فقط authUid الذي يربط ملف المستخدم بحساب Firebase Authentication الحقيقي
    const newUser = {
      id: `usr-${Date.now()}`,
      authUid: authResult.uid,
      name,
      username,
      phone,
      role,
      area
    };

    db.users.push(newUser);
    saveToLocalStorage();
    logAction('إضافة مستخدم', `إضافة المستخدم الجديد ${name} بصلاحية ${role}`);
    await syncWithAppsScript('addUser', newUser);

    closeModal('add-user-modal');
    document.getElementById('add-user-form').reset();
    renderUsers();
    populateDropdowns();
    showToast(`✅ تم إنشاء حساب ${name} بنجاح عبر Firebase Authentication`, 'success');
  } catch (err) {
    console.error('Error creating user:', err);
    let msg = 'حدث خطأ أثناء إنشاء المستخدم.';
    if (err.code === 'auth/email-already-in-use') {
      msg = '❌ اسم المستخدم هذا مُستخدم بالفعل (مسجل مسبقاً في Firebase Authentication).';
    } else if (err.code === 'auth/weak-password') {
      msg = '❌ كلمة المرور ضعيفة جداً، استخدم 6 أحرف على الأقل.';
    }
    alert(msg);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'حفظ المستخدم'; }
  }
});

document.getElementById('add-supplier-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('supplier-name').value;
  const phone = document.getElementById('supplier-phone').value;
  const notes = document.getElementById('supplier-notes').value;

  const supplierObj = { name, phone, notes };
  db.suppliers.push(supplierObj);
  saveToLocalStorage();
  logAction('إضافة تاجر', `تم إضافة تاجر/مورد جديد ${name}`);
  await syncWithAppsScript('addSupplier', supplierObj);

  closeModal('add-supplier-modal');
  document.getElementById('add-supplier-form').reset();
  populateDropdowns();
  renderInventory();
});

document.getElementById('add-device-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const brand = document.getElementById('device-brand-select').value;
  const name = document.getElementById('device-name').value;
  const serialRaw = document.getElementById('device-serial').value;
  const costPrice = parseFloat(document.getElementById('device-cost').value);
  const sellingPrice = parseFloat(document.getElementById('device-price').value);
  const supplier = document.getElementById('device-supplier').value;

  const serials = serialRaw.split(',')
    .map(s => s.trim())
    .filter(s => s !== '');

  if (serials.length === 0) {
    alert('يرجى كتابة رقم تسلسلي واحد على الأقل.');
    return;
  }

  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const syncPromises = [];
  serials.forEach((serial, index) => {
    const newDevice = {
      id: `dev-${Date.now()}-${index}`,
      brand,
      name,
      serial,
      costPrice,
      sellingPrice,
      supplier,
      status: 'available',
      soldTo: ''
    };

    db.inventory.push(newDevice);

    const purchaseTx = {
      id: `tx-pur-${Date.now()}-${index}`,
      timestamp: timestamp,
      type: 'inventory_purchase',
      amount: -costPrice,
      notes: `شراء قطعة ${brand} ${name} (SN: ${serial}) من التاجر ${supplier}`
    };
    db.treasuryTransactions.unshift(purchaseTx);

    syncPromises.push(syncWithAppsScript('addDevice', { newDevice, timestamp, transaction: purchaseTx }));
  });

  saveToLocalStorage();
  logAction('إضافة قطعة', `إضافة عدد ${serials.length} قطعة من ${brand} ${name} بمجموع تكلفة ${(costPrice * serials.length)} ج.م`);

  if (syncPromises.length > 0) {
    await Promise.all(syncPromises);
  }

  closeModal('add-device-modal');
  document.getElementById('add-device-form').reset();
  renderInventory();
  renderTreasury();
  renderDashboard();
});

window.openAddClientModal = function() {
  document.getElementById('client-edit-id').value = '';
  document.getElementById('add-client-form').reset();
  
  tempUploads = {
    clientCardImg: '',
    clientContractImg: '',
    guarantorCardImg: '',
    guarantorContractImg: ''
  };

  document.getElementById('client-card-img-preview-box').classList.add('hidden');
  document.getElementById('client-contract-img-preview-box').classList.add('hidden');
  document.getElementById('guarantor-card-img-preview-box').classList.add('hidden');
  document.getElementById('guarantor-contract-img-preview-box').classList.add('hidden');

  document.getElementById('client-card-img-status').textContent = 'لم يتم الرفع';
  document.getElementById('client-contract-img-status').textContent = 'لم يتم الرفع';
  document.getElementById('guarantor-card-img-status').textContent = 'لم يتم الرفع';
  document.getElementById('guarantor-contract-img-status').textContent = 'لم يتم الرفع';

  document.getElementById('client-modal-title').textContent = 'إضافة عميل وضامن جديد للمبيعات';
  openModal('add-client-modal');
};

window.editClient = function(clientId) {
  const c = db.clients.find(x => x.id === clientId);
  if (!c) return;

  document.getElementById('client-edit-id').value = c.id;
  
  document.getElementById('client-fullname').value = c.name || '';
  document.getElementById('client-national-id').value = c.nationalId || '';
  document.getElementById('client-phone').value = c.phone || '';
  document.getElementById('client-address').value = c.address || '';
  document.getElementById('client-location-url').value = c.locationUrl || '';

  document.getElementById('guarantor-fullname').value = c.guarantorName || '';
  document.getElementById('guarantor-national-id').value = c.guarantorNationalId || '';
  document.getElementById('guarantor-phone').value = c.guarantorPhone || '';
  document.getElementById('guarantor-relation').value = c.guarantorRelation || '';
  document.getElementById('guarantor-job').value = c.guarantorJob || '';
  document.getElementById('guarantor-address').value = c.guarantorAddress || '';

  tempUploads.clientCardImg = c.nationalIdImg || '';
  tempUploads.clientContractImg = c.contractImg || '';
  tempUploads.guarantorCardImg = c.guarantorCardImg || '';
  tempUploads.guarantorContractImg = c.guarantorContractImg || '';

  setupPreviewBox('client-card-img-preview-box', 'client-card-img-status', c.nationalIdImg, 'بطاقة العميل');
  setupPreviewBox('client-contract-img-preview-box', 'client-contract-img-status', c.contractImg, 'عقد العميل');
  setupPreviewBox('guarantor-card-img-preview-box', 'guarantor-card-img-status', c.guarantorCardImg, 'بطاقة الضامن');
  setupPreviewBox('guarantor-contract-img-preview-box', 'guarantor-contract-img-status', c.guarantorContractImg, 'عقد الضامن');

  document.getElementById('client-modal-title').textContent = 'تعديل بيانات العميل والضامن المعني';
  openModal('add-client-modal');
};

function setupPreviewBox(previewId, statusId, base64Data, label) {
  const box = document.getElementById(previewId);
  const status = document.getElementById(statusId);
  
  if (base64Data && base64Data.startsWith('data:image')) {
    box.classList.remove('hidden');
    box.querySelector('span').textContent = label;
    status.textContent = 'تم توفير مستند مخزن';
  } else {
    box.classList.add('hidden');
    status.textContent = 'لم يتم الرفع';
  }
}

document.getElementById('add-client-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const editId = document.getElementById('client-edit-id').value;

  const name = document.getElementById('client-fullname').value;
  const nationalId = document.getElementById('client-national-id').value;
  const phone = document.getElementById('client-phone').value;
  const address = document.getElementById('client-address').value;
  const locationUrl = document.getElementById('client-location-url').value;
  
  const guarantorName = document.getElementById('guarantor-fullname').value;
  const guarantorNationalId = document.getElementById('guarantor-national-id').value;
  const guarantorPhone = document.getElementById('guarantor-phone').value;
  const guarantorRelation = document.getElementById('guarantor-relation').value;
  const guarantorJob = document.getElementById('guarantor-job').value;
  const guarantorAddress = document.getElementById('guarantor-address').value;

  let nationalIdImg = tempUploads.clientCardImg;
  let contractImg = tempUploads.clientContractImg;
  let guarantorCardImg = tempUploads.guarantorCardImg;
  let guarantorContractImg = tempUploads.guarantorContractImg;

  // Use Firebase Storage if available (uploads and returns secure URL)
  if (window.FirebaseService && window.FirebaseService.isAvailable()) {
    const statusMsg = document.getElementById('client-modal-title');
    const originalTitle = statusMsg.textContent;
    statusMsg.textContent = 'جاري رفع الصور المشفرة... يرجى الانتظار';
    
    nationalIdImg = await window.FirebaseService.uploadImage(nationalIdImg, 'clients/cards', `card_${nationalId}`);
    contractImg = await window.FirebaseService.uploadImage(contractImg, 'clients/contracts', `contract_${nationalId}`);
    guarantorCardImg = await window.FirebaseService.uploadImage(guarantorCardImg, 'guarantors/cards', `gcard_${guarantorNationalId || nationalId}`);
    guarantorContractImg = await window.FirebaseService.uploadImage(guarantorContractImg, 'guarantors/contracts', `gcontract_${guarantorNationalId || nationalId}`);
    
    statusMsg.textContent = originalTitle;
  }

  if (editId) {
    const c = db.clients.find(x => x.id === editId);
    if (c) {
      c.name = name;
      c.nationalId = nationalId;
      c.phone = phone;
      c.address = address;
      c.locationUrl = locationUrl;
      c.nationalIdImg = nationalIdImg;
      c.contractImg = contractImg;
      c.guarantorName = guarantorName;
      c.guarantorNationalId = guarantorNationalId;
      c.guarantorPhone = guarantorPhone;
      c.guarantorRelation = guarantorRelation;
      c.guarantorJob = guarantorJob;
      c.guarantorAddress = guarantorAddress;
      c.guarantorCardImg = guarantorCardImg;
      c.guarantorContractImg = guarantorContractImg;

      logAction('تعديل عميل', `تعديل بيانات العميل ${name} وضامنه ${guarantorName}`);
      await syncWithAppsScript('updateClient', c);
    }
  } else {
    const newClient = {
      id: `cli-${Date.now()}`,
      name,
      nationalId,
      phone,
      address,
      locationUrl,
      nationalIdImg,
      contractImg,
      guarantorName,
      guarantorNationalId,
      guarantorPhone,
      guarantorRelation,
      guarantorJob,
      guarantorAddress,
      guarantorCardImg,
      guarantorContractImg
    };
    db.clients.push(newClient);
    logAction('إضافة عميل', `إضافة العميل الجديد ${name} وضامنه ${guarantorName}`);
    await syncWithAppsScript('addClient', newClient);
  }

  saveToLocalStorage();
  closeModal('add-client-modal');
  document.getElementById('add-client-form').reset();
  renderClients();
  populateDropdowns();
});

document.getElementById('expense-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const category = document.getElementById('expense-category').value;
  const notes = document.getElementById('expense-notes').value;

  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const txId = `tx-exp-${Date.now()}`;
  const expenseTx = {
    id: txId,
    timestamp: timestamp,
    type: 'expense',
    amount: -amount,
    notes: `مصروف (${category}): ${notes}`
  };
  db.treasuryTransactions.unshift(expenseTx);

  saveToLocalStorage();
  logAction('صرف مصروف', `صرف مبلغ ${amount} ج.م كبند مصروفات (${category})`);

  await syncWithAppsScript('addExpense', { amount, category, notes, timestamp, transaction: expenseTx });

  closeModal('expense-modal');
  document.getElementById('expense-form').reset();
  renderTreasury();
  renderDashboard();
});

document.getElementById('deposit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('deposit-amount').value);
  const notes = document.getElementById('deposit-notes').value;

  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const txId = `tx-dep-${Date.now()}`;
  const depositTx = {
    id: txId,
    timestamp: timestamp,
    type: 'deposit',
    amount: amount,
    notes: notes
  };
  db.treasuryTransactions.unshift(depositTx);

  saveToLocalStorage();
  logAction('إيداع خزينة', `إيداع مبلغ ${amount} ج.م بالخزينة لـ: ${notes}`);

  await syncWithAppsScript('addDeposit', { amount, notes, timestamp, transaction: depositTx });

  closeModal('deposit-modal');
  document.getElementById('deposit-form').reset();
  renderTreasury();
  renderDashboard();
});

window.deleteClient = async function(id) {
  if (await customConfirm('هل أنت متأكد من حذف هذا العميل نهائياً من النظام؟ لا يمكن الرجوع عن هذا الخيار.')) {
    const client = db.clients.find(c => c.id === id);
    db.clients = db.clients.filter(c => c.id !== id);
    saveToLocalStorage();
    if (client) logAction('حذف عميل', `حذف العميل ${client.name} من السجلات`);
    renderClients();
    populateDropdowns();
    // لازم نبعت أمر الحذف الفعلي لقاعدة البيانات، وإلا هيرجع العميل تاني أول ما تحصل أي مزامنة لحظية
    await syncWithAppsScript('deleteClient', { id });
  }
};

window.deleteTransaction = async function(id) {
  if (!isAdmin()) {
    alert('⛔ حذف الحركات المالية مخصص للمشرف (ADMIN) فقط.');
    return;
  }
  if (await customConfirm('هل أنت متأكد من حذف هذه حركة المالية؟ سيؤثر هذا على إجمالي رصيد الخزينة.')) {
    const tx = db.treasuryTransactions.find(t => t.id === id);
    db.treasuryTransactions = db.treasuryTransactions.filter(t => t.id !== id);
    saveToLocalStorage();
    if (tx) logAction('حذف حركة مالية', `حذف المعاملة المالية بقيمة ${tx.amount} ج.م`);
    renderTreasury();
    renderDashboard();
    await syncWithAppsScript('deleteTransaction', { id });
  }
};

window.editTransaction = function(id) {
  if (!isAdmin()) {
    alert('⛔ تعديل الحركات المالية مخصص للمشرف (ADMIN) فقط.');
    return;
  }
  const tx = db.treasuryTransactions.find(t => t.id === id);
  if (!tx) return;

  document.getElementById('edit-tx-id').value = tx.id;
  document.getElementById('edit-tx-amount').value = Math.abs(tx.amount);
  document.getElementById('edit-tx-notes').value = tx.notes;
  openModal('edit-transaction-modal');
};

window.saveTransactionEdit = async function() {
  if (!isAdmin()) return;
  const id = document.getElementById('edit-tx-id').value;
  const tx = db.treasuryTransactions.find(t => t.id === id);
  if (!tx) return;

  const newAmt = parseFloat(document.getElementById('edit-tx-amount').value);
  const newNotes = document.getElementById('edit-tx-notes').value.trim();

  tx.amount = tx.amount < 0 ? -Math.abs(newAmt) : Math.abs(newAmt);
  tx.notes = newNotes;

  saveToLocalStorage();
  logAction('تعديل حركة مالية', `تعديل حركة مالية رقم ${id} بقيمة جديدة ${tx.amount} ج.م`);
  closeModal('edit-transaction-modal');
  renderTreasury();
  renderDashboard();
  await syncWithAppsScript('updateTransaction', { id, amount: tx.amount, notes: tx.notes });
};

window.deleteUser = async function(id) {
  if (!isAdmin()) {
    alert('⛔ حذف المستخدمين مخصص للمشرف (ADMIN) فقط.');
    return;
  }
  if (currentUser && currentUser.id === id) {
    alert('⛔ لا يمكنك حذف حسابك الخاص وأنت مسجل دخول.');
    return;
  }
  try {
    if (await customConfirm('هل أنت متأكد من حذف هذا المستخدم؟\n\nملاحظة أمنية: سيتم حذف ملف المستخدم من النظام فوراً وفقدانه صلاحية الوصول لبياناته، لكن حساب الدخول الخاص به في Firebase Authentication سيظل موجوداً تقنياً (Firebase لا يسمح بحذف حسابات أخرى من المتصفح لأسباب أمنية). لحذفه نهائياً توجه لـ Firebase Console > Authentication.')) {
      const user = db.users.find(u => u.id === id);
      db.users = db.users.filter(u => u.id !== id);
      saveToLocalStorage();
      if (user) logAction('حذف مستخدم', `حذف المستخدم ${user.name}`);
      renderUsers();
      populateDropdowns();
      await syncWithAppsScript('deleteUser', { id, authUid: user ? (user.authUid || null) : null });
      showToast('✅ تم حذف المستخدم بنجاح', 'success');
    }
  } catch (err) {
    console.error('خطأ أثناء حذف المستخدم:', err);
    alert('❌ حصل خطأ غير متوقع أثناء الحذف. افتح Console بالمتصفح (F12) وابعتلي رسالة الخطأ اللي ظهرت.');
  }
};

window.editContract = function(contractId) {
  if (!isAdmin()) {
    alert('⛔ تعديل العقود مخصص للمشرف (ADMIN) فقط.');
    return;
  }
  const c = db.contracts.find(x => x.id === contractId);
  if (!c) return;

  const contractInsts = db.installments.filter(i => i.contractId === c.id);
  const paidCount = contractInsts.filter(i => i.status === 'paid').length;

  document.getElementById('edit-contract-id').value = c.id;
  document.getElementById('edit-contract-client-name').value = c.clientName || '';
  document.getElementById('edit-contract-client-phone').value = c.clientPhone || '';
  document.getElementById('edit-contract-device-info').value = c.deviceInfo || '';
  document.getElementById('edit-contract-cash-price').value = c.cashPrice || 0;
  document.getElementById('edit-contract-interest-type').value = c.interestType || 'none';
  document.getElementById('edit-contract-interest-value').value = c.interestValue || 0;
  document.getElementById('edit-contract-down-payment').value = c.downPayment || 0;
  document.getElementById('edit-contract-duration').value = c.duration || contractInsts.length || 1;
  document.getElementById('edit-contract-start-date').value = c.startDate || '';
  document.getElementById('edit-contract-collector').value = c.collectorName || '';
  document.getElementById('edit-contract-grace').value = c.graceDays || 5;
  document.getElementById('edit-contract-fine-type').value = c.fineType || 'flat';
  document.getElementById('edit-contract-fine-value').value = c.fineValue || 0;
  document.getElementById('edit-contract-status').value = c.status || 'active';

  const paidInfoBox = document.getElementById('edit-contract-paid-info');
  const paidInfoText = document.getElementById('edit-contract-paid-info-text');
  if (paidCount > 0) {
    paidInfoBox.classList.remove('hidden');
    paidInfoText.textContent = `تم تحصيل ${paidCount} من أصل ${contractInsts.length} قسط لهذا العقد بالفعل. لو غيّرت القيم المالية (السعر/المقدم/الفائدة/المدة)، هيتم إعادة توليد الأقساط المتبقية فقط بالقيم الجديدة، ولن يتم المساس بالأقساط المسددة.`;
  } else {
    paidInfoBox.classList.add('hidden');
  }

  openModal('edit-contract-modal');
};

window.saveContractEdit = async function() {
  if (!isAdmin()) return;
  const contractId = document.getElementById('edit-contract-id').value;
  const c = db.contracts.find(x => x.id === contractId);
  if (!c) return;

  try {
    const newClientName = document.getElementById('edit-contract-client-name').value.trim();
    const newClientPhone = document.getElementById('edit-contract-client-phone').value.trim();
    const newDeviceInfo = document.getElementById('edit-contract-device-info').value.trim();
    const newCashPrice = parseFloat(document.getElementById('edit-contract-cash-price').value) || 0;
    const newInterestType = document.getElementById('edit-contract-interest-type').value;
    const newInterestValue = parseFloat(document.getElementById('edit-contract-interest-value').value) || 0;
    const newDownPayment = parseFloat(document.getElementById('edit-contract-down-payment').value) || 0;
    const newDuration = parseInt(document.getElementById('edit-contract-duration').value) || c.duration;
    const newStartDate = document.getElementById('edit-contract-start-date').value || c.startDate;
    const newCollector = document.getElementById('edit-contract-collector').value.trim();
    const newGrace = parseInt(document.getElementById('edit-contract-grace').value) || 5;
    const newFineType = document.getElementById('edit-contract-fine-type').value;
    const newFineValue = parseFloat(document.getElementById('edit-contract-fine-value').value) || 0;
    const newStatus = document.getElementById('edit-contract-status').value;

    const contractInsts = db.installments.filter(i => i.contractId === c.id);
    const paidInsts = contractInsts.filter(i => i.status === 'paid');
    const paidCount = paidInsts.length;
    const paidSum = paidInsts.reduce((sum, i) => sum + (i.paidAmount || i.amount || 0), 0);

    const financialChanged = (
      newCashPrice !== c.cashPrice ||
      newInterestType !== c.interestType ||
      newInterestValue !== c.interestValue ||
      newDownPayment !== c.downPayment ||
      newDuration !== c.duration
    );

    if (financialChanged) {
      if (newDuration <= paidCount) {
        alert(`❌ لا يمكن ضبط مدة التقسيط على ${newDuration} شهر لأن العميل سدد بالفعل ${paidCount} قسط. اختر مدة أكبر من ${paidCount}.`);
        return;
      }
      const remainingCountPreview = newDuration - paidCount;
      if (!(await customConfirm(`⚠️ تنبيه هام:\n\nتعديل القيم المالية للعقد سيؤدي إلى:\n• حذف الأقساط "غير المسددة" الحالية (${contractInsts.length - paidCount} قسط)\n• إعادة توليد ${remainingCountPreview} قسط جديد بالقيم المحدّثة\n• الأقساط المسددة فعلاً (${paidCount}) لن تتأثر إطلاقاً\n\nهل أنت متأكد من المتابعة؟`))) {
        return;
      }
    }

    const interest = calcInterestAmount(newCashPrice, newInterestType, newInterestValue);
    const totalValue = newCashPrice + interest;
    const remainingCount = Math.max(1, newDuration - paidCount);
    const remainingAmount = Math.max(0, totalValue - newDownPayment - paidSum);
    const monthly = parseFloat((remainingAmount / remainingCount).toFixed(2));

    const client = db.clients.find(cl => cl.id === c.clientId);

    c.clientName = newClientName || c.clientName;
    c.clientPhone = newClientPhone || c.clientPhone;
    c.deviceInfo = newDeviceInfo || c.deviceInfo;
    c.cashPrice = newCashPrice;
    c.interestType = newInterestType;
    c.interestValue = newInterestValue;
    c.interestAmount = interest;
    c.totalValue = totalValue;
    c.downPayment = newDownPayment;
    c.duration = newDuration;
    c.startDate = newStartDate;
    c.collectorName = newCollector;
    c.graceDays = newGrace;
    c.fineType = newFineType;
    c.fineValue = newFineValue;
    c.status = newStatus;

    const collectorUser = db.users.find(u => u.name === newCollector);
    if (collectorUser) c.collectorId = collectorUser.id;

    let newInstallments = [];
    if (financialChanged) {
      c.remainingAmount = remainingAmount;
      c.monthlyInstallment = monthly;

      // نحذف الأقساط غير المسددة فقط، ونحتفظ بالمسددة كما هي دون أي تعديل
      db.installments = db.installments.filter(i => !(i.contractId === c.id && i.status !== 'paid'));

      // نبدأ توليد الأقساط الجديدة من بعد آخر قسط مسدد (أو من تاريخ بدء العقد لو مفيش أقساط مسددة)
      let baseDate;
      if (paidInsts.length > 0) {
        const lastPaidDue = paidInsts.reduce((latest, i) => {
          const d = new Date(i.dueDate);
          return d > latest ? d : latest;
        }, new Date(paidInsts[0].dueDate));
        baseDate = lastPaidDue;
      } else {
        baseDate = new Date(newStartDate);
      }

      for (let i = 1; i <= remainingCount; i++) {
        const dueDate = new Date(baseDate);
        dueDate.setMonth(baseDate.getMonth() + i);
        const inst = {
          id: `${c.id}_${paidCount + i}`,
          contractId: c.id,
          clientId: c.clientId,
          clientName: c.clientName,
          clientPhone: c.clientPhone,
          guarantorName: client ? client.guarantorName : '',
          guarantorPhone: client ? client.guarantorPhone : '',
          collectorName: c.collectorName,
          installmentNum: paidCount + i,
          amount: monthly,
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'pending',
          paidAmount: 0,
          paidDate: '',
          receiptId: '',
          delayFines: 0
        };
        db.installments.push(inst);
        newInstallments.push(inst);
      }
    } else {
      // مفيش تغيير مالي: بس نحدّث بيانات العميل/المحصل المنسوخة على الأقساط الحالية
      db.installments.forEach(inst => {
        if (inst.contractId === c.id) {
          inst.collectorName = c.collectorName;
          inst.clientName = c.clientName;
          inst.clientPhone = c.clientPhone;
        }
      });
    }

    saveToLocalStorage();
    logAction('تعديل عقد', `تعديل بيانات العقد رقم ${contractId.replace('con-', '')} للعميل ${c.clientName}`);

    await syncWithAppsScript('updateContract', c);
    if (financialChanged) {
      await syncWithAppsScript('regenerateInstallments', { contractId: c.id, installments: newInstallments });
    }

    closeModal('edit-contract-modal');
    renderContracts();
    renderCollections();
    if (typeof renderDashboard === 'function') renderDashboard();
    showToast('✅ تم حفظ تعديلات العقد بنجاح', 'success');
  } catch (err) {
    console.error('خطأ أثناء حفظ تعديلات العقد:', err);
    alert('❌ حصل خطأ غير متوقع أثناء حفظ التعديلات. افتح Console بالمتصفح (F12) وابعتلي رسالة الخطأ اللي ظهرت.');
  }
};


window.deleteContract = async function(contractId) {
  if (!isAdmin()) {
    alert('⛔ حذف العقود مخصص للمشرف (ADMIN) فقط.');
    return;
  }
  const c = db.contracts.find(x => x.id === contractId);
  if (!c) return;

  if (await customConfirm(`هل أنت متأكد من حذف العقد رقم ${contractId.replace('con-', '')} للعميل ${c.clientName}؟ سيتم حذف جميع أقساطه.`)) {
    const dev = db.inventory.find(d => d.id === c.deviceId);
    if (dev && dev.status === 'sold_installment') {
      dev.status = 'available';
      dev.soldTo = '';
    }
    db.installments = db.installments.filter(inst => inst.contractId !== contractId);
    db.contracts = db.contracts.filter(x => x.id !== contractId);
    saveToLocalStorage();
    logAction('حذف عقد', `حذف العقد رقم ${contractId.replace('con-', '')} للعميل ${c.clientName} وإرجاع الجهاز للمخزن`);
    
    await syncWithAppsScript('deleteContract', { id: contractId, deviceId: c.deviceId });
    
    renderContracts();
    renderInventory();
    renderCollections();
    renderDashboard();
  }
};

// ================= SELECT MENUS & SEARCH FILTERS =================
function populateDropdowns() {
  try {
    const clientSelect = document.getElementById('contract-client-select');
    if (clientSelect) {
      clientSelect.innerHTML = '<option value="">اختر العميل المشتري...</option>';
      db.clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (الهوية: ${c.nationalId})`;
        clientSelect.appendChild(opt);
      });
    }

    const deviceSelect = document.getElementById('contract-device-select');
    if (deviceSelect) {
      deviceSelect.innerHTML = '<option value="">اختر الجهاز من المتاح بالمخزن...</option>';
      db.inventory.filter(d => d.status === 'available').forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `${d.brand} ${d.name} (SN: ${d.serial}) - سعر: ${d.sellingPrice} ج.م`;
        deviceSelect.appendChild(opt);
      });
    }

    const brandSelect = document.getElementById('device-brand-select');
    if (brandSelect) {
      brandSelect.innerHTML = '';
      db.brands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        brandSelect.appendChild(opt);
      });
    }

    const supplierSelect = document.getElementById('device-supplier');
    if (supplierSelect) {
      supplierSelect.innerHTML = '';
      db.suppliers.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        supplierSelect.appendChild(opt);
      });
    }

    const collectorSelect = document.getElementById('contract-collector-select');
    if (collectorSelect) {
      collectorSelect.innerHTML = '<option value="">اختر المحصل المسئول...</option>';
      db.users.filter(u => u.role === 'COLLECTOR').forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.name;
        opt.textContent = `${u.name} (${u.area})`;
        collectorSelect.appendChild(opt);
      });
    }

    const collectionMonthSelect = document.getElementById('collection-filter-month');
    if (collectionMonthSelect) {
      collectionMonthSelect.innerHTML = '<option value="all">كل الأشهر</option>';
      const months = [...new Set(db.installments.map(i => i.dueDate.substring(0, 7)))].sort();
      months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        collectionMonthSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Error populating dropdowns:', err);
  }
}

document.getElementById('client-search-input').addEventListener('input', renderClients);
document.getElementById('inventory-search').addEventListener('input', renderInventory);
document.getElementById('contract-search-input').addEventListener('input', renderContracts);
document.getElementById('collection-search-input').addEventListener('input', renderCollections);
document.getElementById('collection-filter-month').addEventListener('change', renderCollections);
document.getElementById('collection-filter-status').addEventListener('change', renderCollections);

document.getElementById('btn-save-settings').addEventListener('click', () => {
  const offline = document.getElementById('setting-offline-mode').checked;
  const companyName = document.getElementById('setting-company-name').value.trim();
  const logoUrl = document.getElementById('setting-company-logo-url').value;
  const logoFileInput = document.getElementById('setting-company-logo-file');

  db.settings.offlineMode = offline;
  if (companyName) db.settings.companyName = companyName;

  // مهم جداً: لو المستخدم رفع صورة لوجو محلية (ملف)، بيتم تخزين الـ base64 فوراً في
  // db.settings.companyLogo وقت اختيار الملف (شوف حدث change تحت). حقل النص بيبقى
  // فيه وقتها نص وهمي "تم تحميل لوجو محلي كـ Base64" مش الصورة نفسها، فلو خدنا قيمة
  // الحقل النصي وكتبناها فوق companyLogo هنا، هنمسح الصورة الحقيقية ونحط النص الوهمي
  // مكانها بالغلط (وده اللي كان بيحصل ويبوظ اللوجو). فبنتأكد إننا منلمسش القيمة إلا
  // لو المستخدم فعلاً كاتب رابط URL حقيقي أو ماسح الحقل، مش رافع ملف محلي.
  const isPlaceholderText = logoUrl === 'تم تحميل لوجو محلي كـ Base64';
  const hasLocalFileSelected = logoFileInput && logoFileInput.files && logoFileInput.files.length > 0;
  if (!isPlaceholderText && !hasLocalFileSelected) {
    db.settings.companyLogo = logoUrl;
  }

  if (!db.settings.templates) db.settings.templates = {};
  db.settings.templates.reminder = document.getElementById('template-reminder').value;
  db.settings.templates.warning = document.getElementById('template-warning').value;
  db.settings.templates.receipt = document.getElementById('template-receipt').value;

  saveToLocalStorage();
  applyCompanyBranding();
  updateSyncStatusUI();
  logAction('تعديل إعدادات', `تحديث إعدادات النظام واسم الشركة والتوريد السحابي`);
  alert('تم حفظ إعدادات النظام وهوية الشركة بنجاح!');
  
  syncWithAppsScript('updateSettings', {
    id: 'global',
    companyName: db.settings.companyName,
    companyLogo: db.settings.companyLogo,
    offlineMode: db.settings.offlineMode,
    templates: db.settings.templates
  });

  if (!offline) {
    loadFromServer();
  }
});

// ================= ⚠️ التعديل الجوهري والنهائي للفحص الذكي =================
// Test connection button removed for Firebase integration.

document.getElementById('btn-seed-data').addEventListener('click', async () => {
  if (await customConfirm('هل ترغب في إعادة تهيئة النظام؟ سيؤدي هذا لمسح جميع البيانات الحالية (يوزرات، عملاء، عقود، مخزون...) وإرجاع النظام لحالة فارغة تماماً. هذا الإجراء لا يمكن التراجع عنه.')) {
    db = defaultSeedData;
    generateSeededInstallments();
    saveToLocalStorage();
    logAction('حقن بيانات', 'إعادة تهيئة النظام وحقن البيانات النموذجية للتجربة');
    alert('تم إعادة تهيئة قاعدة البيانات بنجاح!');
    location.reload();
  }
});

document.getElementById('btn-clear-db').addEventListener('click', async () => {
  if (await customConfirm('هل أنت متأكد من مسح جميع البيانات المحلية نهائياً؟')) {
    localStorage.removeItem('sky_erp_db');
    alert('تم مسح البيانات بنجاح! سيتم إحياء النظام بقيم فارغة.');
    location.reload();
  }
});

// ================= ترحيل أمني: نقل المستخدمين القدام (كلمة مرور نصية) إلى Firebase Authentication =================
// أي مستخدم قديم كان مُخزَّناً بكلمة مرور نصية في Firestore (قبل تفعيل Firebase
// Authentication الحقيقي) لازم يتم ترحيله مرة واحدة: يتم إنشاء حساب حقيقي له
// في Firebase Authentication بنفس كلمة المرور القديمة، ثم تُحذف كلمة المرور
// النصية نهائياً من قاعدة البيانات (Firestore) ولا تعود تُخزَّن هناك إطلاقاً.
window.migrateUsersToFirebaseAuth = async function() {
  if (!isAdmin()) {
    alert('⛔ هذه العملية مخصصة للمشرف (ADMIN) فقط.');
    return;
  }
  if (!window.FirebaseAuthService) {
    alert('❌ تعذر الاتصال بخدمة Firebase Authentication. تأكد من اتصال الإنترنت.');
    return;
  }

  const legacyUsers = db.users.filter(u => u.password && !u.authUid);
  if (legacyUsers.length === 0) {
    alert('✅ لا يوجد أي مستخدمين بحاجة للترحيل. كل الحسابات آمنة بالفعل عبر Firebase Authentication.');
    return;
  }

  const confirmMsg = `سيتم إنشاء حسابات Firebase Authentication آمنة لعدد ${legacyUsers.length} مستخدم (${legacyUsers.map(u => u.username).join('، ')})، ثم حذف كلمات المرور النصية القديمة الخاصة بهم نهائياً من قاعدة البيانات.\n\nهام: كل مستخدم سيستمر بتسجيل الدخول بنفس اسم المستخدم وكلمة المرور الحاليين تماماً، فقط طريقة التحقق ستصبح آمنة عبر Firebase.\n\nهل تريد المتابعة؟`;
  if (!(await customConfirm(confirmMsg))) return;

  let successCount = 0;
  const failedUsers = [];

  for (const u of legacyUsers) {
    try {
      const result = await window.FirebaseAuthService.createAuthUser(u.username, u.password);
      if (result.success) {
        // تحديث محلي: إضافة authUid وحذف كلمة المرور النصية من الذاكرة
        u.authUid = result.uid;
        delete u.password;

        // تحديث Firestore: إضافة authUid، وحذف حقل password نهائياً بواسطة FieldValue.delete()
        // وبعت الدور "role" كمان عشان يتزامن مستند userRoles اللي قواعد الأمان بتعتمد عليه
        await syncWithAppsScript('updateUser', {
          id: u.id,
          authUid: result.uid,
          role: u.role,
          password: firebase.firestore.FieldValue.delete()
        });
        successCount++;
      }
    } catch (err) {
      console.error('Migration failed for user', u.username, err);
      failedUsers.push(`${u.username} (${err.code || err.message})`);
    }
  }

  saveToLocalStorage();
  renderUsers();
  logAction('ترحيل أمني', `تم ترحيل ${successCount} من ${legacyUsers.length} مستخدم إلى Firebase Authentication الآمن`);

  let resultMsg = `✅ تم ترحيل ${successCount} من ${legacyUsers.length} مستخدم بنجاح إلى Firebase Authentication.`;
  if (failedUsers.length > 0) {
    resultMsg += `\n\n⚠️ فشل ترحيل الحسابات التالية (غالباً لأن الحساب موجود مسبقاً في Firebase Authentication):\n${failedUsers.join('\n')}`;
  }
  alert(resultMsg);
};

document.getElementById('btn-export-json').addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `sky_erp_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});

window.exportTransactionsCSV = function() {
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "التاريخ والوقت,النوع التقييدي,البيان والشرح بالتفصيل,المبلغ الفعلي المورد بالخزينة\n";
  
  db.treasuryTransactions.forEach(tx => {
    let typeText = tx.type;
    let amountStr = tx.amount;
    csvContent += `"${tx.timestamp}","${typeText}","${tx.notes.replace(/"/g, '""')}","${amountStr}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `sky_treasury_report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// ================= CLIENT DETAILS VIEWER =================
window.viewClientDetails = function(clientId) {
  const client = db.clients.find(c => c.id === clientId);
  if (!client) return;

  const clientContracts = db.contracts.filter(c => c.clientId === clientId);
  
  let contractsHtml = clientContracts.map(c => `
    <div class="p-3 bg-slate-50 rounded-lg border border-slate-100 mb-2">
      <div class="flex justify-between font-bold text-xs text-slate-800">
        <span>رقم العقد: ${escapeHTML(c.id.replace('con-', ''))}</span>
        <span class="text-teal-600">${c.totalValue.toLocaleString()} ج.م</span>
      </div>
      <p class="text-[10px] text-slate-500 mt-1">الجهاز: ${escapeHTML(c.deviceInfo)} | المحصل: ${escapeHTML(c.collectorName)}</p>
    </div>
  `).join('');

  if (clientContracts.length === 0) {
    contractsHtml = '<p class="text-xs text-slate-400">لا توجد عقود مسجلة لهذا العميل حالياً.</p>';
  }

  const detailDiv = document.createElement('div');
  detailDiv.id = 'client-profile-modal';
  detailDiv.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
  
  const docView = (title, data) => {
    if (data && data.startsWith('data:image')) {
      return `<button type="button" onclick="openBase64InPreviewModal('${title}', '${data}')" class="font-bold text-teal-600 hover:text-teal-800 underline block mt-1">عرض المستند 👁️</button>`;
    }
    return `<span class="font-semibold text-slate-400 truncate block mt-1">${data || 'غير متوفر'}</span>`;
  };

  detailDiv.innerHTML = `
    <div class="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 overflow-hidden max-h-[85vh] flex flex-col">
      <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
        <h4 class="font-bold text-lg text-slate-800 flex items-center gap-2"><i class="ph ph-identification-card text-teal-600"></i> الملف التعريفي للعميل</h4>
        <button onclick="document.getElementById('client-profile-modal').remove()" class="text-slate-400 hover:text-slate-600"><i class="ph ph-x text-lg"></i></button>
      </div>
      <div class="flex-1 overflow-y-auto space-y-6 text-sm">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h5 class="font-bold text-teal-600 border-b border-teal-50 pb-1 mb-2">بيانات العميل</h5>
            <p class="mb-1"><strong>الاسم الرباعي:</strong> ${escapeHTML(client.name)}</p>
            <p class="mb-1"><strong>الهوية القومية:</strong> ${escapeHTML(client.nationalId)}</p>
            <p class="mb-1"><strong>الهاتف:</strong> ${escapeHTML(client.phone)}</p>
            <p class="mb-1"><strong>العنوان:</strong> ${escapeHTML(client.address)}</p>
            ${client.locationUrl && /^https?:\/\//i.test(client.locationUrl) ? `<a href="${escapeHTML(client.locationUrl)}" target="_blank" class="text-teal-600 hover:underline text-xs font-semibold"><i class="ph ph-map-pin"></i> عرض خرائط Google</a>` : ''}
          </div>
          <div>
            <h5 class="font-bold text-emerald-600 border-b border-emerald-50 pb-1 mb-2">بيانات الضامن</h5>
            <p class="mb-1"><strong>الاسم الرباعي:</strong> ${escapeHTML(client.guarantorName) || '-'}</p>
            <p class="mb-1"><strong>الهوية القومية:</strong> ${escapeHTML(client.guarantorNationalId) || '-'}</p>
            <p class="mb-1"><strong>الهاتف:</strong> ${escapeHTML(client.guarantorPhone) || '-'}</p>
            <p class="mb-1"><strong>صلة القرابة:</strong> ${escapeHTML(client.guarantorRelation) || '-'}</p>
            <p class="mb-1"><strong>العنوان:</strong> ${escapeHTML(client.guarantorAddress) || '-'}</p>
          </div>
        </div>

        <div class="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <h5 class="font-bold text-slate-700 mb-3 text-xs">المستندات والملفات المرفقة:</h5>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div class="bg-white p-2 rounded border border-slate-200">
              <span class="block text-slate-400 text-[10px]">بطاقة العميل</span>
              ${docView('بطاقة العميل', client.nationalIdImg)}
            </div>
            <div class="bg-white p-2 rounded border border-slate-200">
              <span class="block text-slate-400 text-[10px]">عقد العميل</span>
              ${docView('عقد العميل', client.contractImg)}
            </div>
            <div class="bg-white p-2 rounded border border-slate-200">
              <span class="block text-slate-400 text-[10px]">بطاقة الضامن</span>
              ${docView('بطاقة الضامن', client.guarantorCardImg)}
            </div>
            <div class="bg-white p-2 rounded border border-slate-200">
              <span class="block text-slate-400 text-[10px]">عقد الضامن</span>
              ${docView('عقد الضامن', client.guarantorContractImg)}
            </div>
          </div>
        </div>

        <div>
          <h5 class="font-bold text-slate-700 border-b border-slate-100 pb-1 mb-2">العقود المفتوحة</h5>
          ${contractsHtml}
        </div>
      </div>
      <div class="pt-3 border-t border-slate-100 flex justify-end">
        <button onclick="document.getElementById('client-profile-modal').remove()" class="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">إغلاق</button>
      </div>
    </div>
  `;
  document.body.appendChild(detailDiv);
};

window.openBase64InPreviewModal = function(title, base64) {
  document.getElementById('preview-modal-img').src = base64;
  document.getElementById('preview-modal-title').textContent = title;
  openModal('image-preview-modal');
};

// ================= CONTRACT DETAILS VIEWER =================
window.viewContractDetails = function(contractId) {
  const contract = db.contracts.find(c => c.id === contractId);
  if (!contract) return;

  const contractInsts = db.installments.filter(inst => inst.contractId === contractId);

  let instRows = contractInsts.map(inst => {
    const statusInfo = getInstallmentOverdueStatus(inst);
    return `
      <tr class="hover:bg-slate-50 divide-y divide-slate-100 text-xs">
        <td class="p-3 font-bold">قسط ${inst.installmentNum}</td>
        <td class="p-3 font-mono">${inst.dueDate}</td>
        <td class="p-3 font-mono font-bold">${inst.amount.toLocaleString()} ج.م</td>
        <td class="p-3"><span class="badge ${statusInfo.statusColor} font-bold">${statusInfo.statusText}</span></td>
        <td class="p-3 font-mono font-bold text-teal-600">${statusInfo.fine > 0 ? `${statusInfo.fine.toLocaleString()} ج.م` : '0'}</td>
        <td class="p-3 font-mono font-bold text-slate-800">${statusInfo.totalDue.toLocaleString()} ج.م</td>
        <td class="p-3 text-center">
          ${inst.status !== 'paid' ? `
            <button onclick="document.getElementById('contract-detail-modal').remove(); collectInstallmentBtn('${inst.id}')" class="px-3 py-1 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition-colors">تحصيل</button>
          ` : `
            <span class="text-emerald-600 font-bold"><i class="ph ph-check"></i> مدفوع</span>
          `}
        </td>
      </tr>
    `;
  }).join('');

  const detailDiv = document.createElement('div');
  detailDiv.id = 'contract-detail-modal';
  detailDiv.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
  detailDiv.innerHTML = `
    <div class="bg-white rounded-2xl w-full max-w-4xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
        <h4 class="font-bold text-lg text-slate-800 flex items-center gap-2"><i class="ph ph-file-text text-teal-600"></i> تفاصيل وجدولة أقساط العقد رقم: ${escapeHTML(contract.id.replace('con-', ''))}</h4>
        <button onclick="document.getElementById('contract-detail-modal').remove()" class="text-slate-400 hover:text-slate-600"><i class="ph ph-x text-lg"></i></button>
      </div>
      <div class="flex-1 overflow-y-auto space-y-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl text-xs">
          <p><strong>العميل المشتري:</strong> ${escapeHTML(contract.clientName)}</p>
          <p><strong>المحصل المسند:</strong> ${escapeHTML(contract.collectorName)}</p>
          <p><strong>الجهاز المباع:</strong> ${escapeHTML(contract.deviceInfo)}</p>
          <p><strong>تاريخ العقد:</strong> ${escapeHTML(contract.startDate)}</p>
          <p><strong>قيمة العقد الإجمالية:</strong> ${contract.totalValue.toLocaleString()} ج.م</p>
          <p><strong>الدفعة المقدمة:</strong> ${contract.downPayment.toLocaleString()} ج.م</p>
          <p><strong>المبلغ المتبقي للتقسيط:</strong> ${contract.remainingAmount.toLocaleString()} ج.م</p>
          <p><strong>قيمة القسط الشهري:</strong> ${contract.monthlyInstallment.toLocaleString()} ج.م</p>
        </div>

        <div class="table-scroll-wrapper">
          <table class="w-full text-right border-collapse">
            <thead>
              <tr class="bg-slate-100 border-b border-slate-200 text-slate-700 text-xs font-bold">
                <th class="p-3">رقم الدفعة</th>
                <th class="p-3">تاريخ الاستحقاق</th>
                <th class="p-3">قيمة القسط الأصلية</th>
                <th class="p-3">الحالة والمدة</th>
                <th class="p-3">غرامة التأخير</th>
                <th class="p-3">إجمالي القيمة المطلوبة</th>
                <th class="p-3 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              ${instRows}
            </tbody>
          </table>
        </div>
      </div>
      <div class="pt-3 border-t border-slate-100 flex justify-end">
        <button onclick="document.getElementById('contract-detail-modal').remove()" class="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">إغلاق</button>
      </div>
    </div>
  `;
  document.body.appendChild(detailDiv);
};

// ================= ROUTING & TAB NAVIGATION =================
window.switchTab = function(tabName) {
  // منع المحصل من الانتقال إلى أي تبويب آخر غير التحصيلات
  if (currentUser && currentUser.role === 'COLLECTOR' && tabName !== 'collections') {
    tabName = 'collections';
  }
  
  document.querySelectorAll('#sidebar-menu a').forEach(b => {
    if (b.getAttribute('data-tab') === tabName) {
      b.className = 'nav-link nav-link-active flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-200 active-tab-btn';
    } else {
      b.className = 'flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-skyDark-800 hover:text-white font-medium transition-all duration-200';
    }
  });

  document.querySelectorAll('#main-content-tabs > section').forEach(sec => {
    sec.classList.add('hidden');
  });

  const activeSection = document.getElementById(`tab-${tabName}`);
  if (activeSection) {
    activeSection.classList.remove('hidden');
    // إعادة تشغيل أنيميشن الظهور السلس في كل مرة يتفتح فيها التاب
    activeSection.classList.remove('tab-fade-in');
    void activeSection.offsetWidth; // إجبار المتصفح يعيد حساب الأنيميشن من الأول
    activeSection.classList.add('tab-fade-in');
  }

  renderActiveTab(tabName);
  localStorage.setItem('sky_erp_active_tab', tabName);
  
  // Close mobile sidebar after selecting a tab
  closeMobileSidebar();
};

document.querySelectorAll('#sidebar-menu a').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    const activeTab = this.getAttribute('data-tab');
    switchTab(activeTab);
  });
});

// ================= MOBILE SIDEBAR =================
function openMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('sidebar-open');
  if (backdrop) backdrop.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('sidebar-open');
  if (backdrop) backdrop.classList.remove('visible');
  document.body.style.overflow = '';
}

window.openMobileSidebar = openMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;

// ================= DARK MODE TOGGLE =================
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeToggleIcon = document.getElementById('theme-toggle-icon');

function updateThemeIcon(isDark) {
  if (isDark) {
    themeToggleIcon.className = 'ph ph-sun text-amber-400';
  } else {
    themeToggleIcon.className = 'ph ph-moon';
  }
}

// Check initial theme from localStorage
const storedTheme = localStorage.getItem('sky_erp_theme');
if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
  updateThemeIcon(true);
} else {
  document.documentElement.classList.remove('dark');
  updateThemeIcon(false);
}

themeToggleBtn.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('sky_erp_theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);

  // إعادة رسم الرسم البياني بالداشبورد بألوان تناسب الوضع الجديد فوراً،
  // لو التاب المفتوح حالياً هو لوحة القيادة
  const dashboardSection = document.getElementById('tab-dashboard');
  if (dashboardSection && !dashboardSection.classList.contains('hidden') && typeof renderDashboard === 'function') {
    renderDashboard();
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  if (await customConfirm('هل ترغب في تسجيل الخروج؟')) {
    handleUserLogout();
  }
});

document.getElementById('login-submit-btn').addEventListener('click', performLogin);
document.getElementById('login-password-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performLogin();
});

// ================= INITIALIZATION =================
initDatabase();
// ملاحظة: لم نعد نستدعي أي دالة "auto login" يدوية تعتمد على localStorage.
// شاشة الدخول تظل معروضة افتراضياً (كما هي في index.html) لحين ورود أول
// حدث firebase-auth-changed من firebase-config.js، والذي يقرر تلقائياً هل
// هناك جلسة Firebase Authentication محفوظة يعاد فتحها أو يجب إظهار شاشة الدخول.
setLoginLoading(true, 'جاري التحقق من الجلسة...');
handleMobileTopbar(); // Initialize mobile topbar visibility

// شبكة أمان: لو لأي سبب (مفيش إنترنت، سكريبت Firebase اتحجب، إلخ) ملحدث
// firebase-auth-changed ما اتطلقش خالص خلال 10 ثواني، نوري شاشة الدخول
// بدل ما نسيب المستخدم واقف على شاشة "جاري التحقق" للأبد.
setTimeout(() => {
  const overlay = document.getElementById('session-check-overlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    console.warn('لم يتم استلام حدث firebase-auth-changed خلال المهلة المحددة. إظهار شاشة الدخول كإجراء احتياطي.');
    showLoginScreen();
    showLoginError('❌ تعذر التحقق من جلسة الدخول. تحقق من اتصال الإنترنت وحاول مرة أخرى.');
  }
}, 10000);

// Custom wrapper to open contract modal and populate dropdowns with latest data
window.openAddContractModal = function() {
  populateDropdowns();
  openModal('add-contract-modal');
};

// ================= تهيئة Firebase بعد تسجيل دخول حقيقي =================
// الاستماع لحدث firebase-auth-changed الذي يُطلق من firebase-config.js
// فور أي تغيّر في حالة المصادقة الحقيقية (دخول ناجح / خروج / استعادة جلسة محفوظة)

// تحميل بيانات النظام (مرة واحدة) والاشتراك في التحديثات الفورية بعد تأكيد الدخول
async function startFirebaseSubscription(uid, email) {
  if (!window.FirebaseService || !window.FirebaseService.isAvailable()) {
    showLoginScreen();
    showLoginError('❌ تعذر الاتصال بقاعدة البيانات السحابية.');
    return;
  }

  // تحميل أولي كامل للبيانات (يتضمن ملفات المستخدمين اللازمة لمطابقة الحساب الحالي)
  await loadFromServer();

  // مطابقة الحساب المُسجَّل دخوله حالياً مع ملفه في Firestore وفتح الشاشة الرئيسية
  if (uid) {
    await resolveCurrentUserFromAuth(uid, email);
  }

  if (firebaseSubscriptionActive) return; // منع الاشتراك المزدوج في التحديثات الفورية
  firebaseSubscriptionActive = true;
  console.log("Starting Firebase real-time subscription after real authentication...");

  // الاشتراك في التحديثات الفورية (Real-time)
  window.FirebaseService.subscribeToUpdates((colName, items) => {
    if (colName === 'settings') {
      if (items) {
        db.settings = { ...db.settings, ...items };
        applyCompanyBranding();
        updateSyncStatusUI();
      }
    } else if (colName === 'users' && (!items || items.length === 0)) {
      // البذر التلقائي إذا كانت قاعدة البيانات فارغة
      console.warn("Firestore 'users' collection is empty. Seeding default data...");
      window.FirebaseService.seedFirebase(defaultSeedData);
    } else if (colName === 'treasuryTransactions' || colName === 'auditLogs') {
      // نرتب حسب الوقت (الأحدث أولاً) لأن Firebase مش بيضمن ترتيب معين للنتائج
      db[colName] = sortByTimestampDesc(items || []);
    } else {
      db[colName] = items || [];
    }

    saveToLocalStorage();
    renderAllTabs();
  });
}

// الاستماع لحدث تغيّر حالة المصادقة الحقيقية القادم من firebase-config.js
window.addEventListener('firebase-auth-changed', async (event) => {
  const { signedIn, uid, email } = event.detail;
  console.log("firebase-auth-changed event received:", event.detail);

  if (signedIn) {
    setLoginLoading(true, 'جاري تحميل بياناتك...');
    await startFirebaseSubscription(uid, email);
  } else {
    // لا توجد جلسة دخول حقيقية (خروج أو أول زيارة) - أظهر شاشة الدخول
    firebaseSubscriptionActive = false;
    currentUser = null;
    showLoginScreen();
  }
});