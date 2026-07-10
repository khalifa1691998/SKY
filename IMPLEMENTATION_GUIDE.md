# دليل التطبيق: تحسينات نظام SKY-ERP

## 📋 نظرة عامة

تم إضافة ميزتين رئيسيتين إلى النظام:

1. **نظام تقارير الأرباح المحصلة فعلياً للمستثمرين**
2. **نظام التذكير التلقائي بواتساب مع تنبيهات اليوم**

---

## 🎯 الميزة الأولى: تقارير الأرباح المحصلة

### الملف: `investor-reports-enhancement.js`

#### الدوال الرئيسية:

##### 1. `computeActualCollectedProfit()`
**الوصف:** حساب صافي الأرباح المحصلة فعلياً من الأقساط المسددة فقط

**الإرجاع:**
```javascript
{
  totalCollected: 50000,      // إجمالي الأقساط المسددة
  totalExpenses: 5000,        // إجمالي المصروفات التشغيلية
  actualProfit: 45000,        // صافي الأرباح المحصلة
  paidInstallmentsCount: 25   // عدد الأقساط المسددة
}
```

##### 2. `distributeActualProfitToInvestors()`
**الوصف:** توزيع الأرباح المحصلة على المستثمرين بناءً على نسبة رأس مالهم

**الإرجاع:**
```javascript
{
  profitData: { ... },
  distribution: [
    {
      investorId: "inv-1",
      investorName: "أحمد محمد",
      capitalAmount: 100000,
      capitalRatio: "50.00",
      totalProfitShare: 22500,
      alreadyWithdrawn: 5000,
      remainingDue: 17500,
      joinDate: "2024-01-01",
      notes: "..."
    },
    // ... المستثمرون الآخرون
  ],
  totalDistributed: 45000,
  averageProfitPerInvestor: 22500
}
```

##### 3. `generateInvestorCollectedProfitStatement(investorId)`
**الوصف:** إنشاء كشف حساب مستثمر يوضح الأرباح المحصلة فعلياً

**الاستخدام:**
```javascript
const statement = generateInvestorCollectedProfitStatement('inv-1');
// يعيد كائن يحتوي على بيانات المستثمر والأرباح والمقارنات
```

#### دوال الطباعة والعرض:

##### 1. `printInvestorCollectedProfitStatement(investorId)`
**الوصف:** طباعة كشف حساب مستثمر مع الأرباح المحصلة
**الاستخدام:** `printInvestorCollectedProfitStatement('inv-1')`

##### 2. `viewProfitDistributionReport()`
**الوصف:** عرض تقرير توزيع الأرباح لجميع المستثمرين
**الاستخدام:** `viewProfitDistributionReport()`

##### 3. `viewProfitComparisonReport()`
**الوصف:** عرض تقرير مقارن بين الأرباح المحصلة والإجمالية
**الاستخدام:** `viewProfitComparisonReport()`

#### دوال التصدير:

##### 1. `exportProfitDistributionToExcel()`
**الوصف:** تصدير تقرير توزيع الأرباح إلى ملف Excel
**الاستخدام:** `exportProfitDistributionToExcel()`

---

## 📱 الميزة الثانية: التذكير التلقائي بواتساب

### الملف: `whatsapp-automation-enhancement.js`

#### الدوال الرئيسية:

##### 1. `getTodayDueInstallments()`
**الوصف:** الحصول على الأقساط المستحقة اليوم
**الإرجاع:** مصفوفة من الأقساط المستحقة اليوم

##### 2. `getTodayDueStats()`
**الوصف:** حساب إحصائيات الأقساط المستحقة اليوم
**الإرجاع:**
```javascript
{
  totalCount: 5,              // عدد الأقساط
  totalDueAmount: 25000,      // الإجمالي المطلوب
  overdueCount: 2,            // عدد المتأخرة
  pendingCount: 3,            // عدد قيد الاستحقاق
  installments: [...]         // تفاصيل الأقساط
}
```

##### 3. `generateTodayDueReminder()`
**الوصف:** إنشاء تنبيه صباحي بالأقساط المستحقة اليوم
**الإرجاع:**
```javascript
{
  hasDue: true,
  stats: { ... },
  message: "📢 تنبيه صباحي - الأقساط المستحقة...",
  timestamp: "09/07/2026 10:30:00"
}
```

##### 4. `prepareBulkWhatsappMessages(installmentIds, messageType)`
**الوصف:** إعداد الرسائل الجماعية للإرسال
**المعاملات:**
- `installmentIds`: مصفوفة معرفات الأقساط (اختياري - إذا لم تُمرر، يتم استخدام أقساط اليوم)
- `messageType`: نوع الرسالة ('reminder', 'warning', 'receipt')

**الإرجاع:**
```javascript
{
  success: true,
  totalCount: 5,
  messages: [
    {
      installmentId: "inst-1",
      clientName: "محمد أحمد",
      clientPhone: "01012345678",
      normalizedPhone: "201012345678",
      amount: 5000,
      dueDate: "2026-07-09",
      message: "مرحباً محمد، نود تذكيركم...",
      status: "pending"
    },
    // ... الرسائل الأخرى
  ],
  messageType: "reminder",
  preparedAt: "09/07/2026 10:30:00"
}
```

##### 5. `sendBulkWhatsappMessages(preparedMessages)`
**الوصف:** إرسال الرسائل الجماعية بتسلسل
**الإرجاع:**
```javascript
{
  totalCount: 5,
  sentCount: 4,
  failedCount: 1,
  results: [
    {
      clientName: "محمد أحمد",
      status: "sent",
      sentAt: "09/07/2026 10:35:00"
    },
    // ... النتائج الأخرى
  ],
  completedAt: "09/07/2026 10:37:00"
}
```

#### دوال الواجهة:

##### 1. `showTodayDueRemindersPanel()`
**الوصف:** عرض لوحة التنبيهات الصباحية
**الاستخدام:** `showTodayDueRemindersPanel()`
**الملاحظة:** تظهر تلقائياً عند فتح الصفحة صباحاً

##### 2. `sendTodayDueRemindersInBulk()`
**الوصف:** إرسال تنبيهات اليوم بضغطة زر واحدة
**الاستخدام:** `sendTodayDueRemindersInBulk()`

##### 3. `viewTodayDueDetails()`
**الوصف:** عرض تفاصيل الأقساط المستحقة اليوم
**الاستخدام:** `viewTodayDueDetails()`

#### دالة التهيئة:

##### 1. `initializeDailyReminders()`
**الوصف:** تفعيل التنبيهات الصباحية التلقائية
**الملاحظة:** يتم استدعاؤها تلقائياً عند تحميل الصفحة

---

## 🔧 التعديلات على `app.js`

### 1. إضافة علامة تبويب جديدة
```javascript
case 'today-reminders':
  renderTodayReminders();
  break;
```

### 2. تحديث قائمة الأذونات
```javascript
const STAFF_PERMISSION_TABS = [
  'clients', 'client-balances', 'inventory', 'suppliers', 
  'products', 'contracts', 'collections', 'treasury', 
  'investors', 'expenses', 'today-reminders', 'reports'
];
```

### 3. إضافة دالة العرض
```javascript
function renderTodayReminders() {
  // يتم ملء الجدول والإحصائيات ديناميكياً
}
```

---

## 🎨 التعديلات على `index.html`

### 1. إضافة رابط التبويب الجديد
```html
<a href="#" data-tab="today-reminders" class="flex items-center gap-3 ...">
  <i class="ph ph-bell-ringing"></i>
  <span>تنبيهات اليوم</span>
</a>
```

### 2. إضافة محتوى التبويب الجديد
```html
<section id="tab-today-reminders" class="space-y-6 hidden">
  <!-- محتوى التنبيهات -->
</section>
```

### 3. إضافة أزرار جديدة في علامة تبويب المستثمرين
```html
<button onclick="viewProfitDistributionReport()">توزيع الأرباح المحصلة</button>
<button onclick="viewProfitComparisonReport()">تقرير مقارن</button>
```

---

## 📊 أمثلة الاستخدام

### مثال 1: عرض توزيع الأرباح المحصلة
```javascript
// في أي مكان في الكود
const distribution = distributeActualProfitToInvestors();
console.log(`إجمالي الأرباح المحصلة: ${distribution.profitData.actualProfit}`);
console.log(`عدد المستثمرين: ${distribution.distribution.length}`);
```

### مثال 2: إرسال تنبيهات اليوم
```javascript
// الطريقة الأولى: من الواجهة
sendTodayDueRemindersInBulk();

// الطريقة الثانية: برمجياً
const prepared = prepareBulkWhatsappMessages(null, 'reminder');
if (prepared.success) {
  const results = await sendBulkWhatsappMessages(prepared);
  console.log(`تم إرسال ${results.sentCount} رسالة`);
}
```

### مثال 3: طباعة كشف حساب مستثمر
```javascript
// طباعة كشف الأرباح المحصلة
printInvestorCollectedProfitStatement('inv-1');

// أو طباعة كشف الأرباح الإجمالية (الموجود سابقاً)
printInvestorStatement('inv-1');
```

---

## ⚙️ الإعدادات والتخصيص

### تخصيص رسائل واتساب
في علامة التبويب "الإعدادات"، يمكن تعديل نماذج الرسائل:
- **تذكير**: رسالة تذكير عادية
- **إنذار**: رسالة إنذار للأقساط المتأخرة
- **إيصال**: رسالة تأكيد السداد

### المتغيرات المتاحة في الرسائل
- `{{الاسم}}`: اسم العميل
- `{{القسط}}`: مبلغ القسط
- `{{التاريخ}}`: تاريخ الاستحقاق
- `{{العقد}}`: رقم العقد
- `{{الغرامة}}`: مبلغ الغرامة (للمتأخرة)
- `{{المطلوب}}`: الإجمالي المطلوب
- `{{اسم_الشركة}}`: اسم الشركة

---

## 🔐 الأمان والأذونات

### أذونات الموظفين
- **موظف إدخال البيانات (STAFF)**: يمكنه عرض تنبيهات اليوم وإرسال الرسائل
- **المحصل (COLLECTOR)**: يمكنه عرض التنبيهات فقط (قراءة)
- **المدير (ADMIN)**: كل الصلاحيات

### حماية البيانات
- جميع الرسائل تُسجل في سجل العمليات
- أرقام الهواتف تُطبّع قبل الإرسال
- لا توجد بيانات حساسة في السجلات

---

## 🐛 استكشاف الأخطاء

### المشكلة: لا تظهر تنبيهات اليوم
**الحل:**
1. تأكد من تحميل ملف `whatsapp-automation-enhancement.js`
2. تحقق من تاريخ النظام (يجب أن يكون صحيحاً)
3. تأكد من وجود أقساط مستحقة اليوم

### المشكلة: لا تظهر أزرار الأرباح المحصلة
**الحل:**
1. تأكد من تحميل ملف `investor-reports-enhancement.js`
2. تحقق من صلاحيات المستخدم (يجب أن يكون Admin)
3. تأكد من وجود مستثمرين في النظام

### المشكلة: رسائل واتساب لا تُرسل
**الحل:**
1. تحقق من أرقام الهواتف (يجب أن تكون بصيغة صحيحة)
2. تأكد من الاتصال بالإنترنت
3. تحقق من متصفح الويب (قد يحتاج إلى تحديث)

---

## 📝 ملاحظات مهمة

1. **الأرباح المحصلة**: تُحسب من الأقساط المسددة فقط، لا تشمل الأقساط المعلقة
2. **التوزيع**: يتم بناءً على نسبة رأس مال كل مستثمر من الإجمالي
3. **التنبيهات**: تظهر مرة واحدة فقط يومياً (يتم تخزين آخر تاريخ في localStorage)
4. **واتساب**: الرسائل تُفتح في نافذة جديدة، والمستخدم يجب أن يضغط "إرسال" يدوياً

---

## 🚀 الخطوات التالية

1. **اختبار الميزات**: تأكد من عمل جميع الأزرار والتقارير
2. **تخصيص الرسائل**: عدّل نماذج الرسائل حسب احتياجاتك
3. **تدريب الموظفين**: اشرح كيفية استخدام التنبيهات والتقارير
4. **المراقبة**: راقب سجل العمليات للتأكد من عمل كل شيء بشكل صحيح

---

## 📞 الدعم الفني

في حالة وجود أي مشاكل أو استفسارات، يرجى:
1. التحقق من سجل العمليات (Audit Log)
2. فتح أدوات المطور (F12) والتحقق من الأخطاء
3. التأكد من تحميل جميع الملفات بشكل صحيح
